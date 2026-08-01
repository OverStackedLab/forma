# Forma — 3D Furniture Panel Designer

*The app was originally named "Kerf" during design; it has since been renamed to
Forma. The prototype under `reference/` still shows the old name and wordmark —
it's a historical artifact, left as-is. The built app in `src/` uses Forma
throughout.*

## Overview

Forma is currently a browser-based, empty-canvas furniture panel designer. A designer inserts shelves, sides, backs, dividers, doors, and knobs from a library; positions and sizes them precisely; groups and finishes parts; and generates a cut list that stays in sync with the scene.

Three top-level modes: **Model** (the editor), **Cut List** (auto-generated BOM with CSV export), and **Render** (clean presentation view with camera presets and PNG export).

The current implementation is a general panel assembly tool rather than the original parametric sideboard configurator. The detailed sideboard specification below is retained as historical design context; its overall-dimension drivers, generated carcass, leg styles, and handle styles are not current application behavior.

## About the Design Files

The files in this bundle are **design references created in HTML** — a working prototype that demonstrates the intended look, layout, and behavior. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, Electron, etc.) using its established patterns, component library, and state management. If no environment exists yet, choose the framework most appropriate for the project and implement there.

Two important exceptions to "don't copy the code":

1. **`furniture-model.js` is real, portable domain logic.** It is a dependency-free ES module containing the parametric layout math, the geometry builder, the part metadata registry, and the BOM/cut-list calculator. It has no framework coupling and only takes `THREE` as an injected argument. This file can and should be lifted more or less as-is — it is the single source of truth that keeps the 3D model and the cut list consistent. Porting it by hand risks silently desynchronizing them.
2. **The three.js scene setup** (lighting rig, shadow config, OrbitControls tuning, TransformControls wiring, raycast picking, marquee projection math) is genuine implementation, not a mock. Treat it as a working reference implementation rather than a visual spec.

Everything else — the panel chrome, sidebars, toolbars, typography, the DOM overlay elements — is a visual specification to be rebuilt in the target framework.

## Fidelity

**High-fidelity, and functionally complete.** All colors, typography, spacing, and icons are final. The interactions are not simulated — the 3D viewport genuinely renders, the gizmos genuinely transform geometry, the cut list genuinely recomputes from the model, and both exports produce real files. Recreate the UI pixel-perfectly using the codebase's existing libraries and patterns.

---

## Historical Parametric Sideboard Reference

## Application Shell

Fixed full-viewport layout, no page scroll (`html,body{margin:0;height:100%;overflow:hidden}`). Vertical flex column:

| Region | Size | Notes |
|---|---|---|
| Toolbar | `height:56px`, flex none | 3-column grid: `1fr auto 1fr` |
| Body | `flex:1`, min-height 0 | horizontal flex, `position:relative` |
| Status bar | `height:28px`, flex none | |

Body row, left → right:
- **Left sidebar** — `width:240px`, `#1E1B17`, `border-right:1px solid rgba(255,255,255,.08)`. Hidden (`display:none`) in Render mode.
- **Viewport** — `flex:1`, `position:relative`, background `linear-gradient(160deg,#E9E5DC 0%,#C9C3B6 100%)`. The only light surface in the app.
- **Right sidebar** — `width:300px`, `#1E1B17`, `border-left:1px solid rgba(255,255,255,.08)`, `overflow-y:auto`. Hidden in Render mode.

Version History is an absolutely-positioned overlay panel on the right (`width:320px`), translated off-canvas when closed (`transform:translateX(100%)`, `transition:transform .22s ease`, `box-shadow:-12px 0 32px rgba(0,0,0,.35)`, `z-index:20`).

---

## Screens / Views

### 1. Toolbar (always visible)

**Purpose:** identity, mode switching, global actions.

