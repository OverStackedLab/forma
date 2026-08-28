# Forma Improvements

Tracked opportunities that are not bugs. Pick these up when they unblock a
feature, show up in profiling, or sit next to related work.

## Open improvements

### IMP-002 — Marquee selection tests part centres only

- **Area:** Viewport / Picking
- **Why it matters:** `PickController.finishMarquee` projects each part's world
  origin into screen space. A large panel whose centre sits outside the drag
  rect is missed even when most of its silhouette is inside; a small part whose
  centre sits inside is selected even when the mesh barely intersects the rect.
- **Direction:** Project each part's world AABB (halo-excluded) into screen
  space and test overlap with the marquee rectangle.

### IMP-003 — Render loop never idles

- **Area:** Viewport / SceneManager
- **Why it matters:** `requestAnimationFrame` runs continuously even when the
  camera, gizmos, and document are idle. Fine for short editing sessions; wasteful
  on battery-constrained machines and when the Cut List or an obscured tab is
  focused.
- **Direction:** Render on demand (controls `change`, document sync, gizmo drag,
  measure updates) with a short settle window after the last invalidation.

### IMP-004 — `halfExtentAlongNormalMm` ignores gizmo scale

- **Area:** Domain / Spatial
- **Why it matters:** `orientedHalfExtentsMm` accepts a scale factor;
  `halfExtentAlongNormalMm` does not. Callers today only pass freshly inserted
  presets at scale `[1,1,1]`, so behaviour is correct, but the APIs look like a
  matched pair and a future drop/snap of a scaled part would embed into the
  surface by the scale delta.
- **Direction:** Add an optional `scale` argument for symmetry, or document the
  unit-scale constraint at the call site.

### IMP-007 — Test coverage for recently fixed seams

- **Area:** Tests
- **Why it matters:** Unit tests now cover undo-after-save-version and
  persistence of cabinet manufacturing edits. Still thin: no automated coverage
  that hidden parts are ignored by click/drop raycasts, and e2e does not exercise
  demoted-cabinet reload.
- **Direction:** Add a PickController-focused unit or component test around
  `visibleIds()`, and a Playwright case that reloads after invalidating a cabinet.

## Improvement template

### IMP-### — Short summary

- **Area:**
- **Why it matters:**
- **Direction:**

## Resolved improvements

| ID | Summary | Resolution | Verified |
| --- | --- | --- | --- |
| IMP-008 | Align one object to another without forcing contact | Added Align Left / Centres / Right, Front / Back, and Tops / Bottoms for two selection units. The first stays fixed; the second matches one world AABB bound and other axes do not move, so a hanging wall cabinet can share a floor cabinet's edge. Covered by align unit tests and a Base 600 + Wall 600 browser regression. | 2026-08-20 |
| IMP-009 | Front, top and side camera views while modelling | Front / Side / Top switch to a locked orthographic camera (true elevation/plan, no foreshortening). 3D and Frame stay perspective. Left-drag pans in ortho; orbit is disabled so the view cannot tilt. Covered by ortho-frustum unit tests and model/render browser checks. | 2026-08-20 |
| IMP-010 | See the distance between two panels without freehand measure | One selected piece or group draws SketchUp-style witnesses to the nearest facing neighbour in each direction. Two selected units lock that pair. Covered by `selectionGap` / `dimensionNeighborIds` unit tests and two-shelf browser checks. | 2026-08-27 |
| IMP-011 | Set a clearance by typing the witness label | Click a selection-dimension label to type the gap in the current display unit. The gizmo's parts move along that axis (the selection, or the second of two units). Covered by `gapDeltaMm` / `parseLength` unit tests and a two-shelf browser check. | 2026-08-27 |
| IMP-012 | Preview the overall size of a cabinet | One selected cabinet (or fully selected group) draws overall W/H/D witnesses on the carcass AABB, further out than neighbour gaps. Labels are display-only unless the scale gizmo is on (IMP-015). Covered by `overallDimensions` unit tests and a Base 600 browser check. | 2026-08-27 |
| IMP-013 | Reorder cabinets in Assembly | Group checkboxes removed. Drag a group handle to reorder; Shift/⌘-click still adds a group to the selection. Covered by `reorderById` / `reorderGroups` unit tests and a Base 600 + Wall 600 browser check. | 2026-08-28 |
| IMP-014 | See when two objects line up | Flush facing faces, and a moving group whose min/max matches another group, draw SketchUp-style witnesses in the brass accent (`#C68A46`) at 0 mm, only while the move gizmo is on. Alignment lines span the shared face or the gap between boxes so they stay after a snap. Overlapping interiors stay quiet. Covered by `axisRelation` / `coplanarAlignments` unit tests and two-shelf plus Base 600 + Wall 600 browser checks. | 2026-08-28 |
| IMP-015 | Type overall size from the viewport | With the scale gizmo on, overall W/H/D labels are editable. A cabinet resizes parametrically; a single part writes catalog size; a rigid group scales around the shared pivot. Covered by `setSelectedOverallDim` unit tests and a typed-shelf browser check. | 2026-08-28 |
| IMP-005 | Cut-list CSV export hardening | `escapeField` apostrophe-prefixes text fields opening with `=`, `+`, `-`, `@`, tab or CR (numbers exempt), and the export blob carries a UTF-8 BOM so Excel decodes the em dash. Covered by `csv.test.ts` (BUG-011, BUG-013). | 2026-08-28 |
| IMP-006 | `CUSTOM_PANEL_LIMITS.w` fights real presets | All three axes are `{ min: 3, max: 3000, step: 1 }`, so 8 mm backs, 18 mm sides and 32 mm knobs are reachable and survive a reload. The stale "not enforced" comment is corrected (BUG-012). | 2026-08-28 |
| IMP-016 | Per-frame and per-commit work that scales with the whole document | The visible-id list is derived on document change instead of per frame; `SelectionDimensions.sync` short-circuits on an unchanged scene revision, selection and gizmo mode, so idle frames do no bounds work; `commit` compares store slices by reference before serializing, and version reconciliation caches each checkpoint's serialized form. | 2026-08-28 |
| IMP-001 | History clones and serializes the full version list on every commit | `fullSnapshot` shares immutable `SavedVersion` entries by reference instead of deep-cloning them per commit; `commit` compares store slices by reference and only serializes the ones that changed identity; `reconcileCurrentVersion` caches each checkpoint's serialized form in a `WeakMap`. Resolved with IMP-016. | 2026-08-28 |
| IMP-017 | Glass cabinet doors | AXSTAD-style fronts: 78 mm stiles, 19 mm thick, inset glass. Four METOD sizes (400/600 × 800/1000). Frame width stays 78 mm when the door is resized. Covered by `axstadGlassPieces` unit tests and a Library insert browser check. | 2026-08-28 |
| IMP-018 | Square-profile bar handle | BORGHAMN (IKEA 203.160.46): 10×10 mm bent square bar, 170 mm overall, 160 mm centres, 36 mm projection. Covered by `borghamnCenterline` / insert unit tests and a Library insert browser check. | 2026-08-28 |
