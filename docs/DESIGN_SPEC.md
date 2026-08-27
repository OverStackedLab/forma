# Forma Design Reference

The visual and interaction specification Forma was built from, together with the
HTML prototype it describes. Treat it as the source of truth for colours,
typography, spacing and layout — those are final and still implemented as
written.

**Everything describing a parametric sideboard is historical.** The always-present
piece, its Width/Height/Depth/Leg Height/Panel Thickness drivers, and the Leg
Style / Handle Style / Base Style pickers were deliberately removed; the app now
starts from an empty scene. That pivot, and what replaced each piece of it, is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md). The spec is kept here because the chrome,
tokens and interaction rules around that piece are still what the app implements.

The app was originally named "Kerf" during design. The prototype under
`reference/` still shows the old name and wordmark — a historical artifact, left
as-is. The built app in `src/` uses Forma throughout.

---

## About the Design Files

The files in this bundle are **design references created in HTML** — a working prototype that demonstrates the intended look, layout, and behavior. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, Electron, etc.) using its established patterns, component library, and state management. If no environment exists yet, choose the framework most appropriate for the project and implement there.

Two important exceptions to "don't copy the code":

1. **`furniture-model.js` was the portable domain module.** Production truth is now `src/domain/` (`catalog.ts`, geometry builders, BOM). The reference file is historical — do not port it again.
2. **The three.js scene setup** (lighting rig, shadow config, OrbitControls tuning, TransformControls wiring, raycast picking, marquee projection math) is genuine implementation, not a mock. Treat it as a working reference implementation rather than a visual spec.

Everything else — the panel chrome, sidebars, toolbars, typography, the DOM overlay elements — is a visual specification to be rebuilt in the target framework.

## Fidelity

**High-fidelity, and functionally complete.** All colors, typography, spacing, and icons are final. The interactions are not simulated — the 3D viewport genuinely renders, the gizmos genuinely transform geometry, the cut list genuinely recomputes from the model, and both exports produce real files. Recreate the UI pixel-perfectly using the codebase's existing libraries and patterns.

---

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

**Right cluster** (`gap:6px`): unit toggle (cm · mm · in; default cm) · divider · Undo, Redo (32×32 icon buttons, disabled at 0.5 opacity / `rgba(238,233,226,.25)` when the stack is empty) · divider · Measure toggle · History toggle · divider · New File, Save to File, Open File · divider · **Save Version** primary button (`height:32px`, `padding:0 14px`, `border-radius:7px`, background `#C68A46`, text `#1A1815` 12.5px/700). New File confirms before replacing a non-empty or named design, resets document/history state, and preserves workspace preferences.

Icon button base: 32×32, `border-radius:7px`, transparent background, `rgba(238,233,226,.7)`. Active/toggled: background `rgba(198,138,70,.18)`, color `#C68A46`.

### 2. Left sidebar — Assembly tab

**Purpose:** browse and manage the part hierarchy.

Tab strip at top: two underline tabs (Assembly / Library), each `flex:1`, `height:40px`, 12px/600, `border-bottom:2px solid` — `#C68A46` when active with `#EEE9E2` text, transparent with `rgba(238,233,226,.5)` when not.

Header row beneath: part count on the left (`{n} selected` when there is a selection, otherwise `{total} parts`), and on the right "Select All" (11px/600, `#4FA3FF`) plus "Clear" (`rgba(238,233,226,.5)`) which appears only when something is selected.

Tree body: `flex:1`, `overflow-y:auto`, `padding:10px 6px`. Five collapsible groups in fixed order — **Carcass, Base, Fronts, Hardware, Custom Parts** (the last only when custom panels exist).

