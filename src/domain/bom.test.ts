import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import type { CustomPart } from './types';

const shelf: CustomPart = {
  id: 'custom-1',
  label: 'Shelf',
  w: 800,
  h: 18,
  d: 300,
  shape: 'box',
  category: 'panel',
  thicknessAxis: 'h',
  grainAxis: 'w',
  edgeBanding: ['d-max'],
};
const divider: CustomPart = {
  id: 'custom-2',
  label: 'Divider',
  w: 18,
  h: 700,
  d: 400,
  shape: 'box',
  category: 'panel',
  thicknessAxis: 'w',
  grainAxis: 'h',
  edgeBanding: ['d-max'],
};
const knob: CustomPart = {
  id: 'custom-3',
  label: 'Knob',
  w: 32,
  h: 32,
  d: 25,
  shape: 'cylinder',
  category: 'hardware',
  thicknessAxis: null,
  grainAxis: null,
  edgeBanding: [],
};

const baseInput = {
  overrides: {},
  transforms: {},
  defaultMaterialId: 'walnut' as const,
  defaultColorId: 'natural' as const,
  defaultHardwareFinishId: 'brushed-brass' as const,
};

describe('computeBOM', () => {
  it('produces empty manufacturing sections and zeroed totals for an empty scene', () => {
    const bom = computeBOM({ ...baseInput, customParts: [] });
    expect(bom.rows).toEqual([]);
    expect(bom.sheetRows).toEqual([]);
    expect(bom.hardwareRows).toEqual([]);
    expect(bom.sheetRequirements).toEqual([]);
    expect(bom.totals).toEqual({ sheetAreaM2: 0, sheets: 0, edgeBandM: 0, partCount: 0 });
  });

  it('uses explicit grain and exposed-edge rules', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf, divider] });
    expect(bom.sheetRows[0]).toMatchObject({
      edgeBand: 'Front',
      edgeBandLengthMm: 800,
      grain: 'Along width',
    });
    expect(bom.sheetRows[1]).toMatchObject({
      edgeBand: 'Front',
      edgeBandLengthMm: 700,
      grain: 'Along height',
    });
    expect(bom.totals.edgeBandM).toBe(1.5);
  });

  it('uses the appropriate design default for panels and hardware', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf, knob] });
    expect(bom.sheetRows[0]?.finish).toBe('Walnut');
    expect(bom.hardwareRows[0]).toMatchObject({
      finish: 'Brushed Brass',
      thickness: null,
      edgeBand: 'None',
      grain: '—',
    });
  });

  it('uses a per-part finish override over the category default', () => {
    const bom = computeBOM({
      ...baseInput,
      customParts: [shelf],
      overrides: { 'custom-1': { material: 'oak', color: 'ebony' } },
    });
    expect(bom.rows[0]?.finish).toBe('Ebony Stain');
  });

  it('groups matching pieces into one quantity row', () => {
    const rightSide: CustomPart = { ...divider, id: 'custom-4', label: 'Right Side', bomLabel: 'Cabinet Side' };
    const leftSide: CustomPart = { ...divider, id: 'custom-5', label: 'Left Side', bomLabel: 'Cabinet Side' };
    const bom = computeBOM({ ...baseInput, customParts: [leftSide, rightSide] });
    expect(bom.rows).toHaveLength(1);
    expect(bom.rows[0]).toMatchObject({ label: 'Cabinet Side', qty: 2 });
    expect(bom.totals.partCount).toBe(2);
  });

  it('keeps different sheet thicknesses in separate requirements', () => {
    const back: CustomPart = {
      ...shelf,
      id: 'back',
      label: 'Back',
      w: 800,
      h: 700,
      d: 8,
      thicknessAxis: 'd',
      grainAxis: 'h',
      edgeBanding: [],
    };
    const bom = computeBOM({ ...baseInput, customParts: [shelf, back] });
    expect(
      bom.sheetRequirements.map((requirement) => requirement.thickness).sort((a, b) => a - b),
    ).toEqual([8, 18]);
    expect(bom.totals.sheets).toBe(2);
  });

  it('scales reported dimensions, area and edge length with the gizmo transform', () => {
    const bom = computeBOM({
      ...baseInput,
      customParts: [shelf],
      transforms: {
        'custom-1': { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [2, 1, 1] },
      },
    });
    expect(bom.rows[0]).toMatchObject({ w: 1600, h: 18, d: 300, edgeBandLengthMm: 1600 });
    expect(bom.totals.sheetAreaM2).toBeCloseTo(0.48, 5);
    expect(bom.totals.edgeBandM).toBeCloseTo(1.6, 5);
  });
});
