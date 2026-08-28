# Forma Bug Log

Use this file to record reproducible app problems. Give each new bug the next
number (`BUG-001`, `BUG-002`, and so on). While it is open, keep the full
template under **Open bugs**. When it is fixed, fill **Resolution**, move the
write-up to **Resolved records** (so the steps and evidence stay), and add a
one-line summary to the resolved table.

## Open bugs

None. Every recorded bug is in **Resolved records** below.

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

## Resolved records

Full write-ups kept after the summary row is added, so later agents can see
what failed and how it was verified.

### BUG-011 — CSV formula injection through part labels

- **Status:** Resolved
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
Still reproduces on dev @ ad15840: a label of
`=HYPERLINK("http://evil.example","Shelf")` exports as
`"=HYPERLINK(""http://evil.example"",""Shelf"")"` — RFC 4180 correct, still a
live formula on open.

#### Resolution

`escapeField` prefixes an apostrophe onto any *string* field opening with `=`,
`+`, `-`, `@`, tab or CR — the standard neutralizer, which spreadsheets consume
as "treat as text". Numeric fields are exempt, so a measurement stays a number
the sheet can compute with. Covered by four `csv.test.ts` cases. Verified
2026-08-28.

### BUG-012 — Custom panel W limits cannot represent factory thicknesses

- **Status:** Resolved
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

`CUSTOM_PANEL_LIMITS` is `{ min: 3, max: 3000, step: 1 }` on all three axes, so
8 mm backs, 18 mm sides and 32 mm knobs are all reachable and survive a reload
rather than being clamped up on load. The stale comment claiming the limits were
unenforced is corrected — `setCustomPartDim`, `setHardwareDiameter` and
`normalizePart` all clamp to them. Covered by two unit tests including a
persistence round-trip. Verified 2026-08-28.

### BUG-013 — CSV em dash garbles in Excel without a UTF-8 BOM

- **Status:** Resolved
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

The Cut List export prepends `CSV_BOM` (`\uFEFF`) to the blob, so Excel on
Windows decodes UTF-8 on a double-click open and the em dash renders. The mark
is added at the export boundary rather than inside `toCSV`, which stays a pure
string function its tests compare directly. Covered by a `csv.test.ts` case.
Verified 2026-08-28.

### BUG-019 — Duplicating two cabinets drops Add Shelf on the copies

- **Status:** Resolved
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

`duplicateSelected` only groups a copy when the selection matches one group. Two cabinets are cloned as loose parts. The copies have no `cabinet` config, so Add Shelf is gone.

#### Notes and evidence

`src/store/actions.ts` → `duplicateSelected`. `groupMatching` requires an exact single-group membership. Keyboard shortcut still calls duplicate when the button is hidden (`useKeyboardShortcuts.ts`). Related to BUG-022.

#### Resolution

`duplicateSelected` resolves the selection with `selectionUnits` and clones every
fully selected group as a group, so duplicating two cabinets yields two
cabinets, each keeping its `cabinet` config and member order. A lone member is
still a loose clone (BUG-022), and a mixed selection copies each part in its own
shape. Covered by four unit tests. Verified 2026-08-28.

### BUG-020 — Changing one cabinet panel's size hides Add Shelf

- **Status:** Resolved
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

`src/store/actions.ts` → `setCustomPartDim` / `invalidatePartiallyEditedCabinets`. Properties shows both per-part dimension sliders and Add Shelf for a single selected member (`RightSidebar.tsx`). Related to BUG-014 (delete) and BUG-018 (duplicate). A demoted group that still looks like a carcass can use Restore cabinet; load still will not resurrect `cabinet` on its own (BUG-009).

#### Resolution

Demotion is no longer silent. `announceDemotions` names any group that just
lost its parametric config and points at Restore cabinet, from the per-part
resize, gizmo scale, transform and delete paths alike; in `deleteParts` that
explanation takes the toast slot over the generic "Part deleted", since the
deletion itself is visible in the viewport. Properties also warns, above the
per-part Dimensions block, that resizing one member of a cabinet leaves a
carcass that cannot be regenerated, and points at Cabinet Width / Height /
Depth instead. The sliders stay available — the edit is legitimate, it just
needed to stop being a surprise. Covered by three unit tests. Verified
2026-08-28.

### BUG-029 — Moving one shelf in a multi-bay cabinet multiplies the shelves

- **Status:** Resolved
- **Severity:** High
- **Found:** 2026-08-28
- **Area:** Panels
- **App version or commit:** dev @ ad15840
- **Frequency:** Always (any cabinet with an interior panel)

#### Steps to reproduce

1. Insert a Base 600.
2. Add Panel at 300 mm. The single shelf row is now two shelf pieces, one per bay.
3. Select one of those two shelves and move it up 100 mm (gizmo, nudge, or Y Position).
4. Click Add Shelf.

#### Expected behavior

One shelf sits 100 mm higher in its own bay. Add Shelf adds one more row, for
three shelf pieces in that bay.

#### Actual behavior