- Group header: `height:30px`, `padding:0 8px`, `border-radius:6px`. A 14px checkbox (transparent fill, `#4FA3FF` check) sits left of a 16px `▾`/`▸` chevron; label 12px/600 `rgba(238,233,226,.85)`; count right-aligned, 10.5px IBM Plex Mono `rgba(238,233,226,.35)`. The checkbox adds or removes the whole group without replacing the rest of the selection. A dash means only some members are selected. The row highlight stays on when the group is fully included in a larger multi-select. Clicking the name still selects only that group.
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
- **View buttons** — top-right pill: 3D · Front · Side · Top · Frame. Front / Side / Top lock a true orthographic elevation (no foreshortening; left-drag pans). 3D restores the perspective ¾ view. Frame flies to the current selection (or the whole scene).
- **Measure banner** — top-center when measure mode is on: `background:rgba(26,24,21,.85)`, `color:#EEE9E2`, 11.5px, `padding:6px 14px`, `border-radius:20px`. Copy: "Click two points on the model to measure".
- **Measure label** — follows the midpoint of the measured segment, `transform:translate(-50%,-130%)`, `background:#1A1815`, `color:#4FA3FF`, IBM Plex Mono 11px, `border:1px solid rgba(79,163,255,.4)`, `border-radius:5px`, `pointer-events:none`. Content: `{n} {unit}`.
- **Selection dimensions** — one selected piece or group draws witness lines and a length label in `#4FA3FF` to the nearest facing neighbour in each direction. Two selected units lock that pair. Hidden in Render.
- **Marquee rectangle** — `border:1px solid #4FA3FF`, `background:rgba(79,163,255,.14)`, `pointer-events:none`, `z-index:6`.
- **Hint line** — bottom-left, 11px IBM Plex Mono `rgba(26,24,21,.5)`: "Drag to orbit · Shift-drag to box select · G/R/S transform · H pan · F frame · ⌘D duplicate · ⌘A select all · Del delete".
- **Render bar** — bottom-center, Render mode only: `background:rgba(26,24,21,.85)`, `border-radius:12px`, `padding:8px`. Camera preset buttons (3D / Front / Side / Top) at `rgba(255,255,255,.06)`, then a divider, then the `#C68A46` **Export Image** button.
- **Grid extent** — a typed numeric field in the bottom status bar. It follows the global mm/cm/in preference, accepts 100 mm (10 cm) increments from 1–20 m, and is kept with the other local viewport preferences rather than presented as furniture data.

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

Tab strip (Properties / Color) matching the left sidebar's underline style. Body `padding:16px`.

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
- *Multi-selection*: read-only chips showing the **combined bounding-box** dimensions, with the header reading `{n} parts selected`. Two or more selected parts share position and rotation sliders around the selection pivot. A group's **Y** is the underside of the combined box, so a cabinet on the floor reads 0.
- *Two selection units*: Align Left / Centres / Right, Front / Back, Tops / Bottoms (first stays fixed; only that axis moves) and Snap Together.

Action row (`display:flex; gap:8px; flex-wrap:wrap`), buttons `height:28px`, `padding:0 12px`, `border-radius:6px`, 11.5px: Clear selection · Reset transform · Duplicate (custom panels only) · **Delete** in the danger treatment (`border:1px solid rgba(220,90,90,.3)`, `background:rgba(220,90,90,.1)`, `color:#e08a8a`).

With nothing selected, a divider and the hint "Click a part in the viewport or the Assembly tree to inspect it."

### 6. Right sidebar — Color tab

**Purpose:** assign colors to the whole piece or to individual parts.

Scope chip at top: `#211E1A`, `border-radius:7px`, `border:1px solid rgba(255,255,255,.08)`, `padding:8px 10px`. Reads `Editing: {part name}` — or `Editing: Whole Piece` with no selection — plus a ✕ to drop back to whole-piece scope.

**Color** — one 2-column picker of complete appearance choices, so users never have to coordinate separate material and color controls. Panel options: Oak, Walnut, Dark Gray, Dark Gray-Green, White. Oak and Walnut swatches and 3D materials use photographed grain from `public/oak-grain.jpg` and `public/walnut-grain.jpg`. The underlying material/color pair remains an internal saved-file detail for backward compatibility.

Hardware uses the same one-choice interaction: Brushed Brass, Matte Black, Brushed Steel, White. Selecting hardware shows only hardware finishes; selecting panels shows only panel colors.

