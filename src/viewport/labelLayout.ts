/**
 * Screen-space placement for selection-dimension labels.
 *
 * World-space offsets (`OFFSET_M`, `OVERALL_OFFSET_M` in `selectionGap.ts`)
 * separate the *lines*, but two lines that are far apart in the scene can still
 * project onto the same few pixels — which is how a ¾ view of a cabinet ended
 * up stacking nine measurements on top of each other (BUG-039). This module
 * resolves that after projection, in pixels, and is pure so it unit-tests in
 * Node without a renderer.
 */

export type LabelBox = { x: number; y: number; width: number; height: number };

export type LabelCandidate = {
  /** Index into the caller's label pool. */
  index: number;
  /** Projected anchor, in CSS pixels from the canvas top-left. */
  x: number;
  y: number;
  text: string;
  /** Normalized device depth; nearer labels win a contested slot. */
  depth: number;
  /** Kept in place while its input has focus, so typing never chases a label. */
  pinned?: boolean;
};

export type PlacedLabel = { index: number; x: number; y: number; visible: boolean };

/** Line box of the 11px mono label, including its border and padding. */
export const LABEL_HEIGHT_PX = 20;
const CHAR_WIDTH_PX = 6.7;
const LABEL_PADDING_PX = 14;
const LABEL_GAP_PX = 4;
/** Steps of one label height; past this the label is hidden rather than piled on. */
const MAX_NUDGE_STEPS = 6;

/**
 * The label's on-screen rectangle. The element is centred on `x` and lifted
 * clear of the anchor by `-130%` of its own height, matching the CSS classes in
 * `SelectionDimensions`.
 */
export function labelBox(x: number, y: number, text: string): LabelBox {
  const width = text.length * CHAR_WIDTH_PX + LABEL_PADDING_PX;
  return {
    x: x - width / 2,
    y: y - LABEL_HEIGHT_PX * 1.3,
    width,
    height: LABEL_HEIGHT_PX,
  };
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height + LABEL_GAP_PX &&
    b.y < a.y + a.height + LABEL_GAP_PX
  );
}

/**
 * Places labels so none overlap. Pinned labels go down first and never move;
 * the rest follow nearest-first, each lifted in whole-label steps until it
 * finds clear space. A label with nowhere to go is hidden — an unreadable pile
 * communicates less than one honest gap.
 */
export function layoutLabels(candidates: readonly LabelCandidate[]): PlacedLabel[] {
  const ordered = [...candidates].sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
    return a.depth - b.depth;
  });

  const placedBoxes: LabelBox[] = [];
  const results: PlacedLabel[] = [];

  for (const candidate of ordered) {
    if (candidate.pinned) {
      placedBoxes.push(labelBox(candidate.x, candidate.y, candidate.text));
      results.push({ index: candidate.index, x: candidate.x, y: candidate.y, visible: true });
      continue;
    }

    let y = candidate.y;
    let box = labelBox(candidate.x, y, candidate.text);
    let steps = 0;
    while (placedBoxes.some((other) => overlaps(box, other)) && steps < MAX_NUDGE_STEPS) {
      steps += 1;
      y = candidate.y - steps * (LABEL_HEIGHT_PX + LABEL_GAP_PX);
      box = labelBox(candidate.x, y, candidate.text);
    }

    const visible = !placedBoxes.some((other) => overlaps(box, other));
    if (visible) placedBoxes.push(box);
    results.push({ index: candidate.index, x: candidate.x, y, visible });
  }

  return results.sort((a, b) => a.index - b.index);
}
