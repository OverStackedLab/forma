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

/** Fresh contexts start in cm. Tests that fill millimetre fields opt into mm. */
async function useMm(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'mm' }).click();
}

async function gotoMm(page: Page): Promise<void> {
  await page.goto('/');
  await useMm(page);
}

/**
 * Force the plain-download path in older builds that still called
 * showSaveFilePicker. Chromium exposes that API; Playwright cannot drive it.
 */
async function gotoWithDownloadFallback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
  await page.goto('/');
}

// Playwright gives each test a fresh browser context, so localStorage starts
// empty without an init script — and an init script would also wipe it on the
// reload the persistence test depends on.

test('boots to an empty scene with no starting model', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'cm' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'mm' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'in' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Panels' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fronts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hardware' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shelf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Door' })).toBeVisible();
  await expect(page.getByRole('button', { name: /ENHET/ })).toBeVisible();

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
  await expect(page.getByText('Nothing to manufacture yet.')).toHaveCount(0);
  await expect(page.getByText('Sheets Needed')).toBeVisible();
  await expect(page.getByText('total pieces')).toBeVisible();
});

test('inserting a prebuilt cabinet creates one grouped open carcass and six cut-list parts', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await expect(page.getByText('Base 600 cabinet added')).toBeVisible();

  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByText('6 selected')).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /Base 600/ }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('Sheet Goods', { exact: true })).toBeVisible();
  await expect(page.getByText('Base 600 Side', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Base 600 Shelf', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Base 600 Door', { exact: true })).toHaveCount(0);
});

test('cabinet shelves can be added at a position and distributed by spacing', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await expect(page.getByText('6 parts').first()).toBeVisible();

  // The preset's single shelf sits at the interior centre.
  await expect(page.getByLabel('Shelf 1 position in millimetres')).toHaveValue('400');

  // "I need one panel at 30 cm."
  await page.getByLabel('New shelf position in millimetres').fill('300');
  await page.getByRole('button', { name: 'Add Shelf' }).click();
  await expect(page.getByText('Shelf added at 300 mm')).toBeVisible();
  await expect(page.getByText('7 parts').first()).toBeVisible();
  await expect(page.getByLabel('Shelf 1 position in millimetres')).toHaveValue('300');
  await expect(page.getByLabel('Shelf 2 position in millimetres')).toHaveValue('400');

  // "I need n panels at a distance of n cm" — 3 shelves every 200 mm.
  await page.getByLabel('Shelf count').fill('3');
  await page.getByLabel('Shelf spacing in millimetres').fill('200');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('3 shelves every 200 mm')).toBeVisible();
  await expect(page.getByText('8 parts').first()).toBeVisible();
  await expect(page.getByLabel('Shelf 3 position in millimetres')).toHaveValue('618');

  // A shelf can be removed, and the whole edit history unwinds.
  await page.getByRole('button', { name: 'Remove shelf 1' }).click();
  await expect(page.getByText('Shelf removed')).toBeVisible();
  await expect(page.getByText('7 parts').first()).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('8 parts').first()).toBeVisible();
});

test('cabinet panels can be added at a position and distributed by spacing', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await expect(page.getByText('6 parts').first()).toBeVisible();

  await page.getByLabel('New panel position in millimetres').fill('300');
  await page.getByRole('button', { name: 'Add Panel' }).click();
  await expect(page.getByText('Panel added at 300 mm')).toBeVisible();
  await expect(page.getByText('8 parts').first()).toBeVisible();
  await expect(page.getByLabel('Panel 1 position in millimetres')).toHaveValue('300');

  await page.getByRole('button', { name: 'Add Panel' }).click();
  await expect(page.getByText('Panel added at 400 mm')).toBeVisible();
  await expect(page.getByLabel('Panel 2 position in millimetres')).toHaveValue('400');

  await page.getByLabel('Panel count').fill('3');
  await page.getByLabel('Panel spacing in millimetres').fill('200');
  await page.getByRole('button', { name: 'Apply Panels' }).click();
  await expect(page.getByText('Only 2 of 3 panels fit')).toBeVisible();
  await expect(page.getByText('10 parts').first()).toBeVisible();
  await expect(page.getByLabel('Panel 2 position in millimetres')).toHaveValue('418');

  await page.getByRole('button', { name: 'Remove panel 1' }).click();
  await expect(page.getByText('Panel removed')).toBeVisible();
  await expect(page.getByText('8 parts').first()).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('10 parts').first()).toBeVisible();
});

