import { describe, expect, it } from 'vitest';
import { PANEL_PRESETS } from './catalog';
import { halfExtentAlongNormalMm, orientedHalfExtentsMm } from './spatial';

describe('oriented part bounds', () => {
  it('keeps a shelf flat with its 18 mm thickness on world Y', () => {
    const shelf = PANEL_PRESETS.find((preset) => preset.id === 'shelf')!;
    expect(orientedHalfExtentsMm(shelf, shelf.defaultQuaternion)).toEqual({ x: 400, y: 9, z: 150 });
  });

  it('stores a side panel directly in world axes with thickness on X', () => {
    const side = PANEL_PRESETS.find((preset) => preset.id === 'flat')!;
    const extents = orientedHalfExtentsMm(side, side.defaultQuaternion);
    expect(extents.x).toBeCloseTo(9, 8);
    expect(extents.y).toBeCloseTo(400, 8);
    expect(extents.z).toBeCloseTo(300, 8);
  });

  it('computes the offset needed to place a shelf on a horizontal surface', () => {
    const shelf = PANEL_PRESETS.find((preset) => preset.id === 'shelf')!;
    expect(halfExtentAlongNormalMm(shelf, shelf.defaultQuaternion, { x: 0, y: 1, z: 0 })).toBe(9);
  });
});
