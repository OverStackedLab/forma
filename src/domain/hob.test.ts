import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import { PANEL_PRESETS, isAppliancePreset } from './catalog';
import { HOB_GLASS_MM, HOB_ZONE_RELIEF_MM, hobPieces } from './hob';
import { createDefaultDocument } from '../store/documentStore';
import { normalize } from '../store/persistence';

const preset = PANEL_PRESETS.find((candidate) => candidate.id === 'matmassig-590')!;

describe('MATMÄSSIG induction hob', () => {
  it('matches the product: 590×49×520 mm, billed as hardware', () => {
    expect(preset).toMatchObject({
      w: 590, h: 49, d: 520, shape: 'hob', category: 'hardware',
      thicknessAxis: null, grainAxis: null,
    });
    expect(isAppliancePreset(preset)).toBe(true);
  });

  it('drops a 560×490 mm body through the worktop, under a full-size glass top', () => {
    const pieces = hobPieces(preset.w, preset.h, preset.d);
    const body = pieces.find((piece) => piece.role === 'body')!;
    const glass = pieces.find((piece) => piece.role === 'glass')!;
    expect([body.size.x, body.size.z]).toEqual([560, 490]);   // the IKEA cutout
    expect([glass.size.x, glass.size.z]).toEqual([preset.w, preset.d]);
    expect(glass.size.y).toBe(HOB_GLASS_MM);
    // Body hangs below the glass; the two meet, and the stack fills the height.
    expect(body.position.y + body.size.y / 2).toBeCloseTo(glass.position.y - glass.size.y / 2, 6);
    expect(body.position.y - body.size.y / 2).toBeCloseTo(-preset.h / 2, 6);
  });

  it('sets four zones proud of the glass at the product diameters', () => {
    const pieces = hobPieces(preset.w, preset.h, preset.d);
    const zones = pieces.filter((piece) => piece.role === 'zone');
    expect(zones).toHaveLength(4);
    expect(zones.map((zone) => Math.round(zone.size.x))).toEqual([210, 180, 180, 145]);
    const glass = pieces.find((piece) => piece.role === 'glass')!;
    for (const zone of zones) {
      expect(zone.size.x).toBe(zone.size.z);
      expect(zone.size.y).toBe(HOB_ZONE_RELIEF_MM);
      expect(zone.position.y - zone.size.y / 2).toBeCloseTo(glass.position.y + glass.size.y / 2, 6);
      expect(zone.position.y + zone.size.y / 2).toBeCloseTo(preset.h / 2, 6);
    }
    // Front zones toward +Z, rear toward −Z; larger pair on the left.
    expect(zones[0]!.position.z).toBeGreaterThan(0);
    expect(zones[1]!.position.z).toBeLessThan(0);
    expect(zones[0]!.position.x).toBeLessThan(0);
    expect(zones[3]!.position.x).toBeGreaterThan(0);
  });

  it.each([[590, 49, 520], [780, 49, 520], [300, 30, 300], [20, 8, 20]])(
    'keeps every piece inside the bounds at %s×%s×%s',
    (w, h, d) => {
      for (const piece of hobPieces(w, h, d)) {
        for (const [axis, extent] of [['x', w], ['y', h], ['z', d]] as const) {
          expect(piece.size[axis]).toBeGreaterThan(0);
          expect(Math.abs(piece.position[axis]) + piece.size[axis] / 2).toBeLessThanOrEqual(extent / 2 + 1e-9);
        }
      }
    },
  );

  it('survives a reload and stays out of the sheet-goods estimate', () => {
    const base = createDefaultDocument();
    const part = { ...preset, id: 'hob-1', presetId: preset.id };
    const doc = normalize(JSON.parse(JSON.stringify({ ...base, customParts: [part] })));
    expect(doc.customParts[0]).toMatchObject({
      shape: 'hob', presetId: 'matmassig-590', category: 'hardware', w: 590, h: 49, d: 520,
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
    expect(bom.hardwareRows[0]).toMatchObject({ qty: 1, sheetAreaM2: 0, thickness: null });
  });
});
