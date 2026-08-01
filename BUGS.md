# Forma Bug Log

Use this file to record reproducible app problems. Give each new bug the next
number (`BUG-001`, `BUG-002`, and so on), then move it to the resolved table
when the fix has been verified.

## Open bugs

No open bugs logged yet.

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