**Left cluster** (`display:flex; align-items:center; gap:14px`):
- Logo mark: 20×20, `border-radius:5px`, background `#C68A46`, centered letter "K" at 12px/700 in `#1A1815`.
- Wordmark "Kerf" — Space Grotesk 700, 18px, `letter-spacing:-.01em`, `#EEE9E2`.
- Vertical divider: `1px × 22px`, `rgba(255,255,255,.1)`.
- Document title block, `line-height:1.2`: name "Walnut Sideboard" at 13px/600 `#EEE9E2` (truncates with ellipsis); sub-line at 10.5px IBM Plex Mono `rgba(238,233,226,.4)` reading `{W} × {H} × {D} mm · Autosaved`.

**Center cluster** — segmented mode switcher, `justify-self:center`. Container: background `#1A1815`, `border:1px solid rgba(255,255,255,.08)`, `border-radius:9px`, `padding:3px`, `gap:2px`. Three pills (Model / Cut List / Render), each `padding:7px 16px`, `border-radius:7px`, 12.5px/600, `gap:6px`, with a 14px inline SVG icon. Active pill: background `#33302A`, text `#EEE9E2`. Inactive: transparent, `rgba(238,233,226,.55)`.

**Right cluster** (`gap:6px`): Undo, Redo (32×32 icon buttons, disabled at 0.5 opacity / `rgba(238,233,226,.25)` when the stack is empty) · divider · Measure toggle · History toggle · divider · **Save Version** primary button (`height:32px`, `padding:0 14px`, `border-radius:7px`, background `#C68A46`, text `#1A1815` 12.5px/700).

Icon button base: 32×32, `border-radius:7px`, transparent background, `rgba(238,233,226,.7)`. Active/toggled: background `rgba(198,138,70,.18)`, color `#C68A46`.

### 2. Left sidebar — Assembly tab

**Purpose:** browse and manage the part hierarchy.

Tab strip at top: two underline tabs (Assembly / Library), each `flex:1`, `height:40px`, 12px/600, `border-bottom:2px solid` — `#C68A46` when active with `#EEE9E2` text, transparent with `rgba(238,233,226,.5)` when not.

Header row beneath: part count on the left (`{n} selected` when there is a selection, otherwise `{total} parts`), and on the right "Select All" (11px/600, `#4FA3FF`) plus "Clear" (`rgba(238,233,226,.5)`) which appears only when something is selected.

Tree body: `flex:1`, `overflow-y:auto`, `padding:10px 6px`. Five collapsible groups in fixed order — **Carcass, Base, Fronts, Hardware, Custom Parts** (the last only when custom panels exist).

- Group header: `height:30px`, `padding:0 8px`, `border-radius:6px`. Chevron `▾`/`▸` at 10px in a 12px-wide slot; label 12px/600 `rgba(238,233,226,.85)`; count right-aligned, 10.5px IBM Plex Mono `rgba(238,233,226,.35)`.
- Part row: `height:28px`, `padding:0 10px 0 30px`, `border-radius:6px`, 12.5px. Default `rgba(238,233,226,.75)`; selected background `rgba(79,163,255,.16)` with `#EEE9E2` text. Trailing 20×20 eye button — Material Symbols `visibility` / `visibility_off` — at `rgba(238,233,226,.55)` visible, `rgba(238,233,226,.2)` hidden. The eye must `stopPropagation` so toggling visibility does not change selection.

### 3. Left sidebar — Library tab

**Purpose:** swap styles on the parametric piece, and drop new panels into the scene.

`padding:14px 12px`, `display:flex; flex-direction:column; gap:18px`. Four sections, each with an uppercase 11px/600 `rgba(238,233,226,.45)` header at `letter-spacing:.04em`:

- **Leg Style** — 3-up grid: Tapered Wood, Straight Wood, Hairpin Metal
- **Handle Style** — 3-up grid: Bar Pull, Knob, Recessed
- **Base Style** — 3-up grid: Legs, Plinth Base
- **Panels** — 2-up grid of insertable parts: Shelf, Side Panel, Back Panel, Door, Divider, Drawer Front

