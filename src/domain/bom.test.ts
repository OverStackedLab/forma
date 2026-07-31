import { describe, expect, it } from 'vitest';
import { computeBOM } from './bom';
import type { CustomPart } from './types';

const shelf: CustomPart = { id: 'custom-1', label: 'Shelf', w: 800, h: 300, d: 18 };
const divider: CustomPart = { id: 'custom-2', label: 'Divider', w: 400, h: 700, d: 18 };

const baseInput = { overrides: {}, transforms: {}, defaultFinishId: 'walnut' as const };

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

  it('uses the document default finish when a panel has no override', () => {
    const bom = computeBOM({ ...baseInput, customParts: [shelf] });
    expect(bom.rows[0]?.material).toBe('Walnut');
  });

  it('uses a per-panel override finish over the document default', () => {
    const bom = computeBOM({
      ...baseInput,
      customParts: [shelf],
      overrides: { 'custom-1': { body: 'ebony' } },
    });
    expect(bom.rows[0]?.material).toBe('Ebony Stain');
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
