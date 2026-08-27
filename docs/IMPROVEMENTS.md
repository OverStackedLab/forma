# Forma Improvements

Tracked opportunities that are not bugs. Pick these up when they unblock a
feature, show up in profiling, or sit next to related work.

## Open improvements

### IMP-001 — History clones and serializes the full version list on every commit

- **Area:** Store / History
- **Why it matters:** Each `commit()` deep-clones `versions` twice and
  `JSON.stringify`s the whole document (including every saved version) for the
  no-op check and `reconcileCurrentVersion`. With many checkpoints of a large
  design, a single gizmo release does unnecessary work, and the undo stack
  retains independent clones of the version list.
- **Direction:** Share immutable version entries by reference in snapshots, or
  keep versions out of the geometry undo slice and track them as an append-only
  log with hashed reconcile keys.

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

### IMP-005 — Cut-list CSV export hardening

- **Area:** Cut List / CSV
- **Why it matters:**
  1. Labels beginning with `=`, `+`, `-`, or `@` become live spreadsheet formulas
     when the file is opened in Excel or Google Sheets (formula injection).
  2. Hardware rows use an em dash (`—`) for grain with no UTF-8 BOM, so Excel on
     Windows often shows `â€"` on double-click open.
- **Direction:** Prefix formula-like fields (e.g. with `'` or a space) in
  `escapeField`, and write `\uFEFF` at the export boundary (or use an ASCII
  placeholder in CSV output).

### IMP-006 — `CUSTOM_PANEL_LIMITS.w` fights real presets

- **Area:** Catalog / Properties
- **Why it matters:** Width limits are `{ min: 10, max: 3000, step: 5 }` while
  side/divider presets store 18 mm thickness on `w` and knobs use 32 mm diameter.
  Neither value sits on the 5 mm grid, so the W/Diameter slider cannot return a
  part to its factory size, and persistence clamps rewrite odd thicknesses on
  load. The comment above the constant still claims the limits are unused.
- **Direction:** Align `w` limits with thickness-capable axes (`min: 3`,
  `step: 1`), or use per-axis limits that depend on `thicknessAxis` / shape, and
  fix the stale comment.

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