Option card: `border:1px solid rgba(255,255,255,.1)`, background `#211E1A`, `border-radius:8px`, `padding:10px 8px`, centered column, `gap:6px`, 18px icon, 11px label. Active card: border `#C68A46`, background `rgba(198,138,70,.14)`, label `#EEE9E2`.

All cards are `draggable="true"` and carry a `text/plain` payload of `{kind}:{id}`; the viewport is a drop target. Style cards apply on click; panel cards insert a new part on click or drop. Helper text at the bottom: "Click a style to apply it, or drag it onto the model."

### 4. Viewport

**Purpose:** the 3D editing surface.

Full-bleed WebGL canvas with DOM overlays:

- **Gizmo toolbar** — top-left, `position:absolute`, floating pill group. Buttons 34×34, `border-radius:8px`, `border:1px solid rgba(26,24,21,.12)`, background `rgba(255,255,255,.6)`, icon color `#1A1815`. Active: background and border `#C68A46`. Order: Select · Pan · Move · Rotate · Scale · | · Grid toggle · Snap toggle. Material Symbols glyphs: `arrow_selector_tool`, `pan_tool`, `open_with`, `rotate_right`, `resize`, `grid_on`, `swipe_left_alt`.
- **Frame button** — top-right, `height:30px`, `padding:0 12px`, `border-radius:7px`, `background:rgba(255,255,255,.6)`, `border:1px solid rgba(26,24,21,.15)`, 11.5px/600 `#1A1815`.
- **Measure banner** — top-center when measure mode is on: `background:rgba(26,24,21,.85)`, `color:#EEE9E2`, 11.5px, `padding:6px 14px`, `border-radius:20px`. Copy: "Click two points on the model to measure".
- **Measure label** — follows the midpoint of the measured segment, `transform:translate(-50%,-130%)`, `background:#1A1815`, `color:#4FA3FF`, IBM Plex Mono 11px, `border:1px solid rgba(79,163,255,.4)`, `border-radius:5px`, `pointer-events:none`. Content: `{n} mm`.
- **Marquee rectangle** — `border:1px solid #4FA3FF`, `background:rgba(79,163,255,.14)`, `pointer-events:none`, `z-index:6`.
- **Hint line** — bottom-left, 11px IBM Plex Mono `rgba(26,24,21,.5)`: "Drag to orbit · Shift-drag to box select · G/R/S transform · H pan · F frame · ⌘D duplicate · ⌘A select all · Del delete".
- **Render bar** — bottom-center, Render mode only: `background:rgba(26,24,21,.85)`, `border-radius:12px`, `padding:8px`. Camera preset buttons (Front / 3&frasl;4 Angle / Top) at `rgba(255,255,255,.06)`, then a divider, then the `#C68A46` **Export Image** button.

**Scene configuration** (units: three.js world units are meters; all UI values are millimetres — divide by 1000 at the geometry boundary):

- Camera: `PerspectiveCamera(35, aspect, 0.1, 50)`, default position `(2.5, 1.5, 2.7)`, target `(0, 0.4, 0)`.
- Renderer: `antialias:true`, `alpha:true`, `preserveDrawingBuffer:true` (required for PNG export), `shadowMap.enabled`, pixel ratio capped at 2.
- Lighting: `HemisphereLight(0xfff4e6, 0x3a3229, 1.0)`; key `DirectionalLight(0xfff2df, 2.4)` at `(3, 5, 2.2)` casting shadows with a 1024² map; fill `DirectionalLight(0xdfe8ff, 0.35)` at `(-3, 2, -2)`.
- Ground: 12×12 plane with `ShadowMaterial({opacity:0.24})`, rotated flat, receive-only.
- Grid: `GridHelper(4, 40, 0x4a4030, 0x6b5f48)`, `transparent`, `opacity:0.65` — 100 mm cells.
- OrbitControls: damping on at `0.08`, `minDistance:1.2`, `maxDistance:7`, `maxPolarAngle: Math.PI * 0.49` (prevents going under the floor).
- Selection highlight: a `BackSide` `MeshBasicMaterial` clone of the mesh geometry in `#4FA3FF` at `opacity:0.85`, scaled `1.045`, added as a child of the selected mesh.

