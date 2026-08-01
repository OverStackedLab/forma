import { describe, expect, it } from 'vitest';
import { CABINET_PRESETS } from './catalog';
import { buildCabinetLayout } from './cabinets';

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
      h: 720,
      d: 560,
      positionMm: [-291, 360, 0],
      thicknessAxis: 'w',
      grainAxis: 'h',
      edgeBanding: ['d-max'],
    });
    expect(parts[2]).toMatchObject({ w: 564, h: 18, d: 552, positionMm: [0, 9, 4] });
    expect(parts[4]).toMatchObject({ thicknessAxis: 'd', edgeBanding: [] });
  });

  it('adds four evenly spaced shelves to the tall module', () => {
    const preset = CABINET_PRESETS.find((candidate) => candidate.id === 'tall-600')!;
    const parts = buildCabinetLayout(preset);
    expect(parts.filter((part) => part.label.includes('Shelf'))).toHaveLength(4);
    expect(parts).toHaveLength(9);
  });
});
