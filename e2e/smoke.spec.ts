import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any console error or page exception. */
function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Inserts a Shelf from the Library and returns to the Assembly tab. */
async function insertShelf(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Shelf' }).click();
  await expect(page.getByText('Shelf added to scene')).toBeVisible();
}

// Playwright gives each test a fresh browser context, so localStorage starts
// empty without an init script — and an init script would also wipe it on the
// reload the persistence test depends on.

test('boots to an empty scene with no starting model', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'Model' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('0 parts').first()).toBeVisible();
  await expect(page.getByText('No parts yet.')).toBeVisible();

  // The Library no longer offers leg/handle/base styles — there's no
  // parametric piece left for them to apply to.
  await page.getByRole('tab', { name: 'Library' }).click();
  await expect(page.getByText('Leg Style')).toHaveCount(0);
  await expect(page.getByText('Handle Style')).toHaveCount(0);
  await expect(page.getByText('Base Style')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shelf' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('inserting a library panel adds it to the tree, count and cut list together', async ({
  page,
}) => {
  await page.goto('/');
  await insertShelf(page);

  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByRole('treeitem', { name: 'Shelf Hide Shelf' })).toBeVisible();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('Nothing to cut yet.')).toHaveCount(0);
  await expect(page.getByText('Sheets Needed')).toBeVisible();
  await expect(page.getByText('total pieces')).toBeVisible();
});

test('deleting a panel updates the tree, the count and the cut list together', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('treeitem', { name: 'Shelf Hide Shelf' })).toHaveCount(0);
  await expect(page.getByText('0 parts').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('Nothing to cut yet.')).toBeVisible();
});

test('shift-click adds to the selection without triggering a marquee', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const rows = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await rows.nth(0).click();
  await expect(page.getByText('1 selected')).toBeVisible();

  await rows.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 selected')).toBeVisible();
});

test('switching gizmo tools preserves the current selection', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByText('1 selected')).toBeVisible();

  // These buttons are absolutely-positioned siblings of the canvas over empty
  // background — clicking them must not bubble into a raycast that clears
  // the selection.
  for (const label of ['Move (G)', 'Rotate (R)', 'Scale (S)', 'Pan (H)', 'Select (Q)']) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByText('1 selected')).toBeVisible();
  }

  await page.getByRole('button', { name: 'Frame' }).click();
  await expect(page.getByText('1 selected')).toBeVisible();
});

test('a panel dimension change is undoable and redoable', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  const widthInput = page.getByLabel('Width in millimetres');
  await widthInput.fill('1200');
  await widthInput.blur();
  await expect(widthInput).toHaveValue('1200');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Width in millimetres')).toHaveValue('800');

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByLabel('Width in millimetres')).toHaveValue('1200');
});

test('hiding a part survives a rebuild', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  await page.getByRole('button', { name: 'Hide Shelf' }).click();
  await expect(page.getByRole('button', { name: 'Show Shelf' })).toBeVisible();

  // Force a full geometry rebuild by inserting a second panel.
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  await expect(page.getByRole('button', { name: 'Show Shelf' })).toBeVisible();
});

test('the document persists across a reload', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await expect(page.getByText('Autosaved')).toBeVisible({ timeout: 5_000 });

  await page.reload();
  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByRole('treeitem', { name: 'Shelf Hide Shelf' })).toBeVisible();
});

test('inserting a library panel keeps the Library tab open', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  // The insert shouldn't kick the left sidebar back to Assembly — the
  // Properties tab on the right still flips so the new panel's controls
  // are visible.
  await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Properties' })).toHaveAttribute('aria-selected', 'true');
});

test('the Properties tab has its own finish picker, in sync with Materials', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await expect(page.getByRole('tab', { name: 'Properties' })).toHaveAttribute('aria-selected', 'true');

  // Apply a finish without ever visiting the Materials tab.
  await page.getByRole('button', { name: 'Ebony Stain' }).click();
  await expect(page.getByRole('button', { name: 'Ebony Stain' })).toHaveAttribute('aria-pressed', 'true');

  // Materials reflects the same override for the same part — one shared
  // FinishPicker, not two copies that could drift apart.
  await page.getByRole('tab', { name: 'Materials' }).click();
  await expect(page.getByText('Editing: Shelf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ebony Stain' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Reset to default')).toBeVisible();
});

test('render mode hides the sidebars and exposes camera presets', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Render' }).click();

  await expect(page.getByRole('tab', { name: 'Assembly' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export Image' })).toBeVisible();
  await expect(page.getByRole('button', { name: '¾ Angle' })).toBeVisible();
});

test('grouping two panels lets you reselect and ungroup them as one unit', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Group' }).click();
  await expect(page.getByText('Editing: Group 1')).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /Group 1/ })).toBeVisible();
  // Members are still individually present, just nested under the group.
  await expect(shelves).toHaveCount(2);

  // "Clear" exists in both the Assembly tree header and the Properties
  // action row; either clears the same selection.
  await page.getByRole('button', { name: 'Clear' }).first().click();
  await expect(page.getByText('2 parts').first()).toBeVisible();

  // Clicking the group row reselects both members together.
  await page.getByRole('treeitem', { name: /Group 1/ }).click();
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ungroup' })).toBeVisible();

  await page.getByRole('button', { name: 'Ungroup' }).click();
  await expect(page.getByRole('treeitem', { name: /Group 1/ })).toHaveCount(0);
  await expect(shelves).toHaveCount(2);
});

