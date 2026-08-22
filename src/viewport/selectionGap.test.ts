import { describe, expect, it } from 'vitest';
import { axisGap, gapsBetweenBoxes, sharedOnAxis, type Aabb } from './selectionGap';

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
