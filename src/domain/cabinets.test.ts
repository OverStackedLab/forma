import { describe, expect, it } from 'vitest';
import { CABINET_PRESETS } from './catalog';
import {
  buildCabinetLayout,
  distributedShelfPositions,
  shelfPositionRange,
  shelfPositions,
} from './cabinets';

describe('buildCabinetLayout', () => {
  it('builds a standard base carcass with two sides, top, bottom, back and shelf', () => {
    const preset = CABINET_PRESETS.find((candidate) => candidate.id === 'base-600')!;
    const parts = buildCabinetLayout(preset);
    expect(parts).toHaveLength(6);
    expect(parts.map((part) => part.label)).toEqual([
      'Base 600 Left Side',
      'Base 600 Right Side',
      'Base 600 Bottom',
      'Base 600 Top',
      'Base 600 Back',
      'Base 600 Shelf 1',
    ]);
    expect(parts[0]).toMatchObject({
      w: 18,
      h: 800,
      d: 600,
      positionMm: [-291, 400, 0],
      thicknessAxis: 'w',
      grainAxis: 'h',
      edgeBanding: ['d-max'],
    });
    expect(parts[2]).toMatchObject({ w: 564, h: 18, d: 592, positionMm: [0, 9, 4] });
    expect(parts[4]).toMatchObject({ thicknessAxis: 'd', edgeBanding: [] });
  });

  it('adds four evenly spaced shelves to the high module', () => {
    const preset = CABINET_PRESETS.find((candidate) => candidate.id === 'high-600')!;
    const parts = buildCabinetLayout(preset);
    expect(parts.filter((part) => part.label.includes('Shelf'))).toHaveLength(4);
    expect(parts).toHaveLength(9);
  });

  it('places shelves at explicit centreline heights instead of even spacing', () => {
    const preset = CABINET_PRESETS.find((candidate) => candidate.id === 'base-600')!;
    const parts = buildCabinetLayout({ ...preset, shelfPositionsMm: [500, 300] });
    const shelves = parts.filter((part) => part.label.includes('Shelf'));
    // Sorted ascending regardless of input order.
    expect(shelves.map((shelf) => shelf.positionMm[1])).toEqual([300, 500]);
    expect(parts).toHaveLength(7);
  });
});

describe('shelfPositions', () => {
  it('clamps explicit positions into the carcass interior and sorts them', () => {
    // 720-high cabinet: centrelines must stay within [27, 693].
    expect(shelfPositions({ height: 720, shelfCount: 3, shelfPositionsMm: [10_000, 0, 300] }))
      .toEqual([27, 300, 693]);
    expect(shelfPositionRange(720)).toEqual({ min: 27, max: 693 });
  });

  it('falls back to even spacing when no explicit positions exist', () => {
    expect(shelfPositions({ height: 720, shelfCount: 1 })).toEqual([360]);
  });
});

describe('distributedShelfPositions', () => {
  it('spaces shelves from the cabinet floor and drops those that overflow', () => {
    // 720 high → interior ceiling for a centreline is 693; the fourth shelf
    // (18 + 4×200 = 818) does not fit.
    expect(distributedShelfPositions({ height: 720 }, 4, 200)).toEqual([218, 418, 618]);
  });

  it('rejects a non-positive spacing', () => {
    expect(distributedShelfPositions({ height: 720 }, 3, 0)).toEqual([]);
  });
});
