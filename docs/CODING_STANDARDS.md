# Forma Coding Standards

Guide for humans and agents working in this repo. Prefer the patterns already
in `src/` over inventing new ones. When a rule here conflicts with nearby code,
follow the nearby code and update this file.

Background: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`DESIGN_SPEC.md`](./DESIGN_SPEC.md)
Trackers: [`BUGS.md`](./BUGS.md) · [`IMPROVEMENTS.md`](./IMPROVEMENTS.md)

---

## 1. What this app is

Forma is a browser-based **empty-canvas furniture panel designer** (React 19,
Three.js, Zustand, TypeScript, Vite). Designers insert library panels / fronts /
hardware or open-front cabinet assemblies, position and finish them, and export
a cut list that stays in sync with the scene.

Three top-level modes: **Model** (editor), **Cut List** (BOM + CSV), **Render**
(clean presentation + PNG).

The old parametric sideboard (always-present piece, leg/handle/base styles) was
**deliberately removed**. Do not revive it. New geometry enters only as library
items or generated cabinet members.

---

## 2. Directory layout

| Path | Responsibility |
| --- | --- |
| `src/domain/` | Framework-free domain logic: types, catalog, cabinets, parts, BOM/CSV, geometry builders, units, workspace math. Photographed grain URLs live here (`oakGrain.ts`, `walnutGrain.ts`) so the Color swatch and `MaterialCache` share one file from `public/`. |
| `src/store/` | Zustand stores, `commit()` history, persistence, document mutations (`actions.ts`) |
| `src/viewport/` | Imperative Three.js scene (lazy-loaded): managers, controllers, selection-gap dimensions, `viewportApi`, React overlays |
| `src/ui/` | App chrome: toolbar, sidebars, cut list, primitives, keyboard shortcuts |
| `src/styles/theme.css` | Tailwind v4 `@theme` tokens + `@layer base` resets |
| `e2e/` | Playwright smoke tests |
| `docs/` | Architecture, design spec, standards, bug and improvement trackers |
| `reference/` | Historical HTML prototype — **not** production code to copy |

Keep each concern in its layer. Domain must not import React or Three.js at
module scope. UI must not own Three.js scene objects. Store actions may call
`viewportApi()` for spatial helpers that need live meshes.

---

## 3. State management

### Three places for state

1. **`documentStore`** — the design: parts, transforms, groups, finishes,
   hidden ids, title, saved versions. Persisted and (mostly) undoable.
2. **`uiStore`** — ephemeral UI: selection, gizmo/view mode, measure, marquee,
   toast, save status, `displayUnit`, `gridSizeM`. Not in undo; preferences use
   their own localStorage keys.
3. **`history.ts`** — module-level undo/redo stacks (not Zustand). React
   subscribes via `historyStore` + `useSyncExternalStore`.

### `commit()` rules

Every **geometry / document-content** mutation goes through `commit(mutate)`:

```ts
commit(() => {
  useDocumentStore.setState(/* immutable update */);
});
```

`commit`:

- Snapshots the full undoable document *before* the mutate
- Reconciles `currentVersionId` against saved versions
- Skips no-ops (`JSON.stringify` equality)
- Caps depth at 50 and clears the redo stack

**Do not wrap in `commit()`:**

| Action | Why |
| --- | --- |
| `saveVersion()` / `renameDocument()` | Document metadata, not a geometry edit. After writing, call `syncHistoryDocumentMeta()` so later Undo cannot resurrect a pre-save title/version list (BUG-007). |
| UI-only updates | Selection, gizmo mode, tabs, measure, toast, etc. |
| `newDocument()` / initial hydrate | Call `clearHistory()` — a fresh document boundary, not an undo step. |

### Transforms and visibility

- Transforms live in the **document store** (not only on meshes).
- Gizmo drags mutate the scene freely and call `commitTransforms` **once on
  release** — one undo entry per gesture, not per frame.
- `hiddenIds` is document state so hide/show survives rebuilds and undo.

### Selection

- Selection is UI state (`selectedPartIds`).
- After undo/redo/version restore, call `pruneSelection(livePartIds(...))` so
  dangling ids disappear.
- `deleteParts` / `openFile` / `newDocument` clear or filter selection explicitly.

---

## 4. Domain layer