test('duplicating an interior panel adds the next free centreline like Add Panel', async ({
  page,
}) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByLabel('New panel position in millimetres').fill('300');
  await page.getByRole('button', { name: 'Add Panel' }).click();
  await expect(page.getByText('Panel added at 300 mm')).toBeVisible();

  await page.getByRole('tab', { name: 'Assembly' }).click();
  await page.getByRole('treeitem', { name: /Panel 1/ }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Panel added at 400 mm')).toBeVisible();
  await expect(page.getByLabel('Panel 2 position in millimetres')).toHaveValue('400');
  await expect(page.getByText('10 parts').first()).toBeVisible();
  await expect(page.getByLabel('Panel 1 position in millimetres')).toHaveValue('300');
});

test('deleting a panel updates the tree, the count and the cut list together', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('treeitem', { name: 'Shelf Hide Shelf' })).toHaveCount(0);
  await expect(page.getByText('0 parts').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('Nothing to manufacture yet.')).toBeVisible();
});

test('a prebuilt cabinet resizes from nominal dimensions without changing panel thickness', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();

  const width = page.getByLabel('Cabinet Width in millimetres');
  await expect(width).toHaveValue('600');
  await width.fill('800');
  await width.blur();
  await expect(width).toHaveValue('800');

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('Base 800 Side', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('764', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('18', { exact: true }).first()).toBeVisible();
});

test('round hardware has purpose-built dimensions, finish and purchasing output', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Knob' }).click();

  await expect(page.getByLabel('Diameter in millimetres')).toHaveValue('32');
  await expect(page.getByLabel('Projection in millimetres')).toHaveValue('25');
  await expect(page.getByRole('button', { name: 'Matte Black' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByRole('heading', { name: 'Purchased Hardware' })).toBeVisible();
  await expect(page.getByText('Knob', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Matte Black', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Sheet Goods', { exact: true })).toHaveCount(0);
});

test('ENHET legs insert as purchased hardware with diameter and height', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /ENHET/ }).click();
  await expect(page.getByText('ENHET added to scene')).toBeVisible();

  await expect(page.getByLabel('Diameter in millimetres')).toHaveValue('50');
  await expect(page.getByLabel('Height in millimetres')).toHaveValue('125');

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByRole('heading', { name: 'Purchased Hardware' })).toBeVisible();
  await expect(page.getByText('ENHET', { exact: true }).last()).toBeVisible();
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

