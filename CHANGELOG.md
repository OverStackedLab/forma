# Changelog

All notable changes to Forma are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Save to File picks a folder. On Chromium the first save opens the native dialog for folder and name, then remembers that file: later saves overwrite it in one click instead of piling up `Design (1).forma.json` copies in Downloads. Renaming the design re-asks, so Save never writes a stale filename.
- Browsers without the File System Access API (Firefox, Safari) keep the download path and are asked for a name in-app on the first save, so nothing is written as `Untitled Design.forma.json`. Either way a name is collected once, never twice.
- A save is never lost: if the native dialog cannot open, or its write fails afterwards, the download runs instead (BUG-026).
- BORGHAMN square-bar handle in the hardware library (170 mm, 160 mm centres, IKEA 203.160.46) (IMP-018).

## 2026-08-28

### Added

- Measure works alongside the move, rotate and scale gizmos, so a resize can be measured while it is happening (BUG-040).
- AXSTAD-style glass doors in the Fronts library: 400/600 × 800/1000 mm, 19 mm thick, with a 78 mm shaker frame and an inset glass pane (IMP-017).
- IKEA KNOXHULT / ASPUDDEN panel colors (Oak, Dark Gray, Dark Gray-Green, White) and hardware finishes (Brushed Brass, Matte Black, Brushed Steel, White).
- BAGGANÄS knob and ENERYDA bow-pull geometry in the hardware library.
- ENHET cabinet legs (IKEA 104.490.18, 125 mm) in the hardware library.
- Oak wood-grain texture for the Oak color.
- Walnut color with photographed grain, mapped like Oak.
- Drag a group in Assembly to reorder cabinets. Shift-click (or ⌘-click) a group row adds it to the selection (IMP-013).
- Selecting two pieces or groups draws the clearance between them in the viewport.
- Selecting one piece or group draws clearance to the nearest facing neighbour in each direction, so a panel can be placed without picking a second object.
- Click a clearance label to type the gap. The same parts the move gizmo drives (the selection, or the second of two units) move to match.
- Cabinet shelf placement by explicit height or even spacing.
- Cabinet vertical panels by explicit offset from the left or even spacing. Shelves split into bays around them.
- Favicon from the toolbar F mark.
- Google Analytics 4 (`G-X3H2JF8SQN`) on production builds.
- Toolbar buttons to hide the left and right sidebars.
- Live object-face snapping while moving (60 mm capture, on-face guide). Hold Shift for the 100 mm grid.
- Document title derived from the on-disk save/open filename.
- Save Version keeps a checkpoint in this browser. Version History can download `{title} - Version N.forma.json`.
- Align Left / Centres / Right, Front / Back, and Tops / Bottoms for two selected pieces or groups. The first stays fixed and only that axis moves, so a wall cabinet can share a floor cabinet's edge without leaving its hang height (IMP-008).
- True orthographic Front, Side and Top views (no perspective foreshortening). 3D and Frame stay in perspective. Left-drag pans in those elevations (IMP-009).
- 3D camera button next to Front / Side / Top.
- Restore cabinet on a rigid group that still has a carcass, so a saved design that lost Add Shelf can get it back. Opening the file does not rewrite groups on its own (BUG-009).
- Arrow keys nudge the selection while the move gizmo is active. Front and Side follow the view; 3D and Top stay on the floor. One display unit per tap, Shift for 100 mm.
- Selecting a cabinet (or a fully selected group) draws overall width, height, and depth in the viewport so a lone carcass still shows its size (IMP-012).
- Flush faces, and a moving group lining up with another group, draw alignment witnesses in the brass accent while the move gizmo is on (IMP-014).
- With the scale gizmo on, overall W/H/D labels can be typed to resize the selection (IMP-015).

### Changed

