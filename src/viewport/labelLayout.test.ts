import { describe, expect, it } from 'vitest';
import { labelBox, layoutLabels, LABEL_HEIGHT_PX, type LabelCandidate } from './labelLayout';

function candidate(overrides: Partial<LabelCandidate> & { index: number }): LabelCandidate {
  return { x: 100, y: 100, text: '400 mm', depth: 0.5, ...overrides };
}

describe('layoutLabels', () => {
  it('leaves labels that do not collide exactly where they projected', () => {
    const placed = layoutLabels([
      candidate({ index: 0, x: 100, y: 100 }),
      candidate({ index: 1, x: 400, y: 300 }),
    ]);
    expect(placed).toEqual([
      { index: 0, x: 100, y: 100, visible: true },
      { index: 1, x: 400, y: 300, visible: true },
    ]);
  });

  it('lifts a label off one that already occupies the same pixels', () => {
    // BUG-039: two witnesses far apart in the scene can project to one point.
    const placed = layoutLabels([
      candidate({ index: 0, x: 200, y: 200, depth: 0.2 }),
      candidate({ index: 1, x: 200, y: 200, depth: 0.6 }),
    ]);
    expect(placed[0]).toEqual({ index: 0, x: 200, y: 200, visible: true });
    expect(placed[1]?.visible).toBe(true);
    expect(placed[1]!.y).toBeLessThan(200 - LABEL_HEIGHT_PX);
    expect(overlapping(placed.map((p) => ({ ...p, text: '400 mm' })))).toBe(false);
  });

  it('keeps the nearest label in place and moves the one behind it', () => {
    const placed = layoutLabels([
      candidate({ index: 0, x: 200, y: 200, depth: 0.9 }),
      candidate({ index: 1, x: 200, y: 200, depth: 0.1 }),
    ]);
    expect(placed[1]).toEqual({ index: 1, x: 200, y: 200, visible: true });
    expect(placed[0]!.y).not.toBe(200);
  });

  it('never moves the label being typed into, whatever its depth', () => {
    const placed = layoutLabels([
      candidate({ index: 0, x: 200, y: 200, depth: 0.1 }),
      candidate({ index: 1, x: 200, y: 200, depth: 0.9, pinned: true }),
    ]);
    expect(placed[1]).toEqual({ index: 1, x: 200, y: 200, visible: true });
    expect(placed[0]!.y).not.toBe(200);
  });

  it('hides a label with nowhere left to go rather than piling it up', () => {
    const stacked = Array.from({ length: 10 }, (_, index) =>
      candidate({ index, x: 200, y: 200, depth: index / 10 }),
    );
    const placed = layoutLabels(stacked);
    expect(placed.some((label) => !label.visible)).toBe(true);
    expect(overlapping(placed.filter((l) => l.visible).map((p) => ({ ...p, text: '400 mm' }))))
      .toBe(false);
  });

  it('returns results in the caller’s original index order', () => {
    const placed = layoutLabels([
      candidate({ index: 2, depth: 0.1 }),
      candidate({ index: 0, depth: 0.9 }),
      candidate({ index: 1, depth: 0.5 }),
    ]);
    expect(placed.map((label) => label.index)).toEqual([0, 1, 2]);
  });

  it('widens the collision box with the label text', () => {
    expect(labelBox(100, 100, 'W 1,200 mm').width).toBeGreaterThan(labelBox(100, 100, '5 mm').width);
  });
});

function overlapping(labels: readonly { x: number; y: number; text: string }[]): boolean {
  const boxes = labels.map((label) => labelBox(label.x, label.y, label.text));
  return boxes.some((a, i) =>
    boxes.some(
      (b, j) =>
        i !== j &&
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height,
    ),
  );
}