test('arrow keys nudge while the move gizmo is active', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Front', exact: true }).first().click();
  await page.getByRole('button', { name: 'Move (G)' }).click();

  const xPosition = page.getByLabel('X Position in millimetres');
  await expect(xPosition).toHaveValue('0');
  await page.keyboard.press('ArrowRight');
  await expect(xPosition).toHaveValue('1');

  await page.keyboard.press('Shift+ArrowRight');
  await expect(xPosition).toHaveValue('101');

  await page.getByRole('button', { name: 'Select (Q)' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(xPosition).toHaveValue('101');
});

test('a panel dimension change is undoable and redoable', async ({ page }) => {
  await gotoMm(page);
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
  await expect(page.locator('canvas')).toBeVisible();
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

test('the Properties tab has its own finish picker, in sync with Finish', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await expect(page.getByRole('tab', { name: 'Properties' })).toHaveAttribute('aria-selected', 'true');

  // Apply a finish without ever visiting the Finish tab.
  await page.getByRole('button', { name: 'Dark Gray' }).click();
  await expect(page.getByRole('button', { name: 'Dark Gray' })).toHaveAttribute('aria-pressed', 'true');

  // Finish reflects the same override for the same part — one shared
  // FinishPicker, not two copies that could drift apart.
  await page.getByRole('tab', { name: 'Color' }).click();
  await expect(page.getByText('Editing: Shelf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark Gray' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Use design color')).toBeVisible();
});

test('a mixed-finish selection is clear and can be unified in one click', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('button', { name: 'Oak', exact: true }).click();
  await insertShelf(page);
  await page.getByRole('button', { name: 'Dark Gray' }).click();
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });

  await expect(page.getByText('Mixed colors')).toBeVisible();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await expect(page.getByText('Mixed colors')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'White', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('render mode hides the sidebars and exposes camera presets', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Render' }).click();

  await expect(page.getByRole('tab', { name: 'Assembly' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export Image' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Front', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Side', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Top', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '3D' })).toBeVisible();
});

test('model mode offers front, side and top views', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByRole('button', { name: 'Frame' })).toBeVisible();
});

test('grouping two panels lets you reselect and ungroup them as one unit', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Group' }).click();
  await expect(page.getByText('Editing: Group 1')).toBeVisible();
  await expect(page.getByText('Rigid group · 2 pieces')).toBeVisible();
  await expect(page.getByLabel('Group X Position in millimetres')).toHaveValue('440');
  await expect(page.getByLabel('Group Y Angle in degrees')).toHaveValue('0');
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

test('a regular group resizes its members and spacing together from exact dimensions', async ({
  page,
}) => {
  await gotoMm(page);
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Group' }).click();

  const groupWidth = page.getByLabel('Group Width in millimetres');
  await expect(groupWidth).toHaveValue('1680');
  await groupWidth.fill('840');
  await groupWidth.blur();
  await expect(groupWidth).toHaveValue('840');

  // Both the member size and its offset from the shared 440 mm pivot scale by
  // 0.5, rather than only stretching one piece or collapsing the pair.
  await shelves.nth(1).click();
  await expect(page.getByLabel('Width in millimetres')).toHaveValue('400');
  await expect(page.getByLabel('X Position in millimetres')).toHaveValue('660');

  await page.getByRole('treeitem', { name: /Group 1/ }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(groupWidth).toHaveValue('1680');

  await page.getByRole('tab', { name: 'cm' }).click();
  await expect(page.getByLabel('Group Width in centimetres')).toHaveValue('168');
});

test('viewport clicks select one grouped piece while the Assembly group row selects the group', async ({
  page,
}) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  const canvasBox = await page.locator('canvas').boundingBox();
  if (!canvasBox) throw new Error('viewport canvas has no bounding box');
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height * 0.54);

  await expect(page.getByLabel('Part name')).toBeVisible();
  await expect(page.getByLabel('Cabinet Width in millimetres')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Shelf' })).toBeVisible();

  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByText('1 selected')).toBeVisible();
  await page.getByRole('treeitem', { name: /Select Base 600 .*Base 600 6 Hide Base 600/ }).click();
  await expect(page.getByText('Editing: Base 600')).toBeVisible();
  await expect(page.getByText('Configurable cabinet · 6 pieces')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Shelf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Panel' })).toBeVisible();
  await expect(page.getByLabel('Group X Position in millimetres')).toHaveValue('0');
  await expect(page.getByLabel('Group Y Position in millimetres')).toHaveValue('0');
});

test('duplicating one cabinet piece copies only that piece', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  const canvasBox = await page.locator('canvas').boundingBox();
  if (!canvasBox) throw new Error('viewport canvas has no bounding box');
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height * 0.54);
  await expect(page.getByRole('button', { name: 'Add Shelf' })).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Part duplicated')).toBeVisible();
  await expect(page.getByText('7 parts').first()).toBeVisible();
});