### Purity

Everything under `src/domain/` must stay unit-testable in Node:

- **No** `import … from 'react'` or `import … from 'three'` at module scope
- Three.js is **injected** into geometry builders (`ThreeModule` / `createPartNode`)
- Type-only three references use `import type` / `import('three').Mesh`

### Units

| Quantity | Unit | Where |
| --- | --- | --- |
| Part sizes, cabinet dims, BOM, manufacturing metadata | **millimetres** | Domain, catalog, BOM |
| Transform `position` | **metres** | Document store / Three.js world |
| Display preference | `mm` \| `cm` \| `in` (default **cm**) | `uiStore.displayUnit` only |

Convert at the boundary (`MM = 1/1000` in `geometry.ts`; actions use `* 1000` /
`/ 1000`). Never store centimetres or inches in the document.

### Single source of live parts

`computePartSpecs(customParts)` feeds the mesh builder, Assembly tree, part
count, Select All, and BOM. Do not maintain a parallel “fixed parts” list.

### Immutability

- Prefer spreads and `structuredClone` over in-place mutation of store state
- `snapshotDocument` deep-clones nested maps/arrays before undo/persist
- Cabinet demotion returns new `groups` arrays (`invalidatePartiallyEditedCabinets`)

### Cabinets

- Generated cabinets carry `group.cabinet` config; parametric rebuilds go through
  `setCabinetDim` / `resizeCabinetFromGizmo` / `commitCabinetResize`
- Changing a **subset** of members' **size** clears `cabinet` (demotion). Moving,
  rotating or renaming members does not. Deleting a generated shelf or interior
  panel updates the config and rebuilds; deleting a carcass piece still demotes.
  Persistence must not resurrect stock configs from labels on current-schema
  loads (BUG-009)
- Grain / edge banding on cabinet panels are user-editable and must survive
  reload (BUG-008)

---

## 5. Viewport layer

### Imperative core, React shell

`Viewport.tsx` constructs `SceneManager`, `ModelBuilder`, controllers inside one
`useEffect`, wires Zustand subscriptions, and **disposes everything** on
unmount. Overlay chrome (`GizmoToolbar`, `MeasureBanner`, …) stays React.

The viewport is **lazy-loaded** so Cut List does not pay for Three.js up front.

### Sync order

On document/UI changes:

1. `builder.sync(...)` — geometry, materials, transforms, visibility
2. Selection overlay (`decorated()` is empty in Render mode)
3. Gizmo attach/detach

Render mode must not bake halos or gizmos into PNG export.

### Dispose rules

- Every controller/manager exposes `dispose()` and is called from the Viewport
  effect cleanup
- Unit geometries and PBR materials are **cache-owned** — never dispose them
  when removing a single part node
- Selection halos share one material; they carry no `partId` and disable
  `raycast` so picking ignores them

### `viewportApi`

Module singleton set on mount / cleared on unmount. Toolbar and Properties call
framing, export, floor-snap, group-resize, and snap-together **without**
threading refs through React. Prefer `viewportApi()` + optional chaining when
the chunk may not be ready yet.

### Picking

- Pointer listeners attach to the **canvas**, not the container (toolbar
  siblings would clear selection otherwise)
- Marquee is armed on pointerdown and only starts after ~5px move (so
  shift-click additive selection still works)
- three.js raycasting ignores `Object3D.visible` — click/drop paths must filter
  with `builder.visibleIds()` (BUG-010)
- Marquee already uses `visibleIds()`; keep that invariant

### Size vs placement

- Mesh local scale = part size (mm → m)
- Root transform = placement (position / quaternion / gizmo scale)
- A gizmo scale must not permanently clobber catalog dimensions; cabinet scale
  gestures convert to parametric rebuild when the full cabinet is selected

### Bounds

Selection halos are scaled ~1.045×. Measurement, camera framing, snap/align, and
selection-gap dimensions must use halo-excluding bounds helpers (`bounds.ts`),
not naive `Box3.setFromObject`.

---

## 6. React / UI

### Exports and components

- **Named exports only** — no `export default` in `src/`
- Function components with explicit prop types (no `React.FC`)
- Prefer the `function` keyword for pure helpers
- UI primitives live in `src/ui/primitives/` and reuse theme tokens