### 5. Right sidebar — Properties tab

**Purpose:** read and edit dimensions, and act on the selection.

Tab strip (Properties / Materials) matching the left sidebar's underline style. Body `padding:16px`.

**Overall Dimensions** — always present, regardless of selection. Uppercase section header, then one control block per dimension (`padding:6px 2px 14px`): a label row with a 12.5px `rgba(238,233,226,.7)` name on the left and, on the right, a number input (58×22, `#26221D`, `border:1px solid rgba(255,255,255,.1)`, `border-radius:5px`, IBM Plex Mono 11.5px, right-aligned) plus a "mm" suffix — followed by a full-width `<input type="range">` with `accent-color:#C68A46`.

| Dimension | Min | Max | Step | Default |
|---|---|---|---|---|
| Width | 600 | 2400 | 10 | 1400 |
| Height | 400 | 1400 | 10 | 780 |
| Depth | 250 | 800 | 10 | 420 |
| Leg Height (legs base only) | 60 | 300 | 5 | 150 |
| Panel Thickness | 12 | 40 | 1 | 18 |

Slider and input are two views of one value and must stay bound in both directions. Footnote at 11px `rgba(238,233,226,.35)`: "Fronts, panels and legs scale automatically from these dimensions."

**Selected** — appears below a `1px rgba(255,255,255,.08)` divider only when something is selected. Shows the part name at 12.5px/600, then:
- *Fixed (parametric) part*: read-only W/H/D chips — `flex:1` cards, `#211E1A`, `border-radius:6px`, `padding:6px 8px`, 9.5px axis label over an IBM Plex Mono 12px value.
- *Custom panel*: the same three-up layout but as editable number inputs (`height:26px`, centered text), labelled "W (mm)" etc.
- *Multi-selection*: read-only chips showing the **combined bounding-box** dimensions, with the header reading `{n} parts selected`.

Action row (`display:flex; gap:8px; flex-wrap:wrap`), buttons `height:28px`, `padding:0 12px`, `border-radius:6px`, 11.5px: Clear selection · Reset transform · Duplicate (custom panels only) · **Delete** in the danger treatment (`border:1px solid rgba(220,90,90,.3)`, `background:rgba(220,90,90,.1)`, `color:#e08a8a`).

With nothing selected, a divider and the hint "Click a part in the viewport or the Assembly tree to inspect it."

### 6. Right sidebar — Materials tab

**Purpose:** assign finishes to the whole piece or to individual parts.

Scope chip at top: `#211E1A`, `border-radius:7px`, `border:1px solid rgba(255,255,255,.08)`, `padding:8px 10px`. Reads `Editing: {part name}` — or `Editing: Whole Piece` with no selection — plus a ✕ to drop back to whole-piece scope.

**Body Finish** — 5-up swatch grid. Swatch: `height:40px`, `border-radius:6px`, `border:2px solid rgba(255,255,255,.12)`, becoming `#4FA3FF` when active. 9.5px centered caption beneath. Options: Walnut, White Oak, Ash, Ebony Stain, White Lacquer.

**Hardware Finish** — 3-up grid, same treatment: Brushed Brass, Matte Black, Brushed Steel.

When a per-part override is active, a "Reset to piece default" link in `#4FA3FF` at 11px appears under the grid.

### 7. Cut List view

**Purpose:** a shop-ready bill of materials derived from the live model.

Replaces the viewport (`position:absolute; inset:0; background:#1E1B17; z-index:10; overflow-y:auto`). Content is centered at `max-width:900px`, `padding:36px 32px 60px`.

Header: "Cut List" in Space Grotesk 22px/700, sub-line `Walnut Sideboard · {dims}` at 12.5px `rgba(238,233,226,.45)`, and an **Export CSV** button in the `#C68A46` primary treatment.