test('a demoted cabinet can restore Add Shelf from its pieces', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();

  const canvasBox = await page.locator('canvas').boundingBox();
  if (!canvasBox) throw new Error('viewport canvas has no bounding box');
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height * 0.54);
  await expect(page.getByRole('button', { name: 'Add Shelf' })).toBeVisible();

  const heightInput = page.getByLabel('Height in millimetres');
  await heightInput.fill('700');
  await heightInput.blur();
  await expect(page.getByRole('button', { name: 'Add Shelf' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore cabinet' })).toBeVisible();

  await page.getByRole('button', { name: 'Restore cabinet' }).click();
  await expect(page.getByText('Cabinet controls restored')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Shelf' })).toBeVisible();
});

test('Snap Together connects two pieces and is undoable', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await expect(shelves).toHaveCount(2);
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });
  // Snap Together is backed by the lazy-loaded Three.js viewport API.
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Snap Together' }).click();
  await expect(page.getByText('Shelf snapped to Shelf')).toBeVisible();

  await shelves.nth(1).click();
  const xPosition = page.getByLabel('X Position in millimetres');
  await expect(xPosition).toHaveValue('800');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(xPosition).toHaveValue('880');
});

test('Snap Together moves a whole group without breaking its cabinet configuration', async ({
  page,
}) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const cabinets = page.getByRole('treeitem', {
    name: /Select Base 600 .*Base 600 6 Hide Base 600/,
  });
  await expect(cabinets).toHaveCount(2);
  await cabinets.nth(0).click();
  await cabinets.nth(1).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Snap Together' }).click();
  await expect(page.getByText('Base 600 snapped to Base 600')).toBeVisible();

  await cabinets.nth(1).click();
  await expect(page.getByLabel('Group X Position in millimetres')).toHaveValue('600');
  await expect(page.getByLabel('Cabinet Width in millimetres')).toHaveValue('600');
});

test('Align Left lines a wall cabinet up with a floor cabinet without dropping it', async ({
  page,
}) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: /Wall 600/ }).click();
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const base = page.getByRole('treeitem', {
    name: /Select Base 600 .*Base 600 6 Hide Base 600/,
  });
  const wall = page.getByRole('treeitem', {
    name: /Select Wall 600 .*Wall 600 6 Hide Wall 600/,
  });
  await wall.click();
  const wallY = page.getByLabel('Group Y Position in millimetres');
  const hangHeight = await wallY.inputValue();
  const wallX = page.getByLabel('Group X Position in millimetres');
  const offsetX = await wallX.inputValue();
  expect(offsetX).not.toBe('0');

  await base.click();
  await wall.click({ modifiers: ['Shift'] });
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Align Left' }).click();
  await expect(page.getByText('Wall 600 aligned left with Base 600')).toBeVisible();

  await wall.click();
  await expect(wallX).toHaveValue('0');
  await expect(wallY).toHaveValue(hangHeight);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(wallX).toHaveValue(offsetX);
  await expect(wallY).toHaveValue(hangHeight);
});

test('duplicating a group creates an independently editable grouped copy', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Base 600 group duplicated')).toBeVisible();
  await expect(page.getByText('12 parts').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByText('6 selected')).toBeVisible();

  // The copied cabinet keeps its parametric controls and can change without
  // rebuilding the original group.
  const width = page.getByLabel('Cabinet Width in millimetres');
  await width.fill('800');
  await width.blur();
  await expect(page.getByRole('treeitem', { name: /Base 600/ }).first()).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /Base 800/ }).first()).toBeVisible();

  // One undo restores the copy's dimensions; a second removes the duplicate.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(width).toHaveValue('600');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('6 parts').first()).toBeVisible();
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

test('snap to floor preserves a fully selected cabinet structure', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('tab', { name: 'Assembly' }).click();
  await page.getByRole('button', { name: 'Select All' }).click();
  await expect(page.locator('canvas')).toBeVisible();

  // The cabinet is already grounded as a whole. The old implementation moved
  // its top and shelf down independently even though its sides touched y=0.
  await page.getByRole('button', { name: 'Snap to Floor' }).click();
  await expect(page.getByText('Already on the floor')).toBeVisible();

  await page.getByRole('treeitem', { name: /Base 600 Top Hide/ }).click();
  await expect(page.getByLabel('Y Position in millimetres')).toHaveValue('711');
});