When a per-part override is active, a "Use design color" link in `#4FA3FF` at 11px appears under the grid. Multi-selections with different appearances show "Mixed colors" until one color is applied to the selection.

### 7. Cut List view

**Purpose:** a shop-ready bill of materials derived from the live model.

Replaces the viewport (`position:absolute; inset:0; background:#1E1B17; z-index:10; overflow-y:auto`). Content is centered at `max-width:1100px`, `padding:36px 32px 60px`.

Header: "Cut List" in Space Grotesk 22px/700, sub-line `Walnut Sideboard · {dims}` at 12.5px `rgba(238,233,226,.45)`, and an **Export CSV** button in the `#C68A46` primary treatment.

Three summary cards (`flex:1`, `#211E1A`, `border-radius:8px`, `padding:12px 14px`): **Sheets Needed** (with the sub-caption "2440×1220mm ply"), **Edge Banding** (meters, one decimal), **Parts** (total pieces). Value type is IBM Plex Mono 18px.

Matching parts are combined into quantity rows. Sheet Goods and Purchased Hardware appear in separate tables. Columns are Part, Qty, Finish, W, H, D, Thickness, Edge Band, and Grain. Edge banding names the actual exposed faces instead of assuming every edge; grain follows the part's editable manufacturing direction.

Sheet estimates are calculated separately for each finish and thickness, so an 8 mm back never shares a requirement with an 18 mm carcass panel. The sheet breakdown lists each requirement and the summary totals them.

The CSV export must serialize exactly what the table shows, including custom panels and deletions.

### 8. Status bar

`height:28px`, `#211E1A`, `padding:0 16px`, `gap:14px`, 11px IBM Plex Mono `rgba(238,233,226,.4)`. Left: selection breadcrumb — `Model · {Group} / {Part}`, or `Model · {n} parts selected`, or `Model · Nothing selected`. Then a `·` separator and the overall dimensions string. Right: a 6px `#6FBF73` dot and the word "Autosaved".

---

## Interactions & Behavior

### Selection
- **Click** a part in the viewport (raycast against the model group) or a row in the Assembly tree → select it. A viewport click on a grouped piece selects that piece, not the group (BUG-006).
- **Click empty space** → clear selection.
- **Shift-click** a part → add/toggle that part. Shift-click (or ⌘/Ctrl-click) a group row, or use the group checkbox, adds or removes every member.
- **One selected unit** draws clearance to the nearest facing neighbour in each direction (above/below, left/right, front/back), so a shelf can be moved on its own. A fully selected group is one body and does not dimension to its own members.
- **Two selected units** (two parts, two groups, or one of each) lock that pair. The first stays fixed; the gizmo attaches only to the second, so the gap updates while you move it (same order as Align).
- **Shift-drag** → marquee box select. Critical detail: the marquee must start **lazily on pointer *move*** once the pointer passes a ~5px threshold, *not* on pointerdown. Committing on pointerdown swallows shift-click additive selection, because a zero-movement shift-click then never reaches the raycast path. While the marquee is active, disable OrbitControls and re-enable on release. Hit test by projecting each visible part's world position to screen space and testing containment. Holding ⌘/Ctrl with the marquee adds to the existing selection instead of replacing it. An empty box clears the selection.
- **Select All** — the button or ⌘A. Must exclude deleted parts.
- Selection is always an array, even for one part. The gizmo attaches to a temporary group when more than one part is selected, except for exactly two selection units, where it drives only the second.

### Transform gizmos
Backed by three.js `TransformControls`. Modes: translate / rotate / scale, plus a Select mode with no gizmo and a Pan mode that switches OrbitControls' left mouse button to panning. OrbitControls must be disabled while a gizmo drag is in progress (`dragging-changed`). Transforms are persisted per part id in a `manualTransforms` map so they survive model rebuilds.