Three summary cards (`flex:1`, `#211E1A`, `border-radius:8px`, `padding:12px 14px`): **Sheets Needed** (with the sub-caption "2440×1220mm ply"), **Edge Banding** (meters, one decimal), **Parts** (total pieces). Value type is IBM Plex Mono 18px.

Table: `border:1px solid rgba(255,255,255,.08)`, `border-radius:8px`, `overflow:hidden`. Columns `2fr .5fr 1.1fr .7fr .7fr .7fr .9fr .9fr` with `column-gap:10px` — Part, Qty, Material, W, H, D, Edge Band, Grain. Header row on `#211E1A` at 10.5px/600 uppercase; body rows in IBM Plex Mono 12px `rgba(238,233,226,.8)` separated by `1px solid rgba(255,255,255,.06)`. The Part column reverts to the UI sans.

Hardware summary underneath: a flex row at `gap:24px`, IBM Plex Mono 12.5px — Hinges, Drawer Slides, Pulls, Levelers, each count in `#EEE9E2`.

The CSV export must serialize exactly what the table shows, including custom panels and deletions.

### 8. Status bar

`height:28px`, `#211E1A`, `padding:0 16px`, `gap:14px`, 11px IBM Plex Mono `rgba(238,233,226,.4)`. Left: selection breadcrumb — `Model · {Group} / {Part}`, or `Model · {n} parts selected`, or `Model · Nothing selected`. Then a `·` separator and the overall dimensions string. Right: a 6px `#6FBF73` dot and the word "Autosaved".

---

## Interactions & Behavior

### Selection
- **Click** a part in the viewport (raycast against the model group) or a row in the Assembly tree → select it.
- **Click empty space** → clear selection.
- **Shift-click** → add/toggle a part in the selection.
- **Shift-drag** → marquee box select. Critical detail: the marquee must start **lazily on pointer *move*** once the pointer passes a ~5px threshold, *not* on pointerdown. Committing on pointerdown swallows shift-click additive selection, because a zero-movement shift-click then never reaches the raycast path. While the marquee is active, disable OrbitControls and re-enable on release. Hit test by projecting each visible part's world position to screen space and testing containment. Holding ⌘/Ctrl with the marquee adds to the existing selection instead of replacing it. An empty box clears the selection.
- **Select All** — the button or ⌘A. Must exclude deleted parts.
- Selection is always an array, even for one part; the gizmo attaches to a temporary group when more than one part is selected.

### Transform gizmos
Backed by three.js `TransformControls`. Modes: translate / rotate / scale, plus a Select mode with no gizmo and a Pan mode that switches OrbitControls' left mouse button to panning. OrbitControls must be disabled while a gizmo drag is in progress (`dragging-changed`). Transforms are persisted per part id in a `manualTransforms` map so they survive model rebuilds.

### Snapping
Toggle in the gizmo toolbar. When on: translation snap `0.1` (100 mm, matching the grid), rotation snap `Math.PI / 12` (15°), scale snap `0.1`.

### Measuring
Toggle in the toolbar. Click two points on the model; each click raycasts and records a hit point. Renders two 8 mm spheres and a dashed line in `#4FA3FF`, with a DOM label at the projected midpoint showing the distance in millimetres. A third click starts a fresh measurement.

### Keyboard
| Key | Action |
|---|---|
| `G` / `R` / `S` | Move / Rotate / Scale gizmo |
| `H` | Pan tool |
| `F` | Frame selection (falls back to framing the whole piece) |
| `Delete` / `Backspace` | Delete selection |
| `⌘/Ctrl + A` | Select all |
| `⌘/Ctrl + D` | Duplicate selected custom panels |
| `⌘/Ctrl + Z` / `⇧⌘Z` | Undo / Redo |

Suppress all shortcuts while focus is in an input.