- Panel W/H/D all span 3–3000 mm on a 1 mm step, so 8 mm backs, 18 mm sides and 32 mm knob diameters are reachable and survive a reload (BUG-012).
- Losing cabinet controls is explained: an edit that leaves a carcass the cabinet can't regenerate now says so and points at Restore cabinet, and Properties warns before a per-part resize does it (BUG-020).
- Overall width/height/depth witnesses draw only while the scale gizmo is on, matching alignment witnesses, which draw only while the move gizmo is on (BUG-038, reversing IMP-012's always-on preview).
- Inserting a piece from the Library frames it, so it can't land off-screen on a wide design. Dragging one in keeps the current camera (BUG-036).
- Keyboard hints follow the platform: `Ctrl+D` / `Ctrl+A` off macOS, `⌘D` / `⌘A` on it (BUG-041).
- The 3D view button sits to the left of Front.
- With two pieces or groups selected, the gizmo moves only the second so the first stays put and the clearance updates (same order as Align).
- Default display unit is centimetres. Domain values stay millimetres.
- Prebuilt cabinets use IKEA METOD frame sizes: Base 400/600/800 (800 × 600), Wall 600/800 (800 × 370, hung at 1400 mm), High 600 (2200 × 600). Loose side, divider, back, and door presets match the 800 mm carcass. Older library ids still load.
- Library splits **Panels** and **Fronts** into separate sections.
- Default appearance is white panels and matte-black hardware (schema 5 migration for autosaved docs).
- Finish UI copy is **Color** / **Hardware**.
- The magnet toggle is object snap, not the 100 mm grid. Rotation and scale increments still follow the toggle.
- Save Version no longer shrinks in the toolbar.
- Docs live under `docs/`.
- Duplicate copies the current selection. A fully selected cabinet still clones with Add Shelf; a single shelf or carcass piece copies only that piece (BUG-022). Duplicating an interior panel adds the next free centreline like Add Panel (BUG-024).
- Assembly group rows no longer have a checkbox. Shift-click or ⌘-click still adds or removes the whole group.

### Fixed

- Duplicating two or more cabinets copies each as a configurable cabinet instead of a pile of loose panels (BUG-019).
- Cut-list labels beginning with `=`, `+`, `-` or `@` no longer become live formulas when the CSV is opened in Excel or Google Sheets (BUG-011).
- The exported CSV carries a UTF-8 BOM, so Excel on Windows shows the hardware grain em dash instead of `â€"` (BUG-013).
- Typing a width, height or depth on a viewport witness now resizes the axis the label is drawn along. On a rotated part it used to resize a different axis — typing W on a door turned 90° changed its depth (BUG-037).
- Selection dimension labels no longer stack on top of each other; overlapping measurements are pushed apart, or hidden when there is no room (BUG-039).
- Moving one bay's shelf in a cabinet with an interior panel no longer invents a second shelf row (a later Add Shelf produced six shelves instead of three). The cabinet demotes to a plain group when a row can no longer be described parametrically; Restore cabinet brings the controls back (BUG-029).
- Deleting one shelf of a multi-bay row no longer deletes the facing bay's shelf with it (BUG-030).
- Dragging or nudging a selection past the ±10 m limit moves it as one rigid structure instead of flattening every panel onto the boundary plane (BUG-031).
- Cabinets whose shelves fall on fractional even spacing (High 600) keep their catalog preset through a size change and still redistribute shelves when the height changes (BUG-032).
- Scaling one cabinet panel with the gizmo demotes the cabinet like a typed dimension edit, instead of silently discarding the change on the next rebuild (BUG-033).
- Typing the same position into several shelf or panel fields no longer stacks boards on one centreline and double-counts them in the cut list (BUG-034).
- Dragging a scale handle through a part's pivot leaves the part at its size instead of collapsing it to 1/1000 (BUG-035).
- Wall cabinets no longer sit on the floor when inserted; they hang so their top lines up with High 2200.
- Moving, rotating, or renaming a cabinet panel no longer strips shelf controls. Add Shelf stays available when any piece of that cabinet is selected.
- Deleting a generated shelf or interior panel keeps the cabinet configurable (BUG-014); only removing a carcass piece (side, top, bottom, or back) demotes it.
- Rotation sliders appear when a group or cabinet is selected and turn every member around the shared pivot (BUG-015).
- Position and rotation sliders stay available when several groups are selected together (BUG-016).
- Front, Side and Top are locked orthographic elevations instead of a perspective camera parked on those axes (IMP-009).
- A selected group's Y position is the underside on the floor, so a cabinet sitting on the grid reads 0 (BUG-017).
- Oak uses the photographed grain (lighter honey oak) instead of the procedural brown swatch.
- Add shelf and Space evenly fields show defaults (300 mm, 3 every 200 mm) and are wide enough to read.
- Add Panel and Add Shelf skip an occupied centreline and place the next free 100 mm slot, so a second click adds another instead of stacking on the first (BUG-021).
- Duplicating an interior cabinet panel places the next free centreline like Add Panel, so clearance reads from the facing inner face rather than the carcass outside (BUG-024).
- Add Shelf / Add Panel no longer remap existing panels onto new bay shelves or snap them back to stale centrelines (BUG-025). A gizmo or typed move writes that centreline into the cabinet so Properties and the next add keep it (BUG-028).
- Add Shelf and Add Panel stay at the top of Properties for a selected cabinet, including a single member or extra loose parts.
- Reload, Open File, and Restore Version frame every object in the scene (BUG-023).
- Save to File always downloads a `.forma.json` instead of using Chrome's save picker, which often failed after the dialog (BUG-026). Open File lists `.forma.json` files.
- New File offers Cancel, Don't save, or Save and continue. Save downloads a `.forma.json` copy before clearing the design.
- Open File loads older `.forma.json` files that used a UTF-8 BOM, a string schema version, a `document` key, or a bare document. Empty truncated saves say the write may not have finished instead of looking like garbage JSON (BUG-027).
- Alignment witnesses stay after a snap: they span the shared face (or the gap between boxes) instead of collapsing to a point, and a millimetre of overlap still counts as flush.

### Performance

- Selection witnesses recompute only when the document changes or a gizmo is dragging, instead of rebuilding every neighbour's world bounds on every frame (IMP-016).
- `commit()` compares document slices by reference and serializes only the ones that changed, and version reconciliation caches each checkpoint's serialized form. A gizmo release in a design with ten checkpoints no longer serializes eleven whole documents (IMP-001, IMP-016).
