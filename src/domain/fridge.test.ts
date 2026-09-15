import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import { PANEL_PRESETS, isAppliancePreset } from './catalog';
import { FRIDGE_FACE_MM, FRIDGE_GAP_MM, fridgePieces } from './fridge';
import { createDefaultDocument } from '../store/documentStore';
import { normalize } from '../store/persistence';

const preset = PANEL_PRESETS.find((candidate) => candidate.id === 'fridge-600')!;

describe('fridge placeholder', () => {
  it('is a 60×184×66 cm appliance in the library, billed as hardware', () => {
    expect(preset).toMatchObject({
      w: 600, h: 1840, d: 660, shape: 'fridge', category: 'hardware',
      thicknessAxis: null, grainAxis: null,
    });
    expect(preset.edgeBanding).toEqual([]);
    expect(isAppliancePreset(preset)).toBe(true);
  });

  it('splits into a body and two doors that fill the footprint', () => {
    const pieces = fridgePieces(preset.w, preset.h, preset.d);
    expect(pieces.map((piece) => piece.role)).toEqual(['body', 'door', 'door']);
    const [body, upper, lower] = pieces;
    expect(body!.size.z).toBe(preset.d - FRIDGE_FACE_MM);
    // Doors sit on the front face; the body is set back behind them.
    for (const door of [upper!, lower!]) {
      expect(door.position.z + door.size.z / 2).toBeCloseTo(preset.d / 2, 6);
      expect(door.size.x).toBe(preset.w);
    }
    expect(upper!.position.y + upper!.size.y / 2).toBeCloseTo(preset.h / 2, 6);
    expect(lower!.position.y - lower!.size.y / 2).toBeCloseTo(-preset.h / 2, 6);
    const gap = (upper!.position.y - upper!.size.y / 2) - (lower!.position.y + lower!.size.y / 2);
    expect(gap).toBeCloseTo(FRIDGE_GAP_MM, 6);
  });

  it.each([[600, 1840, 660], [900, 2000, 700], [200, 300, 60], [20, 20, 8]])(
    'keeps every piece inside the bounds at %s×%s×%s',
    (w, h, d) => {
      for (const piece of fridgePieces(w, h, d)) {
        for (const [axis, extent] of [['x', w], ['y', h], ['z', d]] as const) {
          expect(piece.size[axis]).toBeGreaterThan(0);
          expect(Math.abs(piece.position[axis]) + piece.size[axis] / 2).toBeLessThanOrEqual(extent / 2 + 1e-9);
        }
      }
    },
  );

  it('survives a reload and stays out of the sheet-goods estimate', () => {
    const base = createDefaultDocument();
    const part = { ...preset, id: 'fridge-1', presetId: preset.id };
    const doc = normalize(JSON.parse(JSON.stringify({ ...base, customParts: [part] })));
    expect(doc.customParts[0]).toMatchObject({
      shape: 'fridge', presetId: 'fridge-600', category: 'hardware', w: 600, h: 1840, d: 660,
    });

    const bom = computeBOM({
      customParts: doc.customParts,
      overrides: doc.overrides,
      transforms: doc.transforms,
      defaultMaterialId: doc.defaultMaterialId,
      defaultColorId: doc.defaultColorId,
      defaultHardwareFinishId: doc.defaultHardwareFinishId,
    });
    expect(bom.sheetRows).toHaveLength(0);
    expect(bom.hardwareRows).toHaveLength(1);
    expect(bom.hardwareRows[0]).toMatchObject({ qty: 1, sheetAreaM2: 0, thickness: null });
  });
});