test('snap to floor reports nothing to do when a panel is already grounded', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  // The viewport is lazy-loaded; wait for it before driving anything that
  // depends on the live three.js scene (like Snap to Floor).
  await expect(page.locator('canvas')).toBeVisible();
  // A freshly inserted panel already rests on the floor by construction.
  await page.getByRole('button', { name: 'Snap to Floor' }).click();
  await expect(page.getByText('Already on the floor')).toBeVisible();
});

test('changing a panel height keeps its grounded face anchored', async ({
  page,
}) => {
  await page.goto('/');
  await insertShelf(page);
  // The viewport is lazy-loaded; wait for it before driving anything that
  // depends on the live three.js scene (like Snap to Floor).
  await expect(page.locator('canvas')).toBeVisible();

  // Exact dimension edits preserve the negative/local face, so a grounded
  // shelf remains grounded instead of drifting or cutting through the floor.
  const heightInput = page.getByLabel('Height in millimetres');
  await heightInput.fill('100');
  await heightInput.blur();
  await expect(heightInput).toHaveValue('100');

  await page.getByRole('button', { name: 'Snap to Floor' }).click();
  await expect(page.getByText('Already on the floor')).toBeVisible();
});

test('exact position fields accept furniture-scale offsets', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  const xPosition = page.getByLabel('X Position in millimetres');
  await xPosition.fill('409');
  await xPosition.blur();
  await expect(xPosition).toHaveValue('409');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(xPosition).toHaveValue('0');
});

test('a saved version stops being Current after the design changes', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('button', { name: 'Save Version' }).click();
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByText('Current', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close version history' }).click();

  const width = page.getByLabel('Width in millimetres');
  await width.fill('900');
  await width.blur();
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByText('Current', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
});

test('the whole-piece material applies without creating a fake override', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Editing: Whole Piece')).toBeVisible();
  await page.getByRole('button', { name: 'Ash' }).click();
  await insertShelf(page);
  await expect(page.getByRole('button', { name: 'Ash' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Reset to default')).toHaveCount(0);
});

test('a freshly inserted Shelf lies flat, not standing upright', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  // Height is the panel's thickness for a Shelf (18mm) — if it were still the
  // pre-fix 300mm, the shelf would stand up like a wall instead of lying flat.
  await expect(page.getByLabel('Height in millimetres')).toHaveValue('18');
  await expect(page.getByLabel('Depth in millimetres')).toHaveValue('300');

  // A flat-on-the-grid shelf is already grounded by construction.
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Snap to Floor' }).click();
  await expect(page.getByText('Already on the floor')).toBeVisible();
});

test('rotation fields set an exact angle and support undo', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  const yAngle = page.getByLabel('Y Angle in degrees');
  await expect(yAngle).toHaveValue('0');

  await yAngle.fill('45');
  await yAngle.blur();
  await expect(yAngle).toHaveValue('45');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Y Angle in degrees')).toHaveValue('0');

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByLabel('Y Angle in degrees')).toHaveValue('45');

  // Reset transform zeroes rotation back out too.
  await page.getByRole('button', { name: 'Reset transform' }).click();
  await expect(page.getByLabel('Y Angle in degrees')).toHaveValue('0');
});

test('switching to cm converts the dimension fields and round-trips back to mm', async ({
  page,
}) => {
  await page.goto('/');
  await insertShelf(page);

  const widthInput = page.getByLabel('Width in millimetres');
  await expect(widthInput).toHaveValue('800');

  await page.getByRole('tab', { name: 'cm' }).click();
  const widthInputCm = page.getByLabel('Width in centimetres');
  await expect(widthInputCm).toHaveValue('80');

  // Editing in cm mode must still commit the correct millimetre value.
  await widthInputCm.fill('90');
  await widthInputCm.blur();
  await expect(widthInputCm).toHaveValue('90');

  await page.getByRole('tab', { name: 'mm' }).click();
  await expect(page.getByLabel('Width in millimetres')).toHaveValue('900');
});

test('the cm setting carries through to the Cut List table and CSV headers', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('tab', { name: 'cm' }).click();

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('W (cm)')).toBeVisible();
  // 800mm wide, 18mm thick (height) shelf reads as 80 / 1.8 in cm.
  await expect(page.getByText('80', { exact: true })).toBeVisible();
  await expect(page.getByText('1.8', { exact: true })).toBeVisible();
});

