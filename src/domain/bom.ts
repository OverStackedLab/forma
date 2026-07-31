import { findFinish, SHEET } from './catalog';
import type { Bom, BomRow, CustomPart, FinishId, Overrides, Transforms } from './types';

export type BomInput = {
  customParts: readonly CustomPart[];
  overrides: Overrides;
  transforms: Transforms;
  defaultFinishId: FinishId;
};

/**
 * The one BOM function. The table, the summary cards and the CSV all read
 * this result, so they cannot diverge. Every panel is edge-banded, since a
 * standalone shop-cut panel needs all four edges finished.
 */
export function computeBOM(input: BomInput): Bom {
  const rows: BomRow[] = input.customParts.map((p) => {
    const scale = input.transforms[p.id]?.scale ?? [1, 1, 1];
    const finishId = input.overrides[p.id]?.body ?? input.defaultFinishId;
    return {
      label: p.label,
      qty: 1,
      material: findFinish(finishId).label,
      w: Math.round(p.w * (scale[0] ?? 1)),
      h: Math.round(p.h * (scale[1] ?? 1)),
      d: Math.round(p.d * (scale[2] ?? 1)),
      edge: true,
      grain: 'Horizontal',
    };
  });

  let sheetAreaM2 = 0;
  let edgeBandM = 0;
  for (const r of rows) {
    sheetAreaM2 += ((r.w * r.h) / 1e6) * r.qty;
    edgeBandM += ((2 * (r.w + r.h)) / 1000) * r.qty;
  }
  sheetAreaM2 = Math.round(sheetAreaM2 * 100) / 100;
  edgeBandM = Math.round(edgeBandM * 10) / 10;

  const usableSheetM2 = ((SHEET.width / 1000) * SHEET.height * SHEET.yield) / 1000;
  const sheets = sheetAreaM2 > 0 ? Math.ceil(sheetAreaM2 / usableSheetM2) : 0;

  return {
    rows,
    totals: { sheetAreaM2, sheets, edgeBandM, partCount: rows.length },
  };
}
