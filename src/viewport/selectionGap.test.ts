import { describe, expect, it } from 'vitest';
import { axisGap, facesOnAxis, gapsBetweenBoxes, nearestFacingGaps, sharedOnAxis, type Aabb } from './selectionGap';

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
    expect(gaps[1]?.gapMm).toBeCloseTo(282);
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
});