test('changing a panel height keeps its grounded face anchored', async ({
  page,
}) => {
  await gotoMm(page);
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
  await gotoMm(page);
  await insertShelf(page);

  const xPosition = page.getByLabel('X Position in millimetres');
  await xPosition.fill('409');
  await xPosition.blur();
  await expect(xPosition).toHaveValue('409');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(xPosition).toHaveValue('0');
});

test('a saved version stops being Current after the design changes', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await page.getByRole('button', { name: 'Save Version' }).click();
  await expect(page.getByText('Saved Version 1')).toBeVisible();
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByText('Current', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Version 1' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled Design - Version 1.forma.json');
  await page.getByRole('button', { name: 'Close version history' }).click();

  const width = page.getByLabel('Width in millimetres');
  await width.fill('900');
  await width.blur();
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByText('Current', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
});

test('the whole-piece finish applies without creating a fake override', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Editing: Whole Piece')).toBeVisible();
  await page.getByRole('button', { name: 'Oak', exact: true }).click();
  await insertShelf(page);
  await expect(page.getByRole('button', { name: 'Oak', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Use design color')).toHaveCount(0);
});

test('a freshly inserted Shelf lies flat, not standing upright', async ({ page }) => {
  await gotoMm(page);
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

test('group rotation fields turn every member around the shared pivot', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await insertShelf(page);
  await page.getByRole('tab', { name: 'Assembly' }).click();
  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group' }).click();

  const yAngle = page.getByLabel('Group Y Angle in degrees');
  await expect(yAngle).toHaveValue('0');
  await yAngle.fill('45');
  await yAngle.blur();
  await expect(yAngle).toHaveValue('45');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Group Y Angle in degrees')).toHaveValue('0');
});

test('selecting two groups shows shared position and rotation sliders', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const cabinets = page.getByRole('treeitem', {
    name: /Select Base 600 .*Base 600 6 Hide Base 600/,
  });
  await cabinets.nth(0).click();
  await cabinets.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('12 selected')).toBeVisible();

  await expect(page.getByLabel('X Position in millimetres')).toBeVisible();
  const yAngle = page.getByLabel('Y Angle in degrees');
  await expect(yAngle).toHaveValue('0');
  await yAngle.fill('45');
  await yAngle.blur();
  await expect(yAngle).toHaveValue('45');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Y Angle in degrees')).toHaveValue('0');
});

test('Assembly group checkboxes add a second group without replacing the first', async ({
  page,
}) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await page.getByRole('tab', { name: 'Assembly' }).click();

  const boxes = page.getByRole('checkbox', { name: 'Select Base 600' });
  await expect(boxes).toHaveCount(2);
  // The last insert is already selected. Checking the other group adds it.
  await expect(page.getByText('6 selected')).toBeVisible();
  await expect(boxes.nth(1)).toBeChecked();
  await boxes.nth(0).click();
  await expect(page.getByText('12 selected')).toBeVisible();
  await expect(page.getByLabel('X Position in millimetres')).toBeVisible();
  await boxes.nth(0).click();
  await expect(page.getByText('6 selected')).toBeVisible();
  await expect(page.getByText('Editing: Base 600')).toBeVisible();
});

test('two selected panels show the clearance between them', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await insertShelf(page);
  await expect(page.locator('canvas')).toBeVisible();
  const yPosition = page.getByLabel('Y Position in millimetres');
  await yPosition.fill('200');
  await yPosition.blur();
  await page.getByRole('tab', { name: 'Assembly' }).click();
  const shelves = page.getByRole('treeitem', { name: 'Shelf Hide Shelf' });
  await shelves.nth(0).click();
  await shelves.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('selection-dimension').filter({ hasText: '173 mm' })).toBeVisible();
});

