import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import type { CustomPart } from './types';

const shelf: CustomPart = { id: 'custom-1', label: 'Shelf', w: 800, h: 300, d: 18, shape: 'box' };
const divider: CustomPart = { id: 'custom-2', label: 'Divider', w: 400, h: 700, d: 18, shape: 'box' };
const knob: CustomPart = { id: 'custom-3', label: 'Knob', w: 50, h: 45, d: 50, shape: 'cylinder' };

const baseInput = {
  overrides: {},
  transforms: {},
  defaultMaterialId: 'walnut' as const,
  defaultColorId: 'natural' as const,
};

describe('computeBOM', () => {
  it('produces no rows and zeroed totals for an empty scene', () => {
    const bom = computeBOM({ ...baseInput, customParts: [] });
    expect(bom.rows).toEqual([]);
    expect(bom.totals).toEqual({ sheetAreaM2: 0, sheets: 0, edgeBandM: 0, partCount: 0 });
  });

  it('emits one row per panel, always edge-banded', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf, divider] });
    expect(bom.rows).toHaveLength(2);
    expect(bom.rows.every((r) => r.edge)).toBe(true);
    expect(bom.rows.map((r) => r.label)).toEqual(['Shelf', 'Divider']);
  });

  it('uses the document default material and color when a panel has no override', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf] });
    expect(bom.rows[0]?.material).toBe('Walnut');
    expect(bom.rows[0]?.color).toBe('Natural');
  });

  it('uses a per-panel override material and color over the document default', () => {
    const bom = computeBOM({
      ...baseInput,
      customParts: [shelf],
      overrides: { 'custom-1': { material: 'oak', color: 'ebony' } },
    });
    expect(bom.rows[0]?.material).toBe('White Oak');
    expect(bom.rows[0]?.color).toBe('Ebony Stain');
  });

  it('excludes round hardware from edge banding and the sheet-area total', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf, knob] });
    expect(bom.rows.find((r) => r.label === 'Knob')).toMatchObject({ edge: false, grain: '—' });
    expect(bom.totals.sheetAreaM2).toBeCloseTo(0.8 * 0.3, 5);
  });

  it('scales reported dimensions by the gizmo transform', () => {
    const bom = computeBOM({
      ...baseInput,
      customParts: [shelf],
      transforms: {
        'custom-1': { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [2, 1, 1] },
      },
    });
    expect(bom.rows[0]).toMatchObject({ w: 1600, h: 300, d: 18 });
  });

  it('sums part count and sheet area across panels', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf, divider] });
    expect(bom.totals.partCount).toBe(2);
    expect(bom.totals.sheetAreaM2).toBeCloseTo(0.8 * 0.3 + 0.4 * 0.7, 5);
  });

  it('estimates at least one sheet once any panel exists', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf] });
    expect(bom.totals.sheets).toBeGreaterThanOrEqual(1);
  });
});
