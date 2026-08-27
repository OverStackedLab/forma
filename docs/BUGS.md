# Forma Bug Log

Use this file to record reproducible app problems. Give each new bug the next
number (`BUG-001`, `BUG-002`, and so on), then move it to the resolved table
when the fix has been verified.

## Open bugs

### BUG-011 — CSV formula injection through part labels

- **Status:** Open
- **Severity:** Low
- **Found:** 2026-08-08
- **Area:** Cut List
- **App version or commit:** main @ review
- **Frequency:** Always (when a label starts with a spreadsheet trigger)

#### Steps to reproduce

1. Rename a part to `=HYPERLINK("http://example.com","Shelf")`.
2. Open Cut List → Export CSV.
3. Open `cut-list.csv` in Excel or Google Sheets.

#### Expected behavior

The label is plain text in the spreadsheet.

#### Actual behavior

The cell becomes a live formula. `escapeField` handles RFC 4180 quoting but does
not neutralize `=`, `+`, `-`, or `@`. See also IMP-005.

#### Notes and evidence

`src/domain/csv.ts` → `escapeField`. Labels are user-editable via `renamePart`.

#### Resolution

Leave blank until fixed.

### BUG-012 — Custom panel W limits cannot represent factory thicknesses

- **Status:** Open
- **Severity:** Low
- **Found:** 2026-08-08
- **Area:** Panels / Properties
- **App version or commit:** main @ review
- **Frequency:** Always

#### Steps to reproduce

1. Insert a Side Panel (18 mm on W) or Knob (32 mm diameter).
2. Open Properties and drag the Width / Diameter slider, then try to return to
   the original value.

#### Expected behavior

Factory sizes (18 mm, 32 mm) are reachable; thin W thicknesses down to sheet
stock (e.g. 8 mm) are allowed where H/D already allow 3 mm.

#### Actual behavior

`CUSTOM_PANEL_LIMITS.w` is `{ min: 10, max: 3000, step: 5 }`, so 18 and 32 are
not on the grid. Persistence also clamps loaded dimensions to these limits.
See also IMP-006.

#### Notes and evidence

`src/domain/catalog.ts` (`CUSTOM_PANEL_LIMITS`), `setCustomPartDim`,
`persistence.normalizePart`.

#### Resolution

Leave blank until fixed.

### BUG-013 — CSV em dash garbles in Excel without a UTF-8 BOM

- **Status:** Open
- **Severity:** Low
- **Found:** 2026-08-08
- **Area:** Cut List
- **App version or commit:** main @ review
- **Frequency:** Always on Excel / Windows default open

#### Steps to reproduce

1. Insert a Knob (or other hardware).
2. Export the cut list CSV.
3. Double-click the file open in Excel on Windows.

#### Expected behavior

The Grain column shows an em dash or a clear ASCII placeholder.

#### Actual behavior

Hardware grain is `—` (U+2014) with no BOM; Excel often decodes as ANSI and
shows `â€"`. See also IMP-005.

#### Notes and evidence

`src/domain/bom.ts` grain placeholder; `CutList.tsx` export blob.

#### Resolution

Leave blank until fixed.

### BUG-019 — Duplicating two cabinets drops Add Shelf on the copies

- **Status:** Open
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Panels
- **App version or commit:** dev @ 06df283
- **Frequency:** Always (⌘D with two cabinets selected)

#### Steps to reproduce

1. Insert two Base 600 cabinets.
2. Shift-select both group rows in Assembly.
3. Press ⌘D (the Duplicate button is hidden because the selection is not one group).

#### Expected behavior

Each copy is still a configurable cabinet with Add Shelf.

#### Actual behavior

`duplicateSelected` only groups a copy when the selection matches one group (or, after BUG-018, sits inside one cabinet). Two cabinets are cloned as loose parts. The copies have no `cabinet` config, so Add Shelf is gone.

#### Notes and evidence

`src/store/actions.ts` → `duplicateSelected`. `groupMatching` requires an exact single-group membership; `cabinetContainingSelection` requires every selected id to live in one cabinet. Keyboard shortcut still calls duplicate when the button is hidden (`useKeyboardShortcuts.ts`).

#### Resolution

Leave blank until fixed.

### BUG-020 — Changing one cabinet panel's size hides Add Shelf

- **Status:** Open
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Panels
- **App version or commit:** dev @ 06df283
- **Frequency:** Always

#### Steps to reproduce

1. Insert a Base 600.
2. Click a panel in the viewport. Add Shelf is still visible.
3. Change that panel's Width, Height, or Depth in Properties.

#### Expected behavior

Either the size sliders should not invite a carcass-breaking edit while Add Shelf is showing, or the cabinet should stay configurable.

#### Actual behavior

`invalidatePartiallyEditedCabinets` clears `cabinet` when a size edit hits some but not all members. Add Shelf disappears even though the user was still looking at cabinet controls. Moving, rotating, or renaming that panel does not demote (intentional); a dimension change does.

#### Notes and evidence

`src/store/actions.ts` → `setCustomPartDim` / `invalidatePartiallyEditedCabinets`. Properties shows both per-part dimension sliders and Add Shelf for a single selected member (`RightSidebar.tsx`). Related to BUG-014 (delete) and BUG-018 (duplicate).

#### Resolution

Leave blank until fixed.

## Bug template

### BUG-### — Short summary