test('a selected panel shows clearance to the nearest facing neighbour', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await insertShelf(page);
  await expect(page.locator('canvas')).toBeVisible();
  const yPosition = page.getByLabel('Y Position in millimetres');
  await yPosition.fill('200');
  await yPosition.blur();
  await expect(page.getByTestId('selection-dimension').filter({ hasText: '173 mm' })).toBeVisible();
});

test('clicking a clearance label sets the gap', async ({ page }) => {
  await gotoMm(page);
  await insertShelf(page);
  await insertShelf(page);
  await expect(page.locator('canvas')).toBeVisible();
  const yPosition = page.getByLabel('Y Position in millimetres');
  await yPosition.fill('200');
  await yPosition.blur();
  const label = page.getByTestId('selection-dimension').filter({ hasText: '173 mm' });
  await expect(label).toBeVisible();
  await label.click();
  const input = page.getByRole('textbox', { name: 'Clearance' });
  await expect(input).toBeVisible();
  await input.fill('200');
  await input.press('Enter');
  await expect(page.getByTestId('selection-dimension').filter({ hasText: '200 mm' })).toBeVisible();
});

test('a selected cabinet shows overall width, height, and depth', async ({ page }) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await expect(page.getByText('Base 600 cabinet added')).toBeVisible();
  await expect(page.getByTestId('selection-overall-dimension').filter({ hasText: 'W 600 mm' })).toBeVisible();
  await expect(page.getByTestId('selection-overall-dimension').filter({ hasText: 'H 800 mm' })).toBeVisible();
  await expect(page.getByTestId('selection-overall-dimension').filter({ hasText: 'D 600 mm' })).toBeVisible();

  await page.getByRole('tab', { name: 'Assembly' }).click();
  await page.getByRole('treeitem', { name: /Base 600 Top Hide/ }).click();
  await expect(page.getByTestId('selection-overall-dimension').filter({ hasText: 'H 800 mm' })).toBeVisible();
});

test('switching to mm converts the dimension fields and round-trips back to cm', async ({
  page,
}) => {
  await page.goto('/');
  await insertShelf(page);

  const widthInput = page.getByLabel('Width in centimetres');
  await expect(widthInput).toHaveValue('80');

  await page.getByRole('tab', { name: 'mm' }).click();
  const widthInputMm = page.getByLabel('Width in millimetres');
  await expect(widthInputMm).toHaveValue('800');

  // Editing in mm mode must still commit the correct millimetre value.
  await widthInputMm.fill('900');
  await widthInputMm.blur();
  await expect(widthInputMm).toHaveValue('900');

  await page.getByRole('tab', { name: 'cm' }).click();
  await expect(page.getByLabel('Width in centimetres')).toHaveValue('90');
});

test('switching to inches converts the dimension fields', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  await page.getByRole('tab', { name: 'in' }).click();
  const widthInput = page.getByLabel('Width in inches');
  await expect(widthInput).toHaveValue('31.5');

  await widthInput.fill('36');
  await widthInput.blur();
  await page.getByRole('tab', { name: 'mm' }).click();
  await expect(page.getByLabel('Width in millimetres')).toHaveValue('914');
});

test('the cm setting carries through to the Cut List table and CSV headers', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('W (cm)')).toBeVisible();
  // 800mm wide, 18mm thick (height) shelf reads as 80 / 1.8 in cm.
  await expect(page.getByText('80', { exact: true })).toBeVisible();
  await expect(page.getByText('1.8', { exact: true }).first()).toBeVisible();
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
  await gotoMm(page);
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

