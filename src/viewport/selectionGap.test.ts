import { describe, expect, it } from 'vitest';
import {
  axisGap,
  axisRelation,
  coplanarAlignments,
  facesOnAxis,
  gapDeltaMm,
  gapsBetweenBoxes,
  nearestFacingGaps,
  overallDimensions,
  sharedOnAxis,
  type Aabb,
} from './selectionGap';

function box(min: [number, number, number], max: [number, number, number]): Aabb {
  return {
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
  };
}

describe('axisGap', () => {
  it('measures the clearance when A sits left of B', () => {
    const a = box([0, 0, 0], [0.1, 0.1, 0.1]);
    const b = box([0.2, 0, 0], [0.3, 0.1, 0.1]);
    expect(axisGap(a, b, 'x')).toEqual({ low: 0.1, high: 0.2, gapM: 0.1 });
    expect(axisGap(a, b, 'y')).toBeNull();
  });

  it('ignores a hairline float gap', () => {
    const a = box([0, 0, 0], [0.1, 0.1, 0.1]);
    const b = box([0.1002, 0, 0], [0.2, 0.1, 0.1]);
    expect(axisGap(a, b, 'x')).toBeNull();
  });
});

describe('axisRelation', () => {
  it('treats flush faces as an alignment, not a gap', () => {
    const a = box([0, 0, 0], [0.1, 0.1, 0.1]);
    const b = box([0.1, 0, 0], [0.2, 0.1, 0.1]);
    expect(axisRelation(a, b, 'x')).toEqual({ low: 0.1, high: 0.1, gapM: 0, kind: 'align' });
    expect(axisGap(a, b, 'x')).toBeNull();
  });

  it('treats a hairline separation as flush alignment', () => {
    const a = box([0, 0, 0], [0.1, 0.1, 0.1]);
    const b = box([0.1002, 0, 0], [0.2, 0.1, 0.1]);
    expect(axisRelation(a, b, 'x')).toMatchObject({ gapM: 0, kind: 'align' });
  });

  it('treats a millimetre of overlap as flush so a settled snap still reads', () => {
    const a = box([0, 0, 0], [0.1, 0.1, 0.1]);
    const b = box([0.099, 0, 0], [0.2, 0.1, 0.1]);
    expect(axisRelation(a, b, 'x')).toMatchObject({ gapM: 0, kind: 'align' });
  });

  it('stays quiet when the interiors overlap', () => {
    const a = box([0, 0, 0], [0.1, 0.1, 0.1]);
    const b = box([0.05, 0, 0], [0.15, 0.1, 0.1]);
    expect(axisRelation(a, b, 'x')).toBeNull();
  });
});

describe('sharedOnAxis', () => {
  it('uses the overlap midpoint when the boxes share a span', () => {
    const a = box([0, 0, 0], [1, 0.2, 0.4]);
    const b = box([0.2, 0.1, 0.1], [0.8, 0.3, 0.5]);
    expect(sharedOnAxis(a, b, 'x')).toBeCloseTo(0.5);
  });
});

