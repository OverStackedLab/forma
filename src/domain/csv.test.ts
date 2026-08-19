import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import { csvHeaders, toCSV } from './csv';
import type { BomRow, CustomPart } from './types';

const row = (overrides: Partial<BomRow> = {}): BomRow => ({
  source: 'sheet',
  label: 'Shelf',
  qty: 1,
  finish: 'Oak',
  w: 800,
  h: 18,
  d: 300,
  thickness: 18,
  sheetAreaM2: 0.24,
  edgeBand: 'Front',
  edgeBandLengthMm: 800,
  grain: 'Along width',
  ...overrides,
});

describe('csvHeaders', () => {
  it('labels dimensions and thickness with the given unit', () => {
    expect(csvHeaders('mm')).toEqual([
      'Type',
      'Part',
      'Qty',
      'Color',
      'W (mm)',
      'H (mm)',
      'D (mm)',
      'Thickness (mm)',
      'Edge Band',
      'Grain',
    ]);
    expect(csvHeaders('cm')[4]).toBe('W (cm)');
  });
});

describe('toCSV', () => {
  it('emits the manufacturing category and explicit panel metadata', () => {
    const lines = toCSV([row()], 'mm').split('\r\n');
    expect(lines[0]).toBe('Type,Part,Qty,Color,W (mm),H (mm),D (mm),Thickness (mm),Edge Band,Grain');
    expect(lines[1]).toBe('Sheet Good,Shelf,1,Oak,800,18,300,18,Front,Along width');
  });

  it('converts dimensions and thickness into the display unit', () => {
    const lines = toCSV([row()], 'cm').split('\r\n');
    expect(lines[1]).toBe('Sheet Good,Shelf,1,Oak,80,1.8,30,1.8,Front,Along width');
  });

  it('leaves thickness blank for purchased hardware', () => {
    const csv = toCSV([row({ source: 'hardware', label: 'Knob', thickness: null, edgeBand: 'None', grain: '—' })], 'mm');
    expect(csv).toContain('Hardware,Knob,1,Oak,800,18,300,,None,—');
  });

  it('quotes commas, quotes and newlines in user-editable labels', () => {
    expect(toCSV([row({ label: 'Shelf, wide' })], 'mm')).toContain('"Shelf, wide"');
    expect(toCSV([row({ label: 'Panel 24" deep' })], 'mm')).toContain('"Panel 24"" deep"');
    expect(toCSV([row({ label: 'Line one\nLine two' })], 'mm')).toContain('"Line one\nLine two"');
  });

  it('serializes exactly the grouped rows the cut list displays', () => {
    const customParts: CustomPart[] = [
      {
        id: 'custom-1', label: 'Shelf', w: 800, h: 18, d: 300, shape: 'box',
        category: 'panel', thicknessAxis: 'h', grainAxis: 'w', edgeBanding: ['d-max'],
      },
    ];
    const bom = computeBOM({
      customParts,
      overrides: {},
      transforms: {},
      defaultMaterialId: 'ash',
      defaultColorId: 'white',
      defaultHardwareFinishId: 'matte-black',
    });
    expect(toCSV(bom.rows, 'mm').split('\r\n').slice(1)).toHaveLength(bom.rows.length);
  });
});