### Deleting
Both parametric parts and custom panels can be deleted. Parametric deletions are recorded as a `deletedFixedIds` list that filters the rebuild, the assembly tree, the part count, Select All, and the cut list. Custom panels are removed from the `customParts` array.

### Duplicating
Custom panels only — attempting it on a parametric part shows the toast "Only library panels can be duplicated". Clones are offset by 80 mm in X and Z, inherit material overrides and orientation, and become the new selection.

### Camera
`Frame` returns to the default 3/4 view. `F` frames the current selection: expand a `Box3` over the selected meshes, take the center and a radius-derived distance (`clamp(radius * 3.2, 0.9, 6)`), and fly along a normalized `(0.8, 0.55, 0.9)` direction. Camera moves are eased by lerping position and target at `0.08` per frame rather than jumping.

### Version history
Saving captures dimensions, all style choices, materials, custom panels, deletions, and per-part overrides. Entries list a color dot keyed to the body finish, a label, a relative timestamp, and the dimension string. The current version is badged "Current" in `#6FBF73` on `rgba(111,191,115,.15)`; others get a "Restore" button in `#4FA3FF` on `rgba(79,163,255,.12)`. Restore replaces the whole scene state.

### Toasts
Bottom-center, `background:#26221D`, `border:1px solid rgba(255,255,255,.12)`, `border-radius:20px`, `padding:9px 18px`, 12.5px, with a 6px `#C68A46` dot. Enter animation `toastIn .2s ease` (fade + 10px rise). Auto-dismiss at 2600 ms.

### Exports
- **CSV** — build the rows, `Blob` with `type:'text/csv'`, object URL, synthetic anchor click, revoke after ~1s. Filename `cut-list.csv`.
- **PNG** — force a render, then `renderer.domElement.toDataURL('image/png')`. Requires `preserveDrawingBuffer:true`. Filename `sideboard-render.png`.

---

## State Management

```
dims: { width, height, depth, legHeight, thickness }   // millimetres
baseStyle: 'legs' | 'plinth'
legStyle: 'tapered' | 'straight' | 'hairpin'
handleStyle: 'bar' | 'knob' | 'recessed'
bodyMaterialId, hardwareMaterialId                      // finish ids
overrides: { [partId]: { body?, hardware? } }           // per-part material
customParts: [{ id, label, w, h, d }]                   // inserted panels
deletedFixedIds: [partId]                               // removed parametric parts
hiddenIds: [partId]                                     // eye toggles
selectedPartIds: [partId]
gizmoMode: 'select' | 'pan' | 'translate' | 'rotate' | 'scale'
snapEnabled, gridVisible, measureActive
measurePoints: [Vector3]
marquee: { x, y, w, h } | null
viewMode: 'model' | 'cutlist' | 'render'
leftTab: 'assembly' | 'library'
rightTab: 'properties' | 'materials'
historyOpen, toast
versions: [...], currentVersionId
```

Held outside reactive state (imperative, must survive rebuilds): `manualTransforms` keyed by part id, and the undo/redo stacks.

**Rebuild discipline.** Any change to the parametric params, overrides, custom parts, or deletions disposes and rebuilds the affected geometry. Three things must be reapplied after every rebuild, in order: visibility (`hiddenIds`), the selection highlight, and the gizmo attachment. Visibility in particular must live in state — storing it on the mesh means it is silently lost on the next rebuild.

**Known gaps** (deliberately unimplemented, worth deciding on early):
- Hardware counts in the cut list (hinges / slides / pulls) do not decrease when a door or pull is deleted.
- Gizmo transforms are not on the undo stack; only add, delete, and dimension changes are.
- Autosave is indicated in the UI but nothing is persisted.

---

## Design Tokens

### Color