test('resizing a cabinet with the scale gizmo updates its parametric dimensions', async ({
  page,
}) => {
  await gotoMm(page);
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Base 600/ }).click();
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: 'Frame' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Scale (S)' }).click();
  await page.waitForTimeout(500);

  const width = page.getByLabel('Cabinet Width in millimetres');
  await expect(width).toHaveValue('600');
  await expect(page.getByLabel('Cabinet Height in millimetres')).toHaveValue('800');
  await expect(page.getByLabel('Cabinet Depth in millimetres')).toHaveValue('600');

  const canvasBox = await page.locator('canvas').boundingBox();
  if (!canvasBox) throw new Error('viewport canvas has no bounding box');
  const handleX = canvasBox.x + canvasBox.width * 0.578;
  const handleY = canvasBox.y + canvasBox.height * 0.53;
  await page.mouse.move(handleX - 1, handleY);
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX + 55, handleY + 8, { steps: 5 });
  await page.mouse.move(handleX + 110, handleY + 18, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByText('Cabinet dimensions updated')).toBeVisible();
  await expect(width).not.toHaveValue('600');
  await expect(page.getByLabel('Cabinet Height in millimetres')).toHaveValue('800');
  await expect(page.getByLabel('Cabinet Depth in millimetres')).toHaveValue('600');

  // The gesture rebuilds the cabinet instead of stretching sheet thickness.
  await page.getByRole('tab', { name: 'Cut List' }).click();
  await expect(page.getByText('18', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('tab', { name: 'Model' }).click();
  await expect(width).toHaveValue('600');
});

test('saving to a file and opening it round-trips the document', async ({ page }) => {
  await gotoWithDownloadFallback(page);
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

test('saving still downloads when the native picker aborts immediately', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to File' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled Design.forma.json');
  await expect(page.getByText('Saved Untitled Design')).toBeVisible();
});