test('renaming a part from the Properties tab updates the tree and cut list', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  const nameField = page.getByLabel('Part name');
  await expect(nameField).toHaveValue('Shelf');
  await nameField.fill('Top Shelf');
  await nameField.blur();

  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByRole('treeitem', { name: 'Top Shelf Hide Top Shelf' })).toBeVisible();

  // The tree in the (still-visible) left sidebar also shows the new name, so
  // scope to the last match — the Cut List row.
  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('Top Shelf', { exact: true }).last()).toBeVisible();
});

test('renaming a part in the tree via double-click is undoable', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const label = page.getByText('Shelf', { exact: true });
  await label.dblclick();
  const input = page.getByLabel('Rename Shelf');
  await input.fill('Lower Shelf');
  await input.blur();
  await expect(page.getByRole('treeitem', { name: 'Lower Shelf Hide Lower Shelf' })).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('treeitem', { name: 'Shelf Hide Shelf' })).toBeVisible();
});

test('renaming a group updates its tree row and the scope chip', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const rows = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await rows.nth(0).click();
  await rows.nth(1).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group' }).click();

  const groupName = page.getByLabel('Group name');
  await expect(groupName).toHaveValue('Group 1');
  await groupName.fill('Shelf Pair');
  await groupName.blur();

  await expect(page.getByText('Editing: Shelf Pair')).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /Shelf Pair/ })).toBeVisible();
});

test('a blank rename is discarded, keeping the previous name', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  const nameField = page.getByLabel('Part name');
  await nameField.fill('   ');
  await nameField.blur();
  await expect(nameField).toHaveValue('Shelf');
});

test('resizing with the scale gizmo updates the Dimensions fields to match', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await expect(page.locator('canvas')).toBeVisible();

  // Frame the piece so the gizmo lands at a known screen position, then let
  // the eased camera flight settle before reading pixel coordinates off it.
  // The flight eases over rendered frames, not wall-clock time, so this needs
  // real headroom — deep in a long sequential suite the browser can be too
  // busy to hit 60fps, and a tight wait here reads as the drag missing the
  // gizmo entirely.
  await page.getByRole('button', { name: 'Frame' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Scale (S)' }).click();
  await page.waitForTimeout(500);

  const widthInput = page.getByLabel('Width in millimetres');
  await expect(widthInput).toHaveValue('800');

  // Drag the X-axis (red) scale handle outward. Locate it relative to the
  // viewport rather than the page so sidebar/property layout changes do not
  // silently move the target out from under this interaction test.
  const canvasBox = await page.locator('canvas').boundingBox();
  if (!canvasBox) throw new Error('viewport canvas has no bounding box');
  const handleX = canvasBox.x + canvasBox.width * 0.578;
  const handleY = canvasBox.y + canvasBox.height * 0.53;
  await page.mouse.move(handleX - 1, handleY);
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX + 45, handleY + 8, { steps: 5 });
  await page.mouse.move(handleX + 105, handleY + 18, { steps: 5 });
  await page.mouse.up();

  // The drag-end commit flows through a store update and a React re-render
  // before the input reflects it — that's async relative to mouse.up(), so
  // read the value via an auto-waiting assertion rather than a single
  // synchronous inputValue() call, which can catch the pre-commit "800"
  // when the page is busy (e.g. deep in a long sequential suite).
  await expect(widthInput).not.toHaveValue('800');
  const widthAfter = Number(await widthInput.inputValue());
  expect(widthAfter).toBeGreaterThan(800);

  // Only the dragged axis changes — height/depth keep their own values.
  await expect(page.getByLabel('Height in millimetres')).toHaveValue('18');
  await expect(page.getByLabel('Depth in millimetres')).toHaveValue('300');

  // The resize is a real transform commit — undo/redo like any other.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(widthInput).toHaveValue('800');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(widthInput).toHaveValue(String(widthAfter));
});

test('saving to a file and opening it round-trips the document', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByLabel('Part name').fill('Kitchen Shelf');
  await page.getByLabel('Part name').blur();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to File' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled Design.forma.json');
  const path = await download.path();
  if (!path) throw new Error('download did not save to disk');

  // Clear the scene before opening the saved file back in, so re-appearing
  // proves the open actually loaded the file rather than nothing changing.
  await page.getByRole('tab', { name: 'Assembly' }).click();
  await page.getByRole('button', { name: 'Select All' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No parts yet.')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByRole('button', { name: 'Kitchen Shelf' })).toBeVisible();

  // The open is one undo step, so the just-cleared empty scene comes straight back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('No parts yet.')).toBeVisible();
});

test('opening a file that is not a Forma document shows an error instead of clearing the scene', async ({
  page,
}) => {
  await page.goto('/');
  await insertShelf(page);

  const path = test.info().outputPath('not-a-forma-file.json');
  await writeFile(path, JSON.stringify({ hello: 'world' }));

  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByText('Not a Forma file, or an unsupported version')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shelf' }).first()).toBeVisible();
});