### Snapping
Toggle in the gizmo toolbar. When on, translation magnetically snaps to nearby part faces while dragging (60 mm capture, live face guide). Hold Shift to snap translation to the 100 mm grid instead. Rotation snap `Math.PI / 12` (15°) and scale snap `0.1` still follow the toggle.

### Measuring
Toggle in the toolbar. Click two points on the model; each click raycasts and records a hit point. Renders two 8 mm spheres and a dashed line in `#4FA3FF`, with a DOM label at the projected midpoint showing the distance in the current display unit. A third click starts a fresh measurement.

Selecting a piece or group draws SketchUp-style witnesses to the nearest facing neighbour in each direction. Selecting exactly two pieces or groups locks that pair instead. Touching or overlapping faces stay quiet. The overlay reads live mesh bounds so a gizmo drag stays truthful, and it hides in Render.

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
Clones are offset by 80 mm in X and Z, inherit material overrides and orientation, and become the new selection. A piece that belongs to a configurable cabinet duplicates the whole cabinet so Add Shelf stays available (BUG-018).

### Camera
Front, Side and Top switch to a locked **orthographic** camera (true elevation or plan, no foreshortening). Left-drag pans; orbit is disabled so the view cannot tilt. **3D** and **Frame** stay in perspective. `Frame` / `F` frames the current selection: expand a `Box3` over the selected meshes, take the center and a radius-derived distance (`clamp(radius * 3.2, 0.9, 6)`), and fly along a normalized `(0.8, 0.55, 0.9)` direction. Camera moves are eased by lerping position and target at `0.08` per frame rather than jumping.

### Version history
Saving captures dimensions, all style choices, materials, custom panels, deletions, and per-part overrides. Entries list a color dot keyed to the body finish, a label, a relative timestamp, and the dimension string. The current version is badged "Current" in `#6FBF73` on `rgba(111,191,115,.15)`; others get a "Restore" button in `#4FA3FF` on `rgba(79,163,255,.12)`. Restore replaces the whole scene state.

### Toasts
Bottom-center, `background:#26221D`, `border:1px solid rgba(255,255,255,.12)`, `border-radius:20px`, `padding:9px 18px`, 12.5px, with a 6px `#C68A46` dot. Enter animation `toastIn .2s ease` (fade + 10px rise). Auto-dismiss at 2600 ms.

### Exports
- **CSV** — build the rows, `Blob` with `type:'text/csv'`, object URL, synthetic anchor click, revoke after ~1s. Filename `cut-list.csv`.
- **PNG** — force a render, then `renderer.domElement.toDataURL('image/png')`. Requires `preserveDrawingBuffer:true`. Filename `sideboard-render.png`.

---

## State Management

*Superseded.* This is the prototype's state shape, including the parametric
drivers and `deletedFixedIds` that no longer exist. For what the app actually
stores today, see [`ARCHITECTURE.md`](./ARCHITECTURE.md) and section 3 of
[`CODING_STANDARDS.md`](./CODING_STANDARDS.md).

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

Panel colors: Oak `#d4b78f` (photographed grain) · Walnut `#6b4f3b` (photographed grain) · Dark Gray `#4a4a4c` · Dark Gray-Green `#3f4a42` · White `#f2f2f0`. Hardware: Brushed Brass `#b6884b` · Matte Black `#232323` · Brushed Steel `#9a9a9a` · White `#f2f2f0`. Each carries `roughness` and `metalness` for the PBR material — see `FINISHES` / `HARDWARE_FINISHES` in `src/domain/catalog.ts`.

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

Oak and Walnut grain photographs live in `public/oak-grain.jpg` and `public/walnut-grain.jpg`. Icons come from **Material Symbols Outlined** (Google Fonts) with a handful of inline SVGs in the toolbar mode switcher and export buttons; either source is fine to standardize on in the target codebase. Fonts are Google Fonts (Space Grotesk, IBM Plex Mono). 3D runtime is **three.js 0.184.0** plus the `OrbitControls` and `TransformControls` addons. If the codebase has its own icon set and type stack, substitute them — the glyph names above identify the intent.

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
