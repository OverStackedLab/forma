import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import { csvHeaders, toCSV } from './csv';
import type { BomRow, CustomPart } from './types';

const row = (overrides: Partial<BomRow> = {}): BomRow => ({
  label: 'Shelf',
  qty: 1,
  material: 'Walnut',
  w: 800,
  h: 300,
  d: 18,
  edge: true,
  grain: 'Horizontal',
  ...overrides,
});

describe('csvHeaders', () => {
  it('labels the W/H/D columns with the given unit', () => {
    expect(csvHeaders('mm')).toEqual([
      'Part',
      'Qty',
      'Material',
      'W (mm)',
      'H (mm)',
      'D (mm)',
      'Edge Band',
      'Grain',
    ]);
    expect(csvHeaders('cm')[3]).toBe('W (cm)');
  });
});

describe('toCSV', () => {
  it('emits a header row followed by one line per row', () => {
    const lines = toCSV([row(), row()], 'mm').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Part,Qty,Material,W (mm),H (mm),D (mm),Edge Band,Grain');
    expect(lines[1]).toBe('Shelf,1,Walnut,800,300,18,Y,Horizontal');
  });

  it('converts W/H/D into the given display unit as plain numbers', () => {
    const lines = toCSV([row({ w: 800, h: 300, d: 18 })], 'cm').split('\r\n');
    expect(lines[0]).toBe('Part,Qty,Material,W (cm),H (cm),D (cm),Edge Band,Grain');
    expect(lines[1]).toBe('Shelf,1,Walnut,80,30,1.8,Y,Horizontal');
  });

  // A bare join corrupts the file the moment a user-editable label has a comma.
  it('quotes fields containing a comma', () => {
    const csv = toCSV([row({ label: 'Shelf, wide' })], 'mm');
    expect(csv).toContain('"Shelf, wide"');
  });

  it('doubles embedded quotes', () => {
    const csv = toCSV([row({ label: 'Panel 24" deep' })], 'mm');
    expect(csv).toContain('"Panel 24"" deep"');
  });

  it('quotes fields containing newlines', () => {
    const csv = toCSV([row({ label: 'Line one\nLine two' })], 'mm');
    expect(csv).toContain('"Line one\nLine two"');
  });

  it('renders edge banding as Y or N', () => {
    expect(toCSV([row({ edge: false })], 'mm')).toContain(',N,');
  });

  it('serializes exactly the rows the cut list displays', () => {
    const customParts: CustomPart[] = [{ id: 'custom-1', label: 'Shelf', w: 800, h: 300, d: 18 }];
    const bom = computeBOM({
      customParts,
      overrides: {},
      transforms: {},
      defaultFinishId: 'walnut',
    });
    const dataLines = toCSV(bom.rows, 'mm').split('\r\n').slice(1);
    expect(dataLines).toHaveLength(bom.rows.length);
    expect(toCSV(bom.rows, 'mm')).toContain('Shelf');
  });
});