| Token | Hex | Use |
|---|---|---|
| Canvas | `#1A1815` | app background, primary-button text |
| Panel | `#1E1B17` | sidebars, cut list, history panel |
| Surface | `#211E1A` | toolbar, cards, table header, chips |
| Input | `#26221D` | number inputs, toast background |
| Raised | `#33302A` | active segmented pill |
| Text | `#EEE9E2` | primary text |
| Text 75 | `rgba(238,233,226,.75)` | tree rows |
| Text 70 | `rgba(238,233,226,.7)` | control labels, icon buttons |
| Text 45 | `rgba(238,233,226,.45)` | section headers |
| Text 35 | `rgba(238,233,226,.35)` | footnotes, table counts |
| Accent | `#C68A46` | primary buttons, active states, sliders |
| Accent wash | `rgba(198,138,70,.14–.18)` | active card / toggled icon background |
| Selection | `#4FA3FF` | 3D highlight, marquee, links, measure |
| Selection wash | `rgba(79,163,255,.16)` | selected tree row |
| Success | `#6FBF73` | autosave dot, "Current" badge |
| Danger | `#e08a8a` | delete button text |
| Hairline | `rgba(255,255,255,.08)` | borders, dividers |

Viewport gradient `#E9E5DC → #C9C3B6` at 160°. Grid lines `#4a4030` / `#6b5f48`.

Finishes: Walnut `#4b3327` · White Oak `#c7a374` · Ash `#d9cdb6` · Ebony Stain `#211c19` · White Lacquer `#eef0ea`. Hardware: Brushed Brass `#b6884b` · Matte Black `#232323` · Brushed Steel `#9a9a9a`. Each carries `roughness` and `metalness` for the PBR material — see `FINISHES` / `HARDWARE_FINISHES` in `furniture-model.js`.

### Typography

- **Space Grotesk** (500/600/700) — brand mark and view titles only.
- **IBM Plex Mono** (400/500/600) — every number: dimensions, table cells, counts, status bar, measure labels.
- **System sans** (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) — all UI text.
- **Material Symbols Outlined** (`opsz,wght,FILL,GRAD@20,400,0,0`) — icons.

Scale: 22px/700 view title · 18px/700 wordmark · 13px/600 doc title · 12.5px/600 buttons and tabs · 12.5px control labels · 12px table body · 11.5px small buttons · 11px section headers (uppercase, `letter-spacing:.04em`) · 10.5px meta · 9.5px axis captions.

### Metrics

Spacing `2 · 4 · 6 · 8 · 10 · 14 · 16 · 18 · 22 · 32 · 36`px. Radii: 5 inputs · 6 rows and chips · 7 buttons and icon buttons · 8 cards and gizmo buttons · 9 segmented container · 12 render bar · 20 pills and toasts · 50% dots. Heights: 56 toolbar · 40 tabs · 34 gizmo and render buttons · 32 toolbar buttons · 30 group rows · 28 part rows and small buttons and status bar · 26 custom inputs · 22 inline number inputs.

Custom scrollbars: 8px, thumb `rgba(255,255,255,.14)` at `border-radius:4px`, transparent track.

---

## Assets

No image assets. Icons come from **Material Symbols Outlined** (Google Fonts) with a handful of inline SVGs in the toolbar mode switcher and export buttons; either source is fine to standardize on in the target codebase. Fonts are Google Fonts (Space Grotesk, IBM Plex Mono). 3D runtime is **three.js 0.184.0** plus the `OrbitControls` and `TransformControls` addons. If the codebase has its own icon set and type stack, substitute them — the glyph names above identify the intent.

---

## Files

The design prototype this document describes now lives under `reference/` and is
no longer part of the build:

| File | Contents |
|---|---|
| `reference/Furniture Designer.dc.html` | The original prototype — markup, styling, three.js scene, and all interaction logic. Open it directly in a browser to compare behaviour. |
| `reference/furniture-model.js` | The original portable domain module, ported to `src/domain/`. |
| `reference/support.js` | The prototyping runtime. Not used by the app. |

---

# The application

The spec above is implemented in `src/` as a React + Vite + TypeScript app.