describe('gapsBetweenBoxes', () => {
  it('draws an X dimension between two side-by-side panels', () => {
    const a = box([0, 0, 0], [0.4, 0.8, 0.3]);
    const b = box([0.5, 0, 0], [0.9, 0.8, 0.3]);
    const gaps = gapsBetweenBoxes(a, b);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.axis).toBe('x');
    expect(gaps[0]?.gapMm).toBeCloseTo(100);
    expect(gaps[0]?.kind).toBe('gap');
    expect(gaps[0]?.movableIsHigh).toBe(true);
    expect(gaps[0]?.line[0].x).toBeCloseTo(0.4);
    expect(gaps[0]?.line[1].x).toBeCloseTo(0.5);
    expect(gaps[0]?.line[0].z).toBeCloseTo(gaps[0]?.line[1].z ?? 0);
  });

  it('draws a Y dimension between a stacked pair and leaves overlapping axes off', () => {
    const lower = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const upper = box([0, 0.2, 0], [0.8, 0.218, 0.3]);
    const gaps = gapsBetweenBoxes(lower, upper);
    expect(gaps.map((gap) => gap.axis)).toEqual(['y']);
    expect(gaps[0]?.gapMm).toBeCloseTo(182);
    expect(gaps[0]?.movableIsHigh).toBe(true);
  });

  it('marks the second box as low when it sits below the first', () => {
    const lower = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const upper = box([0, 0.2, 0], [0.8, 0.218, 0.3]);
    const gaps = gapsBetweenBoxes(upper, lower);
    expect(gaps[0]?.movableIsHigh).toBe(false);
  });

  it('draws a flush alignment when stacked faces touch', () => {
    const lower = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const upper = box([0, 0.018, 0], [0.8, 0.036, 0.3]);
    const gaps = gapsBetweenBoxes(lower, upper);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ axis: 'y', kind: 'align', gapMm: 0, movableIsHigh: true });
    const line = gaps[0]?.line;
    expect(line).toBeDefined();
    if (!line) return;
    expect(line[0].y).toBeCloseTo(line[1].y);
    expect(
      Math.hypot(line[1].x - line[0].x, line[1].y - line[0].y, line[1].z - line[0].z),
    ).toBeGreaterThan(0.2);
  });
});

describe('coplanarAlignments', () => {
  it('marks matching tops and bottoms of two side-by-side cabinets', () => {
    const left = box([0, 0, 0], [0.6, 0.8, 0.6]);
    const right = box([0.7, 0, 0], [1.3, 0.8, 0.6]);
    const aligns = coplanarAlignments(left, right);
    expect(aligns.every((dimension) => dimension.kind === 'align' && dimension.gapMm === 0)).toBe(true);
    expect(aligns.map((dimension) => `${dimension.axis}:${dimension.line[0][dimension.axis]}`).sort()).toEqual(
      ['y:0', 'y:0.8', 'z:0', 'z:0.6'].sort(),
    );
    const top = aligns.find((dimension) => dimension.axis === 'y' && dimension.line[0].y > 0.7);
    expect(top?.line[0].x).toBeCloseTo(0.6);
    expect(top?.line[1].x).toBeCloseTo(0.7);
  });

  it('stays quiet when the matching bound is a distant diagonal', () => {
    const left = box([0, 0, 0], [0.6, 0.8, 0.6]);
    const far = box([3, 0, 3], [3.6, 0.8, 3.6]);
    expect(coplanarAlignments(left, far)).toEqual([]);
  });
});

describe('facesOnAxis', () => {
  it('requires overlap on the other two axes', () => {
    const shelf = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const above = box([0, 0.2, 0], [0.8, 0.218, 0.3]);
    const aside = box([2, 0.2, 0], [2.8, 0.218, 0.3]);
    expect(facesOnAxis(shelf, above, 'y')).toBe(true);
    expect(facesOnAxis(shelf, aside, 'y')).toBe(false);
  });
});