`shelfCount` jumps from 1 to 2 and `shelfPositionsMm` becomes `[400, 500]` — the
moved piece is read as a whole new *row*, not as one bay's shelf. Step 4 produces
**six** shelves instead of three, and the piece that was placed at 500 mm is back
at 400 mm.

Between steps 3 and 4 the group is also internally inconsistent: the config
describes a 10-member layout while `partIds` still holds 8. That state autosaves.

#### Notes and evidence

`src/store/actions.ts` → `liveInteriorCentrelines` (L913) flattens every shelf
part's local Y through `uniqueSortedMm`, so per-bay shelves at different heights
become separate rows. `groupsWithSyncedInteriors` (L967) then writes the config
without rebuilding the layout, which is where the member-count desync comes from.

The desync also trips `assignCabinetMemberIds`' `previousLayoutLength !==
previousPartIds.length` fallback, which reassigns ids by index — re-introducing
the role scramble closed in BUG-025.

Shelf centrelines should be collapsed per row (with a tolerance, as
`restoreCabinet.ts` → `uniqueSorted` already does), and a config change that
alters the member count must go through `commitCabinetResize`, never a bare
`groups` write.

#### Resolution

`liveInteriorCentrelines` collapses shelves by layout *row* via
`cabinetLayoutSlots` instead of by distinct height, so a two-bay row stays one
row. A row whose bays disagree by more than 2 mm has no parametric form, so the
group demotes to a plain group — Restore cabinet rebuilds it — rather than
gaining a phantom row. `layoutMatchesMembers` refuses any config whose layout
length differs from the member count, closing the desync that used to autosave.
Covered by five `store/regressions.test.ts` cases, including the single-bay
BUG-028 path and a whole-row drag. Verified 2026-08-28.

### BUG-030 — Deleting one shelf of a multi-bay row deletes the whole row

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Panels
- **App version or commit:** dev @ ad15840
- **Frequency:** Always (cabinet with an interior panel)

#### Steps to reproduce

1. Insert a Base 600 and Add Panel at 300 mm (two bays, two shelf pieces).
2. Click one shelf in the viewport.
3. Press Delete.

#### Expected behavior

Only the selected shelf is removed; the facing bay keeps its shelf.

#### Actual behavior

Both shelves in that row disappear. Members go 8 → 6, `shelfCount` 1 → 0, and the
toast still reads "Part deleted".

#### Notes and evidence

`src/store/actions.ts` → `configAfterInteriorDelete` (L554) maps a shelf index to
`row = Math.floor((index - CABINET_CARCASS_COUNT) / bayCount)` and drops the whole
row. The parametric config has no way to express "a row with a hole in it", so
either the delete should demote the cabinet, or `CabinetConfig` needs per-bay
shelf occupancy. Related to BUG-014.

#### Resolution

`configAfterInteriorDelete` reads roles from `cabinetLayoutSlots` and removes a
shelf row only when every bay in it was deleted. A partial row returns null, so
the caller demotes and the facing bay's board survives. Deleting a lone shelf in
a single-bay cabinet is unchanged (BUG-014). Covered by three unit tests.
Verified 2026-08-28.

### BUG-031 — A rigid selection collapses at the ±10 m position clamp

- **Status:** Resolved
- **Severity:** High
- **Found:** 2026-08-28
- **Area:** Viewport
- **App version or commit:** dev @ ad15840
- **Frequency:** Always (selection dragged or nudged past ±10 m)

#### Steps to reproduce

1. Set the grid to 20 m in the status bar.
2. Insert a Base 600 and select the whole group in Assembly.
3. With the move gizmo on, hold the right arrow (or drag) until the cabinet
   passes x = 10 m.

#### Expected behavior

The selection stops at the boundary as one rigid structure, keeping its shape.

#### Actual behavior

Every panel is clamped to exactly x = 10 m independently, so the carcass
flattens into a single plane. Undo recovers it, but nothing warns that the
design was destroyed.

#### Notes and evidence

`src/store/actions.ts` → `commitTransforms` (L801) clamps each part's position on
its own. The correct pattern already exists in the same file:
`setSelectionPositionAxis` (L1430) computes one shared delta clamped by
`minDelta` / `maxDelta` across the whole selection, so the typed Position field
is safe while the gizmo and arrow keys are not. `nudgeSelected` and the gizmo
commit should clamp the shared translation, not each member.

#### Resolution

`commitTransforms` computes one `sharedPositionCorrection` per axis across the
whole batch and applies it uniformly, so a selection reaches the boundary as the
rigid thing the user dragged. Covered by a Base 600 nudge test asserting member
spacing survives four 4 m nudges. Verified 2026-08-28.

### BUG-032 — A cabinet with non-integer shelf spacing loses its preset for good

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Panels
- **App version or commit:** dev @ ad15840
- **Frequency:** Always for High 600 (any preset whose even spacing is fractional)

#### Steps to reproduce

1. Insert a High 600 (4 shelves through a 2164 mm interior → 450.8, 883.6,
   1316.4, 1749.2 mm).
2. Change Cabinet Width to 700, then back to 600.
3. Change Cabinet Height to 2600.

#### Expected behavior

Returning to 600 mm restores the "High 600" preset and label. Raising the height
redistributes the four shelves through the taller interior.

#### Actual behavior

Step 2 writes explicit `shelfPositionsMm: [451, 884, 1316, 1749]`, which clears
`presetId` and renames the group to `High 600×2200×600` permanently. Step 3
leaves the shelves at 451–1749 mm with ~800 mm of dead space above the top one.

#### Notes and evidence

`src/store/actions.ts` → `cabinetWithLiveInterior` (L944) rounds live centrelines
to integers with `uniqueSortedMm`, then compares them against the *float* even
distribution using `sameMm` (L905), which is exact equality — so the comparison
can never succeed for a fractional layout and every dimension edit freezes the
shelves.

`src/domain/restoreCabinet.ts` → `matchesEven` (L63) solves the same problem with
a ±2 mm tolerance. `sameMm` should do the same.

#### Resolution

`sameMm` takes a 2 mm tolerance (`INTERIOR_TOLERANCE_MM`), matching
`restoreCabinet.matchesEven`, so a rounded live read still matches a fractional
even distribution. High 600 keeps its preset through a size round-trip and
redistributes its shelves on a height change; a deliberately placed shelf still
sticks. Covered by four unit tests. Verified 2026-08-28.

### BUG-033 — Gizmo-scaling one cabinet panel is silently discarded

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Panels
- **App version or commit:** dev @ ad15840
- **Frequency:** Always

#### Steps to reproduce

1. Insert a Base 600.
2. Click one shelf, switch to the scale gizmo, and stretch it.
3. Change Cabinet Width (or click Add Shelf).

#### Expected behavior

Either the edit sticks, or the cabinet demotes to a rigid group the way a typed
dimension edit does (BUG-020).

#### Actual behavior

The group stays a configurable cabinet carrying a stale 18 mm config. The next
rebuild resets that shelf's scale to `[1, 1, 1]` and the edit is gone with no
warning.

#### Notes and evidence

`src/store/actions.ts` → `commitTransforms` (L801) never calls
`invalidatePartiallyEditedCabinets` (L95), while `setCustomPartDim` (L322) does.
A scale component in a committed transform is a size edit and should be treated
the same as the typed one.

#### Resolution

`commitTransforms` passes the ids whose scale actually changed to
`invalidatePartiallyEditedCabinets`, so a gizmo scale demotes a partially edited
cabinet exactly as the typed dimension field does. Position and rotation still
never demote. Covered by two unit tests. Verified 2026-08-28.

### BUG-034 — Typed shelf and panel positions are never deduplicated

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Panels
- **App version or commit:** dev @ ad15840
- **Frequency:** Always

#### Steps to reproduce

1. Insert a High 600 (four shelves).
2. In Properties → Shelves, type 400 into each of the four position fields.

#### Expected behavior

Coincident centrelines are merged or rejected, as Add Shelf already does.

#### Actual behavior

Four shelves are generated at exactly 400 mm — z-fighting in the viewport and
four separate rows in the cut list.

#### Notes and evidence

`src/domain/cabinets.ts` → `shelfPositions` (L220) and `dividerPositions` (L270)
clamp and sort but never dedupe. `nextFreeInteriorPosition` (L38) guards the Add
buttons only; the per-row position fields and Apply bypass it.

#### Resolution

`distinctInteriorPositions` clamps, sorts, then drops any centreline within one
panel thickness of the previous one — the rule `nextFreeInteriorPosition`
already applied to Add Shelf / Add Panel — for both `shelfPositions` and
`dividerPositions`, so typed, evenly-spaced and loaded positions all go through
it. Covered by two unit tests. Verified 2026-08-28.

### BUG-035 — A negative gizmo scale collapses a part to 0.001×

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Viewport
- **App version or commit:** dev @ ad15840
- **Frequency:** Always when a scale handle is dragged through the pivot

#### Steps to reproduce

1. Insert a Shelf and switch to the scale gizmo.
2. Drag the X handle past the part's own centre so the scale goes negative.
3. Release.

#### Expected behavior

The scale stops at a small positive minimum, or mirroring is supported.

#### Actual behavior

`Math.max(0.001, …)` turns −1 into 0.001, so an 800 mm shelf becomes 1 mm wide
(cut-list area 0.0003 m²). The mesh is now sub-pixel, so it cannot be grabbed and
dragged back — only Undo recovers it.

#### Notes and evidence

`src/store/actions.ts` → `commitTransforms` (L801). Clamping the *magnitude* while
preserving sign, or refusing a sign flip outright, both avoid the trap. The
mechanism is confirmed by unit probe; that `TransformControls` emits a negative
scale on a through-pivot drag is assumed, not yet observed in the browser.

#### Resolution

`commitTransforms` clamps scale *magnitude* (`Math.abs` before the 0.001–100
clamp), so a handle dragged through the pivot leaves the part at its size
instead of collapsing it. Mirroring remains unsupported. Covered by two unit
tests. Verified 2026-08-28.

### BUG-036 — Inserting a library item does not frame it

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Library / Viewport
- **App version or commit:** dev @ ad15840
- **Frequency:** Always

#### Steps to reproduce

1. Build a design large enough that the camera is zoomed out or panned away.
2. Click a Library item (panel or cabinet) rather than dragging it into view.

#### Expected behavior

The camera moves to the new piece, the way Frame and Open File already do. The
new part is selected, so the user should be looking at what they just selected.

#### Actual behavior

The part is inserted at `nextInsertionX` — to the right of everything else — and
selected, but the camera does not move. On a wide design the new item can be
entirely off-screen and the insert looks like it did nothing.

#### Notes and evidence

`src/store/actions.ts` → `addCustomPanel` and `addCabinetPreset` call
`setSelection` but never `viewportApi()?.frameSelection(...)`. `restoreVersion`
and `openFile` already call `frameAll()`, so the hook exists.

Framing on every insert may be too aggressive when the camera is already close;
worth framing only when the new part's projected bounds fall outside the
viewport.

#### Resolution

`frameInsertedParts` frames the new selection after a Library click. A
drag-and-drop is already placed where the user was looking, so it keeps the
current camera. Verified in Chromium alongside the existing insert checks
2026-08-28.

### BUG-037 — Typing W on a witness label resizes the depth of a rotated part

- **Status:** Resolved
- **Severity:** High
- **Found:** 2026-08-28
- **Area:** Viewport / Panels
- **App version or commit:** dev @ ad15840
- **Frequency:** Always for any part rotated off its insertion orientation

#### Steps to reproduce

1. Insert a Door (400 × 800 × 18 mm) and rotate it 90° about Y — its world size
   is now W 18 × H 800 × D 400.
2. Switch to the scale gizmo. The overall witnesses read W 18, H 800, D 400.
3. Click the **W** label and type 600.

#### Expected behavior

The world width goes from 18 mm to 600 mm — the axis the label is drawn along.

#### Actual behavior

The world **depth** becomes 600 mm and the width stays at 18 mm. The label the
user typed into does not change.

#### Notes and evidence

`src/store/actions.ts` → `setSelectedOverallDim` maps the witness's **world** axis
straight onto the part's **local** `w`/`h`/`d` key
(`axis === 'x' ? 'w' : axis === 'y' ? 'h' : 'd'`) without consulting the stored
quaternion. The witness itself is correct — `overallDimensions` measures the world
AABB — so label and action disagree the moment a part is rotated.

The local axis should be chosen by mapping the world axis through the inverse
quaternion (the nearest local axis), the same way `orientedHalfExtentsMm` derives
the world extents. A ±90° rotation about Y is the normal way to hang a door or
face a side panel, so this is easy to hit.

Round hardware also widens on two axes by design: typing W on an ENHET leg sets
both W and D (`setHardwareDiameter`). That is intended for a round leg, but the
witness gives no hint that the label drives a diameter rather than a width.

#### Resolution

New `localDimensionForWorldAxis` in `domain/spatial.ts` maps the witness's world
axis through the inverse quaternion to the nearest local axis, and
`setSelectedOverallDim` writes that dimension — for panels and for round and leg
hardware alike. Typing W on a door rotated 90° about Y now changes the world
width. Covered by three unit tests. Verified 2026-08-28.

### BUG-038 — Overall W/H/D witnesses show when the scale gizmo is off

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Viewport
- **App version or commit:** dev @ ad15840
- **Frequency:** Always (single selected cabinet or group)

#### Steps to reproduce

1. Insert a Base 600 and select the group.
2. Leave the gizmo on Select, Move, or Rotate.

#### Expected behavior

Overall size witnesses belong to the resize gesture and should only draw while
the scale gizmo is on — mirroring alignment witnesses, which already draw only
while the move gizmo is on (IMP-014).

#### Actual behavior

Three overall W/H/D lines and labels draw in every gizmo mode. They are
display-only (`OVERALL_LABEL_CLASS`, not clickable) but they still add three
lines and three labels to a view that is already carrying up to six clearance
witnesses, which is a large part of BUG-039.

#### Notes and evidence

`src/viewport/SelectionDimensions.ts` → `previewOverallIds` returns the cabinet's
or group's part ids for every non-scale mode; only the `gizmoMode === 'scale'`
branch is conditional. The two-unit branch of `sync` already gets this right
(`gizmoMode === 'scale' ? overallForIds(...) : []`), as does `alignmentsForMode`
for alignment lines. Note IMP-012 deliberately introduced the always-on preview,
so this is a change of intent, not just a fix.

#### Resolution

`previewOverallIds` returns nothing unless the scale gizmo is on, so size
witnesses belong to the resize gesture exactly as alignment witnesses belong to
the move gesture. This deliberately reverses IMP-012's always-on preview.
Covered by a Chromium check that asserts the witnesses appear on Scale and
disappear on Move. Verified 2026-08-28.

### BUG-039 — Witness labels overlap and become unreadable

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Viewport
- **App version or commit:** dev @ ad15840
- **Frequency:** Often (any selection with several witnesses in the ¾ view)

#### Steps to reproduce

1. Insert two Base 600 cabinets side by side and select one.
2. Orbit to the default ¾ view.

#### Expected behavior

Every measurement stays legible; labels push apart, hide, or collapse rather
than stacking on each other.

#### Actual behavior

Up to nine labels (three overall + up to six nearest-facing gaps) are placed at
their projected line midpoints with no collision handling, so several land on
the same few pixels. The W and D overall lines are both anchored at
`box.min.y`, which makes them especially likely to collide.

#### Notes and evidence

`src/viewport/SelectionDimensions.ts` → `updateLabels` projects
`midpoint(dimension.line[0], dimension.line[1])` and writes `left`/`top`
directly; nothing measures the resulting rectangles. `OFFSET_M` (0.06) and
`OVERALL_OFFSET_M` (0.12) in `selectionGap.ts` separate the *lines* in world
space, but two world-separated lines can still project to the same screen point.

A screen-space pass after projection — sort by depth, then nudge or hide any
label whose box intersects one already placed — would fix it without touching
the geometry. Reducing the label count (BUG-038) helps too.

#### Resolution

New pure `viewport/labelLayout.ts` resolves overlap after projection: the label
being typed into is placed first and never moves, the rest go down nearest-first,
each lifted in whole-label steps until clear, and hidden when there is no room.
Retiring a pooled label now also clears its text and `data-testid`, so a hidden
witness no longer answers queries for one that is on screen. Covered by seven
`labelLayout` tests and the Chromium witness checks. Verified 2026-08-28.

### BUG-040 — Measure cannot be used while a gizmo is on

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Viewport
- **App version or commit:** dev @ ad15840
- **Frequency:** Always

#### Steps to reproduce

1. Select a Door and switch to the scale gizmo.
2. Drag a scale handle to resize it.
3. Try to check the resulting size with the Measure tool in the toolbar.

#### Expected behavior

A size readout is available *during* the resize — that is when the number is
needed.

#### Actual behavior

`toggleMeasure` sets `gizmoMode: 'select'`, so turning Measure on detaches the
gizmo and ends the resize. Conversely `setGizmoMode` sets `measureActive: false`,
so picking the gizmo again cancels the measurement. The two tools are mutually
exclusive by construction.

The overall witness labels are supposed to cover this case, but they are
misleading on rotated parts (BUG-037) and frequently unreadable (BUG-039).

#### Notes and evidence

`src/store/uiStore.ts` → `toggleMeasure` / `setGizmoMode`. Options: let Measure
coexist with the gizmo (it only consumes clicks that miss the gizmo handles), or
add a live size readout pinned near the gizmo during a scale drag so no separate
tool is needed. Properties → Dimensions already shows the numbers, but it is
across the screen from the gesture.

#### Resolution

`toggleMeasure` no longer forces `gizmoMode: 'select'` and `setGizmoMode` no
longer clears `measureActive`, so a resize can be measured while it is
happening. TransformControls consumes its own handle drags, so measure clicks
that miss a handle still land. Covered by three uiStore tests. Verified
2026-08-28.

### BUG-041 — Keyboard hints show ⌘ on Windows and Linux

- **Status:** Resolved
- **Severity:** Low
- **Found:** 2026-08-28
- **Area:** Other
- **App version or commit:** dev @ ad15840
- **Frequency:** Always off macOS

#### Steps to reproduce

1. Open the app on Windows or Linux.
2. Read the viewport hint strip at the bottom left.

#### Expected behavior

The hint names the modifier the user actually has: `Ctrl+D`, `Ctrl+A`.

#### Actual behavior

It reads `⌘D duplicate · ⌘A select all`. The *handler* is already correct —
`useKeyboardShortcuts` tests `e.metaKey || e.ctrlKey`, so Ctrl works everywhere —
only the label is wrong. `docs/BUGS.md` prose and IMP-013 have the same habit.

#### Notes and evidence

`src/viewport/overlays/ViewportHint.tsx` is the only place in `src/` that hardcodes
a ⌘. Suggested direction: one `src/ui/shortcuts.ts` exporting a detected
`MOD_KEY` label (`'⌘'` when `navigator.userAgentData?.platform ?? navigator.platform`
matches `/mac|iphone|ipad/i`, else `'Ctrl'`) plus a `formatShortcut('mod+D')`
helper, and have every hint, tooltip and `aria-keyshortcuts` render through it.
Keeping the detection in one module means the hint strip, future menu
accelerators and the docs can never drift apart, and it stays testable in Node.

#### Resolution

New `src/ui/shortcuts.ts` owns platform detection and exports `MOD_KEY` and
`formatShortcut('mod+D')`; `ViewportHint` renders through it, so Windows and
Linux read `Ctrl+D` / `Ctrl+A`. Covered by five `shortcuts` tests that check both
platforms without stubbing `navigator`. Verified 2026-08-28.

### BUG-028 — Add Shelf / Add Panel still snapped a gizmo-moved panel home

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-28
- **Area:** Panels
- **App version or commit:** main @ PR 21
- **Frequency:** Always (move a shelf or interior panel, then Add Shelf / Add Panel or edit the millimetre field)

#### Steps to reproduce

1. Insert a Base 600.
2. Add Panel at 300 mm. Select that panel and move it (gizmo, nudge, or X Position).
3. Click Add Shelf, or look at Panel 1's millimetre field.

#### Expected behavior

The panel stays at the placed centreline. Properties shows that millimetre value.

#### Actual behavior

BUG-025 read live transforms at add time, but did not write them back onto `cabinet`. Properties still showed 300 mm. Editing that field, or some rebuilds, snapped the panel home.

#### Notes and evidence

`commitTransforms` and `setPositionAxis` now sync interior centrelines when a shelf or panel moves. `setCabinetDim` rebuilds from those live positions.

#### Resolution

Moving an interior member updates `shelfPositionsMm` / `dividerPositionsMm` in the same undo step. Covered by actions unit tests and a Chromium Open File-style Add Shelf check. Verified 2026-08-28.

### BUG-021 — Add Panel at the same position replaced the previous panel

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Panels
- **App version or commit:** dev @ 367b6f2
- **Frequency:** Always (second Add Panel / Add Shelf click without changing the millimetre field)

#### Steps to reproduce

1. Insert a Base 600.
2. Click Add Panel (default 300 mm). A centre panel appears.
3. Click Add Panel again without changing the position.

#### Expected behavior

A second interior panel is added at the next free offset.

#### Actual behavior

The default stayed 300 mm, so the second click stacked on the same centreline.
In the viewport that looked like the first panel had been replaced.

#### Notes and evidence

`addCabinetDivider` / `addCabinetShelf` appended the typed millimetres even when
that centreline was occupied. `InteriorMemberFields` also reset the add field
to 300 mm after every click.

#### Resolution

`nextFreeInteriorPosition` walks 100 mm (then millimetre-by-millimetre) to a
free centreline. A second Add Panel at 300 mm lands at 400 mm. Covered by
domain and actions unit tests and a Base 600 browser check. Verified 2026-08-27.

### BUG-022 — Duplicating one cabinet shelf or panel cloned the whole cabinet

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Panels
- **App version or commit:** dev @ 367b6f2
- **Frequency:** Always (Duplicate or ⌘D with one cabinet member selected)

#### Steps to reproduce

1. Insert a Base 600.
2. Click one shelf or panel in the viewport (not the Assembly group row).
3. Click Duplicate.

#### Expected behavior

Only that piece is copied, offset 80 mm. The original cabinet stays intact
with Add Shelf.

#### Actual behavior

BUG-018 made Duplicate copy the containing cabinet whenever Add Shelf was
showing, so one selected shelf produced a second full carcass.

#### Notes and evidence

`duplicateSelected` used `cabinetContainingSelection` as well as
`groupMatching`. Properties Duplicate is shown for `selection.kind ===
'single'`, so the button looked like it applied to that shelf.

#### Resolution

Duplicate copies the current selection. A fully selected group still clones as
a cabinet; a single member clones as a loose part. To copy a whole cabinet,
select the group in Assembly first. Covered by an actions unit test and a
Base 600 browser check. Verified 2026-08-27.

### BUG-023 — Reload left the camera on the empty-scene view

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Viewport
- **App version or commit:** dev @ 367b6f2
- **Frequency:** Always (reload with an autosaved design)

#### Steps to reproduce

1. Insert cabinets or panels so the design no longer fits the default ¾ view.
2. Wait for Autosaved.
3. Reload the page.

#### Expected behavior

The camera frames every live part, the same as Frame with nothing selected.

#### Actual behavior

Autosave restored the meshes, but the camera stayed at the empty-canvas
preset `(2.5, 1.5, 2.7)`, so pieces could sit off-screen.

#### Notes and evidence

`App` hydrated in `useEffect` after the lazy viewport's first sync, which
framed nothing. `CameraController.frameAll` already existed for the Frame
button.

#### Resolution

The session restores before the first paint. After the first `builder.sync`,
the viewport calls `frameAll`. Open File and Restore Version do the same.
Covered by the persistence reload browser check. Verified 2026-08-27.

### BUG-024 — Duplicating a panel measured from the wrong face

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Panels / Viewport
- **App version or commit:** dev
- **Frequency:** Always (Duplicate of an interior cabinet panel)

#### Steps to reproduce

1. Insert a Base 600.
2. Click Add Panel (300 mm). Select the new panel.
3. Note the clearance to the facing inner neighbour.
4. Duplicate that panel.

#### Expected behavior

The copy is another interior panel at the next free centreline (400 mm), and
clearance reads from the same inner faces as Add Panel.

#### Actual behavior

Duplicate offset the copy 80 mm in X and Z as a loose part. The unselected
cabinet collapsed to one AABB, so the witness measured to the carcass outside
instead of the facing panel.

#### Notes and evidence

`duplicateSelected` always cloned a single member as a loose part (BUG-022).
`dimensionNeighborIds` treated any unselected group as one box.

#### Resolution

Duplicating an interior panel calls `addCabinetDivider` at that centreline.
A single selected piece now measures against individual neighbours, not the
outer group box. Covered by `interiorMemberPlacement` / actions / neighbor
unit tests and a Base 600 browser check. Verified 2026-08-27.

### BUG-025 — Add Shelf / Add Panel reset existing panel positions

- **Status:** Resolved
- **Severity:** Medium
- **Found:** 2026-08-27
- **Area:** Panels
- **App version or commit:** dev
- **Frequency:** Always (Add Panel or Add Shelf after an interior panel exists)

#### Steps to reproduce

1. Insert a Base 600.
2. Add Panel at 300 mm. Select that panel and place it (gizmo, nudge, or typed clearance).
3. Click Add Panel or Add Shelf.

#### Expected behavior

The existing panel stays a panel at the placed centreline. The new member is added beside it.

#### Actual behavior

The rebuild reused member ids by layout index. Adding a bay inserted extra shelf slots before the panels, so the placed panel's id became a shelf and a new panel appeared at the parametric centreline. Add also selected the whole carcass, so Properties jumped off the piece being placed. Live gizmo / typed-gap offsets were not written back into `dividerPositionsMm` / `shelfPositionsMm`, so the next rebuild snapped them home.

#### Notes and evidence

`commitCabinetResize` used `group.partIds[index] ?? nextCustomId()`. Layout order is carcass, then all bay shelves, then panels.

#### Resolution

`assignCabinetMemberIds` reuses ids by role. Add Shelf / Add Panel read live interior centrelines before rebuilding. A partial selection stays on surviving members. Covered by `assignCabinetMemberIds` and actions unit tests. Verified 2026-08-27.

### BUG-026 — Save to File did nothing when the native picker aborted immediately

- **Status:** Resolved
- **Severity:** High
- **Found:** 2026-08-27
- **Area:** Persistence
- **App version or commit:** main @ c684cc8
- **Frequency:** Always in headless Chromium / some webviews; also when Open File hid `*.forma.json`

#### Steps to reproduce

1. Click Save to File in a browser where `showSaveFilePicker` exists but cannot show a dialog (Playwright Chromium, some embedded views).
2. Or click Open File and look for a previously saved `*.forma.json`.

#### Expected behavior

A `.forma.json` download starts. Open File lists those files.

#### Actual behavior

The picker rejected with `AbortError` in well under a second. Save treated that as a user cancel and returned without a download or toast. Open File's `accept` listed only `.json`, so some choosers hid `*.forma.json`.

#### Notes and evidence

`src/store/actions.ts` → `saveToFileOnce`. Distinct from a real cancel, which takes long enough to see and dismiss the dialog. Vercel *preview* URLs (`forma-git-dev-…`) also require Vercel SSO; production `forma-ebon-one.vercel.app` does not.

#### Resolution

An `AbortError` faster than 400 ms was treated as a cancel, so nothing
downloaded. After that, a shown picker whose `createWritable()` failed still
toasted only "Could not save the file" and never downloaded. Save to File now
always downloads `{title}.forma.json`. Open File accepts `.json` and
`.forma.json`. Covered by save unit tests and Chromium download checks.
Verified 2026-08-27.

### BUG-027 — Open File rejected older Forma files that were still valid JSON

- **Status:** Resolved
- **Severity:** High
- **Found:** 2026-08-27
- **Area:** Persistence
- **App version or commit:** main @ f383ce1
- **Frequency:** Always for empty truncated saves; also BOM, string `schemaVersion`, `document` alias, or a bare document

#### Steps to reproduce

1. Open File on a `.forma.json` saved before the current envelope, or on a file that looks empty in a text editor.
2. Or open a schema-3 / schema-4 file whose first character is a UTF-8 BOM.

#### Expected behavior

Schema 3–5 designs load. An empty truncated save says so and leaves the current scene alone.

#### Actual behavior

`JSON.parse` threw on a BOM. `migrate` required a numeric `schemaVersion` and a `doc` key, so string versions, `document`, and bare documents toasted "Not a Forma file, or an unsupported version". Empty files from the failed File System Access save (BUG-026) toasted "Could not read that file".

#### Notes and evidence

`src/store/persistence.ts` → `loadFormaText`. Schema 1 parametric sideboard files remain unsupported by design.

#### Resolution

Open File and autosave load through `loadFormaText`: strip BOM, treat empty as empty, accept string versions, `document`, and a bare document with `customParts` / `groups`. Empty files toast that the save may not have finished. Covered by persistence unit tests and Chromium Open File checks.
Verified 2026-08-27.

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
| BUG-018 | Duplicating a cabinet member dropped Add Shelf | Viewport clicks select one piece (BUG-006) while Add Shelf still shows for that carcass. The copy of a lone member is a loose part; the original cabinet keeps Add Shelf. Cloning a whole cabinet requires selecting the group (see BUG-022). | 2026-08-27 |
| BUG-021 | Add Panel at the same position replaced the previous panel | See Resolved records. Second Add Panel / Add Shelf walks 100 mm to a free centreline. | 2026-08-27 |
| BUG-022 | Duplicating one cabinet piece cloned the whole cabinet | See Resolved records. Duplicate copies the selection; select the Assembly group row to clone a cabinet. | 2026-08-27 |
| BUG-023 | Reload left the camera on the empty-scene view | See Resolved records. Reload, Open File, and Restore Version call `frameAll`. | 2026-08-27 |
| BUG-024 | Duplicating a panel measured from the wrong face | See Resolved records. Duplicate of an interior panel is Add Panel at the next free centreline; a single selected piece measures to individual neighbours. | 2026-08-27 |
| BUG-025 | Add Shelf / Add Panel reset existing panel positions | See Resolved records. Rebuilds reuse ids by role and keep live centrelines. | 2026-08-27 |
| BUG-026 | Save to File did nothing when the native picker aborted immediately | See Resolved records. Save always downloads `{title}.forma.json`; Open File accepts `.forma.json`. | 2026-08-27 |
| BUG-027 | Open File rejected older Forma files that were still valid JSON | See Resolved records. `loadFormaText` strips a BOM, accepts string versions / `document` / a bare doc, and explains empty truncated saves. | 2026-08-27 |
| BUG-028 | Add Shelf / Add Panel still snapped a gizmo-moved panel home | See Resolved records. Gizmo and typed moves write interior centrelines back onto `cabinet`. | 2026-08-28 |
| BUG-029 | Moving one shelf in a multi-bay cabinet multiplies the shelves | See Resolved records. Shelves collapse by layout row; a row that cannot be represented demotes instead of desyncing the group. | 2026-08-28 |
| BUG-030 | Deleting one shelf of a multi-bay row deletes the whole row | See Resolved records. A partial row demotes the cabinet; the facing bay's shelf is no longer deleted with it. | 2026-08-28 |
| BUG-031 | A rigid selection collapses at the ±10 m position clamp | See Resolved records. One shared correction per axis replaces the per-part clamp, so a carcass no longer flattens at ±10 m. | 2026-08-28 |
| BUG-032 | A cabinet with non-integer shelf spacing loses its preset for good | See Resolved records. A 2 mm tolerance stops fractional even spacing from freezing into explicit positions. | 2026-08-28 |
| BUG-033 | Gizmo-scaling one cabinet panel is silently discarded | See Resolved records. A committed scale demotes a partially edited cabinet, matching the typed dimension field. | 2026-08-28 |
| BUG-034 | Typed shelf and panel positions are never deduplicated | See Resolved records. Explicit centrelines are thinned to one board thickness apart, as Add Shelf already was. | 2026-08-28 |
| BUG-035 | A negative gizmo scale collapses a part to 0.001× | See Resolved records. Scale is clamped by magnitude, so a through-pivot drag no longer annihilates the part. | 2026-08-28 |
| BUG-036 | Inserting a library item does not frame it | See Resolved records. A Library click frames its new piece; a drop keeps the camera where it was. | 2026-08-28 |
| BUG-037 | Typing W on a witness label resizes the depth of a rotated part | See Resolved records. The witness's world axis is mapped through the part's orientation before writing a catalog dimension. | 2026-08-28 |
| BUG-038 | Overall W/H/D witnesses show when the scale gizmo is off | See Resolved records. Overall W/H/D draws only with the scale gizmo, reversing IMP-012's always-on preview. | 2026-08-28 |
| BUG-039 | Witness labels overlap and become unreadable | See Resolved records. Labels are de-overlapped in screen space after projection; retired labels release their identity. | 2026-08-28 |
| BUG-040 | Measure cannot be used while a gizmo is on | See Resolved records. Measure and the gizmos are independent tools, so a resize can be measured as it happens. | 2026-08-28 |
| BUG-041 | Keyboard hints show ⌘ on Windows and Linux | See Resolved records. One `shortcuts` module detects the platform modifier; hints no longer claim ⌘ off macOS. | 2026-08-28 |
| BUG-011 | CSV formula injection through part labels | See Resolved records. `escapeField` apostrophe-prefixes formula-triggering text fields; numbers are exempt. | 2026-08-28 |
| BUG-012 | Custom panel W limits cannot represent factory thicknesses | See Resolved records. All three axes span 3–3000 mm on a 1 mm step, so factory thicknesses are reachable. | 2026-08-28 |
| BUG-013 | CSV em dash garbles in Excel without a UTF-8 BOM | See Resolved records. The exported blob carries a UTF-8 BOM; `toCSV` stays pure. | 2026-08-28 |
| BUG-019 | Duplicating two cabinets drops Add Shelf on the copies | See Resolved records. Every fully selected group clones as a group, so two cabinets duplicate as two cabinets. | 2026-08-28 |
| BUG-020 | Changing one cabinet panel's size hides Add Shelf | See Resolved records. Demotion is announced and Properties warns before a carcass-breaking per-part resize. | 2026-08-28 |