### Zustand in components

Use **narrow selectors**:

```ts
const viewMode = useUiStore((s) => s.viewMode);
const groups = useDocumentStore((s) => s.groups);
```

Outside React (actions, controllers), use `useXStore.getState()`.

Avoid `useDocumentStore()` without a selector in hot paths — it re-renders on
every document field change.

### Styling

- Tailwind utility classes on components; tokens from `theme.css`
  (`bg-panel`, `text-ink`, `bg-accent`, `border-hairline`, …)
- Fonts: Space Grotesk (display), IBM Plex Mono (numeric), system sans
- Base element resets **must** stay inside `@layer base` or they defeat
  Tailwind utilities (see comment in `theme.css`)
- Never assemble CSS strings inside the store

### Keyboard shortcuts

`useKeyboardShortcuts`:

- No-op when focus is `INPUT` / `TEXTAREA` / `SELECT` / contentEditable
- Only active in Model mode
- Modifiers: Cmd/Ctrl+Z (undo), Shift+Cmd/Ctrl+Z (redo), Cmd/Ctrl+A, Cmd/Ctrl+D
- Modes: Q/Esc select, H pan, G/M translate, R rotate, S scale, F frame,
  Delete/Backspace delete

### Feedback

User-visible outcomes go through `showToast(...)`. Destructive New File confirms
with `window.confirm` when the document has content.

---

## 7. TypeScript

Observed conventions (also enforced by `tsconfig.json`):

- Prefer **`type`** aliases — do not introduce `interface` or `enum`
- String unions and `as const` objects for closed sets
- `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax`
- Path alias `@/*` → `src/*` (tsconfig + Vite)
- Use `import type` for type-only imports
- Avoid `any` / unnecessary `as` / `!` — prefer narrowing and existing domain types

---

## 8. Naming

| Kind | Pattern | Example |
| --- | --- | --- |
| React components / imperative classes | PascalCase files | `Viewport.tsx`, `SceneManager.ts` |
| Modules / hooks | camelCase files | `documentStore.ts`, `useKeyboardShortcuts.ts` |
| Unit tests | co-located `*.test.ts` | `bom.test.ts` |
| E2E tests | `e2e/*.spec.ts` | `smoke.spec.ts` |
| Part ids | `custom-${Date.now().toString(36)}-${seq}` | `custom-m5x1k-1` |
| Group ids | `group-${Date.now().toString(36)}-${seq}` | `group-m5x1k-1` |
| Version ids | `v${Date.now().toString(36)}` | `v-m5x1k` |
| Catalog ids | stable kebab / short tokens | `base-600`, `brushed-brass` |

Mesh identity: `root.name` and `userData.partId` equal the part id.

---

## 9. Persistence

Autosave, Save to File, Open File, and Version History downloads share one
envelope: `{ schemaVersion, doc }` (`localStorage` key `forma:doc`, files
`.forma.json`). `migrate()` in `src/store/persistence.ts` is the only load
door. Preferences (`forma:displayUnit`, `forma:gridSize`) are separate keys
and are **not** schema-versioned.

- **Current schema: 5** (KNOXHULT/ASPUDDEN appearance defaults: white panels,
  matte-black hardware)
- Schema 4 migrates by applying those appearance defaults, then `normalize`
- Schema 3 migrates (world-aligned dims, manufacturing metadata, axis fixes)
  then the schema-4 appearance step
- Schema &lt; 3 and unknown versions are unmigratable → `null` → empty document
  / Open File error. Do not guess a mapping from the old parametric sideboard.
- Autosave is debounced (600ms) with a `beforeunload` flush; failures set save
  status to `error`
- Save Version keeps a checkpoint in this browser. Version History can download
  `{title} - Version N.forma.json` using the same envelope.

### Keep saved files loading

`normalize` / `migrate` must stay defensive: clamp dims, drop bad parts, dedupe
ids, repair missing transforms. Extra JSON fields are ignored. On **current-
schema** load: do **not** overwrite user grain/edge banding (BUG-008); do **not**
infer cabinets from labels when `cabinet` was cleared (BUG-009).

When a PR touches `FormaDocument` / `CustomPart` fields, catalog ids, or
`normalize*`, classify the change:

| Kind of change | What to do |
|---|---|
| New library item, optional field, or `shape` old files never stored | No schema bump. Teach `normalize` / `normalizePart` to accept it. Keep stored millimetres; do not overwrite from the catalog. |
| Rename a preset id (`base-900` → `base-800`) | Add an alias in `CABINET_PRESET_ALIASES`. No schema bump. |
| Rename, remove, or reinterpret a stored field (axes, units, nested shape) | Bump `SCHEMA_VERSION`. Add a `migrate` branch that converts the old envelope. Leave previous cases working. |
| New insert defaults (METOD sizes, hang height, finishes) | Apply on **new** inserts only. Do not rewrite saved millimetres on current-schema load. |

A PR that would change millimetres or group membership of an existing file is a
schema bump plus a migrator, not a silent rewrite.

### Tests for old files

- Round-trip current schema: mutate a document, `migrate({ schemaVersion: SCHEMA_VERSION, doc })`, assert parts/groups/millimetres (see grain and demotion tests in `persistence.test.ts`)
- Keep a `migrate` case for every supported schema (3, 4, 5) and assert `schemaVersion: 999` stays `null`
- E2E Open File already loads a schema-4 fixture; add a fixture per schema you still support when the document shape changes

---

## 10. Testing

| Kind | Location | Runner | Scope |
| --- | --- | --- | --- |
| Unit | `src/**/*.test.ts` | Vitest (`environment: 'node'`) | Domain math, store/actions/history/persistence, pure viewport helpers |
| E2E | `e2e/smoke.spec.ts` | Playwright | Boot, insert/delete, cabinets, persistence reload, no console errors |

Conventions:

- Unit tests hydrate stores in `beforeEach` and assert store/domain state
- Persistence changes need a `migrate` / round-trip test for every schema still
  supported (see §9)
- E2E prefers roles (`getByRole('tab' | 'button' | 'treeitem')`)
- Dev/preview/e2e server port is **pinned to 5199** (`strictPort`) so tests never
  attach to another project’s Vite server
- `npm run build` runs `tsc --noEmit` then Vite build — keep the typecheck green

When fixing a bug, add a regression test next to the failing layer whenever the
behaviour is unit-testable without a full WebGL harness.

---

## 11. Gotchas checklist

Read these before changing picking, history, cabinets, or materials:

1. **Marquee is lazy** — arm on pointerdown, start after movement threshold
2. **Pointers on the canvas only** — not the viewport container
3. **Shared geometries/materials** — dispose only from caches on teardown
4. **Halos inflate bounds** — exclude them from measure/frame/snap/gap boxes
5. **`preserveDrawingBuffer: true`** — required for PNG export
6. **Metadata outside `commit()`** — patch history with `syncHistoryDocumentMeta()`
7. **Demoted cabinets** — missing `cabinet` on a current-schema group means “regular group”
8. **Hidden ≠ unpickable in three.js** — filter with `visibleIds()`
9. **Unlayered base CSS breaks buttons** — keep resets in `@layer base`
10. **Empty canvas is intentional** — do not restore the parametric sideboard
11. **Magnet is object-face snap** — the 100 mm grid is Shift-held translation only; do not wire `setTranslationSnap(0.1)` to the magnet toggle
12. **Saved files** — load only through `migrate()`; bump `SCHEMA_VERSION` when stored meaning changes; never rewrite current-schema millimetres from the catalog (see §9)

---

## 12. Bugs and improvements

- New reproducible defects → next `BUG-###` in [`BUGS.md`](./BUGS.md) (full
  template while open; summary row when resolved)
- Non-bug follow-ups → next `IMP-###` in [`IMPROVEMENTS.md`](./IMPROVEMENTS.md)
- Do not invent tracker entries in PR descriptions only — write them in those
  files so the next agent can find them

---

## 13. Change workflow (agents)

1. Branch as `cursor/<descriptive-name>-25a8` (lowercase)
2. Keep diffs focused — no drive-by refactors or unrelated doc churn
3. Match existing naming, types, and immutability style
4. Add or update tests for behaviour you change
5. Run `npm run typecheck` and `npm test` before you finish
6. Update `BUGS.md` / `IMPROVEMENTS.md` when you fix or discover items
7. Commit with a message that states *why*, push, and open/update the PR