describe('nearestFacingGaps', () => {
  it('reads the nearest facing neighbour above and below a shelf', () => {
    const selected = box([0, 0.2, 0], [0.8, 0.218, 0.3]);
    const floor = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const top = box([0, 0.5, 0], [0.8, 0.518, 0.3]);
    const far = box([0, 1, 0], [0.8, 1.018, 0.3]);
    const gaps = nearestFacingGaps(selected, [floor, top, far]);
    expect(gaps).toHaveLength(2);
    expect(gaps[0]?.axis).toBe('y');
    expect(gaps[0]?.gapMm).toBeCloseTo(182);
    expect(gaps[0]?.movableIsHigh).toBe(true);
    expect(gaps[1]?.gapMm).toBeCloseTo(282);
    expect(gaps[1]?.movableIsHigh).toBe(false);
  });

  it('ignores a nearer piece that does not face the selection', () => {
    const selected = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const facing = box([0, 0.2, 0], [0.8, 0.218, 0.3]);
    const closerAside = box([2, 0.1, 0], [2.8, 0.118, 0.3]);
    const gaps = nearestFacingGaps(selected, [facing, closerAside]);
    expect(gaps.find((gap) => gap.axis === 'y')?.gapMm).toBeCloseTo(182);
  });

  it('falls back to the closest neighbour when none share a footprint', () => {
    const selected = box([0.5, 0.2, 0], [0.9, 0.218, 0.3]);
    const beside = box([0, 0, 0], [0.4, 0.018, 0.3]);
    const gaps = nearestFacingGaps(selected, [beside]);
    expect(gaps.find((gap) => gap.axis === 'y')?.gapMm).toBeCloseTo(182);
  });

  it('prefers a flush neighbour over a farther clearance on the same side', () => {
    const selected = box([0, 0.018, 0], [0.8, 0.036, 0.3]);
    const flush = box([0, 0, 0], [0.8, 0.018, 0.3]);
    const farther = box([0, -0.2, 0], [0.8, -0.182, 0.3]);
    const gaps = nearestFacingGaps(selected, [flush, farther]);
    const below = gaps.find((gap) => gap.axis === 'y' && gap.movableIsHigh);
    expect(below).toMatchObject({ kind: 'align', gapMm: 0 });
  });
});

describe('overallDimensions', () => {
  it('draws width, height, and depth of the box', () => {
    const carcass = box([0, 0, 0], [0.6, 0.8, 0.6]);
    const dims = overallDimensions(carcass);
    expect(dims.map((dimension) => dimension.axis)).toEqual(['x', 'y', 'z']);
    expect(dims.map((dimension) => dimension.kind)).toEqual(['overall', 'overall', 'overall']);
    expect(dims[0]?.gapMm).toBeCloseTo(600);
    expect(dims[1]?.gapMm).toBeCloseTo(800);
    expect(dims[2]?.gapMm).toBeCloseTo(600);
    expect(dims[0]?.line[0].x).toBeCloseTo(0);
    expect(dims[0]?.line[1].x).toBeCloseTo(0.6);
    expect(dims[0]?.line[0].z).toBeGreaterThan(0.6);
    expect(dims[0]?.line[0].y).toBeCloseTo(0);
    expect(dims[1]?.line[0].y).toBeCloseTo(0);
    expect(dims[1]?.line[1].y).toBeCloseTo(0.8);
    expect(dims[1]?.line[0].x).toBeCloseTo(0.6);
    expect(dims[1]?.line[0].z).toBeGreaterThan(0.6);
    expect(dims[2]?.line[0].z).toBeCloseTo(0);
    expect(dims[2]?.line[1].z).toBeCloseTo(0.6);
    expect(dims[2]?.line[0].x).toBeGreaterThan(0.6);
    expect(dims[2]?.line[0].y).toBeCloseTo(0);
  });

  it('keeps overall lines further out than a neighbouring clearance', () => {
    const carcass = box([0, 0, 0], [0.6, 0.8, 0.6]);
    const neighbour = box([0.7, 0, 0], [1.3, 0.8, 0.6]);
    const overall = overallDimensions(carcass).find((dimension) => dimension.axis === 'x');
    const gap = gapsBetweenBoxes(carcass, neighbour).find((dimension) => dimension.axis === 'x');
    expect(overall?.line[0].z).toBeGreaterThan(gap?.line[0].z ?? 0);
  });
});

describe('gapDeltaMm', () => {
  it('moves a high-side box further away to grow the gap', () => {
    expect(gapDeltaMm(true, 173, 200)).toBe(27);
  });

  it('opens a flush alignment into a clearance', () => {
    expect(gapDeltaMm(true, 0, 50)).toBe(50);
  });

  it('moves a low-side box the other way so the facing gap still grows', () => {
    expect(gapDeltaMm(false, 173, 200)).toBe(-27);
  });

  it('rejects a negative clearance', () => {
    expect(gapDeltaMm(true, 173, -10)).toBeNull();
  });
});