## Running it

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # typecheck + production bundle
npm run test       # domain unit tests (vitest)
npm run test:e2e   # browser smoke tests (Playwright)
```

## Structure

| Path | Role |
|---|---|
| `src/domain/` | Framework-free and pure. Never imports React or three.js at module scope — `THREE` is injected — so it unit-tests in Node and three.js stays code-splittable. `computePartSpecs()` is the single flat list of live parts that the mesh builder, assembly tree, part count, Select All and the BOM all consume, which is what keeps deletions honoured everywhere at once. |
| `src/store/` | `documentStore` holds the undoable, persisted document; `uiStore` holds ephemeral UI state. All mutations go through `commit()` in `history.ts`, which snapshots the entire document slice. `persistence.ts` autosaves to `localStorage` behind a schema version. |
| `src/viewport/` | The three.js layer, lazy-loaded. `SceneManager` owns the renderer and loop; `ModelBuilder` diff-updates the scene from part specs; the controllers handle gizmos, picking, measuring and camera flight. |
| `src/ui/` | Presentational React components. Styling is Tailwind classes on components — never CSS strings assembled in the state layer. |

## Deviations from the spec above

Three deliberate departures, each fixing a defect the spec's approach caused:

1. **`manualTransforms` lives in the document store**, not outside reactive state.
   That is what puts gizmo moves on the undo stack, into autosave and into
   version snapshots. Transforms commit once on gizmo release, not per frame.
2. ~~Hardware counts derive from surviving part ids, so deleting a door drops
   its hinges.~~ Superseded — see the pivot below; there's no more hardware to
   count.
3. **Render mode hides the selection halo and gizmo**, so neither is baked into
   an exported PNG.

Marquee hit-testing still projects each part's centre, per the spec, so a large
panel whose centre falls outside the box is missed. Projecting the eight
bounding-box corners instead is the obvious follow-up.

## Post-launch pivot: the parametric sideboard is gone

The spec above — and the first several iterations of this app — modeled a
**parametric sideboard**: fixed panels, doors and drawers computed from
Width/Height/Depth/Leg Height/Panel Thickness, plus Leg Style, Handle Style
and Base Style pickers that reskinned it. That whole system has since been
removed. The app now starts from a genuinely **empty scene**; the library
panels (Shelf, Side Panel, Back Panel, Divider) are the *only* way to add
geometry, and every part in the document is one of them.

This was a deliberate, user-requested removal, not a regression — the leg/
handle/base style pickers only made sense as controls *for* the parametric
piece, so once that piece was gone, showing them was actively confusing.
Everything downstream of "there is always exactly one sideboard" came out
with it:

- `computeLayout`, `buildFurnitureModel`'s leg/handle mesh builders,
  `deletedFixedIds`, `PartGroup`/tree grouping, and the Width/Height/Depth/Leg
  Height/Panel Thickness sliders are all deleted rather than dormant —
  nothing in `src/domain/` computes a carcass anymore.
- **Hardware is gone entirely**, not just its counting bug. With no doors,
  drawers, legs or handles, there's nothing hardware-class left — no Hardware
  Finish swatches, no hinges/slides/pulls/levelers row in the Cut List.
  `bodyMaterialId` became `defaultFinishId`: the finish newly inserted panels
  start with, not "the piece's" finish, since there is no piece.
- The Assembly tree is a flat list — the five-group hierarchy
  (Carcass/Base/Fronts/Hardware/Custom Parts) doesn't apply when every part is
  the same kind of thing.
- Saved documents bumped from schema 1 to schema 2. A schema-1 save (sideboard
  dims, leg/handle/base style, deleted-fixed-ids) has no sensible mapping onto
  a panels-only scene — what would you do with its doors and legs? — so
  `persistence.ts` treats it as unmigratable and falls back to a fresh empty
  document rather than guessing.

If a future request wants doors, drawers or hardware back, they'd need to
re-enter as their own library panel presets (the way Shelf/Side Panel/Back
Panel/Divider work today), not as a revived parametric carcass — that's the
shape the rest of the app is now built around.