test('creating a new file can be cancelled and then starts a clean persisted design', async ({
  page,
}) => {
  await page.goto('/');
  await insertShelf(page);
  const gridSize = page.getByLabel('Grid size in centimetres');
  await expect(gridSize).toHaveValue('400');
  await gridSize.fill('600');
  await gridSize.blur();
  await expect(gridSize).toHaveValue('600');

  await page.getByRole('button', { name: 'New File' }).click();
  await expect(page.getByRole('dialog', { name: 'Create a new design?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('1 part').first()).toBeVisible();

  await page.getByRole('button', { name: 'New File' }).click();
  await page.getByRole('button', { name: "Don't save" }).click();
  await expect(page.getByText('New design created')).toBeVisible();
  await expect(page.getByText('Untitled Design', { exact: true })).toBeVisible();
  await expect(page.getByText('No parts yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  // New resets document state, not the user's workspace preferences.
  await expect(page.getByRole('tab', { name: 'cm' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Grid size in centimetres')).toHaveValue('600');

  await expect(page.getByText('Autosaved')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No parts yet.')).toBeVisible();
});

test('new file can save a copy then start a clean design', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);
  await page.getByRole('button', { name: 'New File' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled Design.forma.json');
  await expect(page.getByText('New design created')).toBeVisible();
  await expect(page.getByText('No parts yet.')).toBeVisible();
});

test('renaming the document drives the downloaded filename without extra dialogs', async ({
  page,
}) => {
  await gotoWithDownloadFallback(page);

  const title = page.getByText('Untitled Design', { exact: true });
  await title.dblclick();
  const input = page.getByLabel('Document title');
  await input.fill('Kitchen Remodel');
  await input.blur();
  await expect(page.getByText('Kitchen Remodel', { exact: true })).toBeVisible();

  // No prompt is expected here — any dialog would fail the test by hanging the click.
  page.on('dialog', () => {
    throw new Error('Save to File must not open a JS dialog');
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to File' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Kitchen Remodel.forma.json');

  // Survives a reload like the rest of the document.
  await page.reload();
  await expect(page.getByText('Kitchen Remodel', { exact: true })).toBeVisible();
});

test('opening a file sets the header from the on-disk filename', async ({ page }) => {
  await page.goto('/');

  const path = test.info().outputPath('From Disk.forma.json');
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 4,
      doc: {
        defaultMaterialId: 'ash',
        defaultColorId: 'white',
        defaultHardwareFinishId: 'matte-black',
        overrides: {},
        customParts: [],
        hiddenIds: [],
        transforms: {},
        groups: [],
        docTitle: 'Inside JSON',
        versions: [],
        currentVersionId: null,
      },
    }),
  );

  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByText('From Disk', { exact: true })).toBeVisible();
  await expect(page.getByText('Inside JSON', { exact: true })).toHaveCount(0);
});

test('a blank document rename is discarded, keeping the previous title', async ({ page }) => {
  await page.goto('/');

  const title = page.getByText('Untitled Design', { exact: true });
  await title.dblclick();
  const input = page.getByLabel('Document title');
  await input.fill('   ');
  await input.blur();
  await expect(page.getByText('Untitled Design', { exact: true })).toBeVisible();
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

test('opening an empty file explains that the save may not have finished', async ({ page }) => {
  await page.goto('/');
  await insertShelf(page);

  const path = test.info().outputPath('empty-save.forma.json');
  await writeFile(path, '');

  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByText('That file is empty. It may not have finished saving.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shelf' }).first()).toBeVisible();
});

test('opening a schema-4 file with a UTF-8 BOM still loads', async ({ page }) => {
  await page.goto('/');

  const path = test.info().outputPath('Bom File.forma.json');
  await writeFile(
    path,
    `\uFEFF${JSON.stringify({
      schemaVersion: '4',
      doc: {
        defaultMaterialId: 'ash',
        defaultColorId: 'white',
        defaultHardwareFinishId: 'matte-black',
        overrides: {},
        customParts: [],
        hiddenIds: [],
        transforms: {},
        groups: [],
        docTitle: 'Inside JSON',
        versions: [],
        currentVersionId: null,
      },
    })}`,
  );

  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByText('Bom File', { exact: true })).toBeVisible();
});

test('the grid size preference survives a reload', async ({ page }) => {
  // The console-error assertion is the load-bearing half: resizing the grid
  // rebuilds GL resources, and touching a disposed one surfaces here as an
  // error rather than as anything visible in the DOM.
  const errors = failOnConsoleErrors(page);
  await page.goto('/');

  const gridSize = page.getByLabel('Grid size in centimetres');
  await expect(gridSize).toHaveValue('400');

  // Unlike the old preset selector, the field accepts custom grid extents.
  await gridSize.fill('550');
  await gridSize.blur();
  await expect(gridSize).toHaveValue('550');

  // It follows the same global mm/cm/in display preference as other dimensions.
  await page.getByRole('tab', { name: 'mm' }).click();
  const gridSizeMm = page.getByLabel('Grid size in millimetres');
  await expect(gridSizeMm).toHaveValue('5500');
  await gridSizeMm.fill('6000');
  await gridSizeMm.blur();
  await expect(gridSizeMm).toHaveValue('6000');

  await page.getByRole('tab', { name: 'cm' }).click();
  await expect(page.getByLabel('Grid size in centimetres')).toHaveValue('600');
  await expect(page.locator('canvas')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Grid size in centimetres')).toHaveValue('600');
  await expect(page.locator('canvas')).toBeVisible();

  expect(errors).toEqual([]);
});

test('changing grid size keeps a hidden grid hidden and leaves parts alone', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await gotoMm(page);
  await insertShelf(page);

  // A rebuilt GridHelper defaults to visible, so the toggle state has to be
  // carried across the rebuild rather than reset by it.
  const gridToggle = page.getByRole('button', { name: 'Toggle grid' });
  await gridToggle.click();
  await expect(gridToggle).toHaveAttribute('aria-pressed', 'false');

  const gridSize = page.getByLabel('Grid size in millimetres');
  await gridSize.fill('20000');
  await gridSize.blur();
  await expect(gridToggle).toHaveAttribute('aria-pressed', 'false');

  // Grid size is a view setting — it must not touch the document.
  await page.getByRole('tab', { name: 'Assembly' }).click();
  await expect(page.getByRole('button', { name: 'Shelf' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  expect(errors).toEqual([]);
});