- **Status:** Open
- **Severity:** Low / Medium / High / Critical
- **Found:** YYYY-MM-DD
- **Area:** Viewport / Panels / Hardware / Library / Cut List / Files / Other
- **App version or commit:**
- **Frequency:** Always / Sometimes / Once

#### Steps to reproduce

1. 
2. 
3. 

#### Expected behavior

Describe what should happen.

#### Actual behavior

Describe what happens instead.

#### Notes and evidence

Add screenshots, error messages, affected files, or anything else that helps
reproduce the problem.

#### Resolution

Leave blank until fixed. Record the change and how it was verified.

## Resolved bugs

| ID | Summary | Resolution | Verified |
| --- | --- | --- | --- |
| BUG-001 | Snap to Floor collapsed a full selection | Replaced per-part floor offsets with one offset calculated from the combined selection bounds, preserving the structure as a rigid selection. Covered by a two-part spacing unit test and a full-cabinet browser test. | 2026-08-01 |
| BUG-002 | Group properties did not appear when a group was selected | Exact group membership now resolves to the saved group in Properties. Selecting a group row shows its type, piece count, dimensions, configurable cabinet fields, and editable group-pivot position. Covered for regular and generated groups. | 2026-08-01 |
| BUG-003 | Groups and pieces could not be snapped together | Added Snap Together: the first selected piece/group stays fixed and the second moves to its nearest contacting face with one shared translation. Internal group layout, cabinet configuration, and undo are preserved. | 2026-08-01 |
| BUG-004 | A selected group could not be resized as one structure | Added typed overall width, height, and depth controls for regular groups. Each edit scales every member and its spacing around the shared group pivot in one undoable transform, follows the mm/cm preference, and leaves configurable cabinets on their parametric controls. Covered by shared-pivot unit tests, a full browser regression, and a live local-app check. | 2026-08-01 |
| BUG-005 | Cabinet dimensions stayed stale after gizmo resizing | The scale gizmo now reports its shared scale factor and a fully selected configurable cabinet converts that gesture into one parametric rebuild. Properties updates immediately, the member-centroid pivot stays fixed, 18 mm carcass and 8 mm back thicknesses are preserved, and Undo restores the prior dimensions. | 2026-08-01 |
| BUG-006 | Clicking a grouped piece selected the whole group | Viewport clicks and marquee selection now operate on the actual hit pieces. The Assembly group row remains the explicit whole-group selector, so individual and group properties are both reachable. Viewport readiness is also observable so group dimension controls appear reliably after lazy loading. | 2026-08-01 |
| BUG-007 | Undo after Save Version deleted the checkpoint | `saveVersion` / `renameDocument` skip `commit()` but history snapshots still carry versions and title. `syncHistoryDocumentMeta()` now patches stacked snapshots after those metadata writes, and undo/redo re-reconciles `currentVersionId`. Covered by history unit tests. | 2026-08-08 |
| BUG-008 | Reload reverted cabinet grain and edge-banding edits | Current-schema `normalizeSnapshot` no longer overwrites user-editable `grainAxis` / `edgeBanding` from a fresh cabinet layout. Legacy schema-3 migration still applies generated defaults. Covered by a persistence round-trip test. | 2026-08-08 |
| BUG-009 | Reload resurrected a demoted cabinet from its label | Cabinet label/member-count inference is limited to legacy (schema-3) loads. A current-schema group saved with `cabinet: undefined` after a partial edit stays a regular group on reload. Covered by a persistence round-trip test. | 2026-08-08 |
| BUG-010 | Hidden parts were still pickable | Click and drop raycasts now skip part ids absent from `ModelBuilder.visibleIds()`, matching marquee behaviour. three.js itself ignores `Object3D.visible`. | 2026-08-08 |
| BUG-014 | Deleting a cabinet shelf or interior panel hid shelf controls | `deleteParts` cleared `cabinet` whenever any member was removed, so Properties treated the leftover as a rigid group. Generated shelf and interior-panel deletes now update the parametric config and rebuild; deleting a carcass piece (side, top, bottom, or back) still demotes. Covered by actions unit tests. | 2026-08-19 |
| BUG-015 | A selected group had no rotation sliders | Properties already showed group position, but rotation fields only existed for a single part. Selecting a group or cabinet now shows Group Rotation (X/Y/Z); each axis turns every member around the shared centroid. Covered by a group-rotation unit test and a browser regression. | 2026-08-20 |
| BUG-016 | Selecting several groups hid all transform sliders | `groupMatching` only resolves an exact single-group membership, so Group Position/Rotation never mounted for two groups. Any multi-select of two or more parts now shows shared position and rotation sliders around the selection pivot; cabinet size sliders stay off so 18 mm panels are not squashed. Covered by multi-group unit tests and a two-cabinet browser regression. | 2026-08-20 |
| BUG-017 | Group Y Position was not 0 on the floor | Group Y used the member-origin centroid, so an 800 mm cabinet on the grid read ~400 mm. Y is now the underside of the combined AABB; X and Z stay the shared centre. Covered by domain and actions unit tests and a Base 600 group browser check. | 2026-08-22 |
| BUG-018 | Duplicating a cabinet member dropped Add Shelf | Viewport clicks select one piece (BUG-006) while Add Shelf still shows for that carcass. Duplicate now copies the containing cabinet, not the lone panel. Covered by an actions unit test and a Base 600 browser check. | 2026-08-27 |
