import { findColor, findMaterial, SHEET } from './catalog';
import type {
  Bom,
  BomRow,
  ColorId,
  CustomPart,
  DimensionAxis,
  MaterialId,
  Overrides,
  Transforms,
} from './types';

export type BomInput = {
  customParts: readonly CustomPart[];
  overrides: Overrides;
  transforms: Transforms;
  defaultMaterialId: MaterialId;
  defaultColorId: ColorId;
};

const AXES: readonly DimensionAxis[] = ['w', 'h', 'd'];

/** Old documents did not store a thickness axis, so infer it from the smallest nominal dimension. */
export function thicknessAxisOf(part: CustomPart): DimensionAxis | null {
  if (part.shape === 'cylinder') return null;
  if (part.thicknessAxis) return part.thicknessAxis;
  return AXES.reduce((smallest, axis) => (part[axis] < part[smallest] ? axis : smallest), 'w');
}

/**
 * The one BOM function. The table, the summary cards and the CSV all read
 * this result, so they cannot diverge. Every panel is edge-banded, since a
 * standalone shop-cut panel needs all four edges finished — round hardware
 * like a knob isn't cut from a sheet, so it carries neither an edge nor a
 * grain direction and is excluded from the sheet/edge-banding totals below.
 */
export function computeBOM(input: BomInput): Bom {
  const rows: BomRow[] = input.customParts.map((p) => {
    const scale = input.transforms[p.id]?.scale ?? [1, 1, 1];
    const materialId = input.overrides[p.id]?.material ?? input.defaultMaterialId;
    const colorId = input.overrides[p.id]?.color ?? input.defaultColorId;
    const isSheetGood = p.shape !== 'cylinder';
    return {
      label: p.label,
      qty: 1,
      material: findMaterial(materialId).label,
      color: findColor(colorId).label,
      w: Math.round(p.w * (scale[0] ?? 1)),
      h: Math.round(p.h * (scale[1] ?? 1)),
      d: Math.round(p.d * (scale[2] ?? 1)),
      edge: isSheetGood,
      grain: isSheetGood ? 'Horizontal' : '—',
    };
  });

  let sheetAreaM2 = 0;
  let edgeBandM = 0;
  rows.forEach((r, index) => {
    if (!r.edge) return;
    const part = input.customParts[index]!;
    const thicknessAxis = thicknessAxisOf(part);
    const faceAxes = AXES.filter((axis) => axis !== thicknessAxis);
    const faceA = r[faceAxes[0]!];
    const faceB = r[faceAxes[1]!];
    sheetAreaM2 += ((faceA * faceB) / 1e6) * r.qty;
    edgeBandM += ((2 * (faceA + faceB)) / 1000) * r.qty;
  });
  sheetAreaM2 = Math.round(sheetAreaM2 * 100) / 100;
  edgeBandM = Math.round(edgeBandM * 10) / 10;

  const usableSheetM2 = ((SHEET.width / 1000) * SHEET.height * SHEET.yield) / 1000;
  const sheets = sheetAreaM2 > 0 ? Math.ceil(sheetAreaM2 / usableSheetM2) : 0;

  return {
    rows,
    totals: { sheetAreaM2, sheets, edgeBandM, partCount: rows.length },
  };
}
