import { findFinish, finishForAppearance, SHEET } from './catalog';
import type {
  Bom,
  BomRow,
  ColorId,
  CustomPart,
  DimensionAxis,
  EdgeBandSide,
  HardwareFinishId,
  MaterialId,
  Overrides,
  SheetRequirement,
  Transforms,
} from './types';

export type BomInput = {
  customParts: readonly CustomPart[];
  overrides: Overrides;
  transforms: Transforms;
  defaultMaterialId: MaterialId;
  defaultColorId: ColorId;
  defaultHardwareFinishId: HardwareFinishId;
};

const AXES: readonly DimensionAxis[] = ['w', 'h', 'd'];
const EDGE_LABELS: Record<EdgeBandSide, string> = {
  'w-min': 'Left',
  'w-max': 'Right',
  'h-min': 'Bottom',
  'h-max': 'Top',
  'd-min': 'Back',
  'd-max': 'Front',
};
const GRAIN_LABELS: Record<DimensionAxis, string> = {
  w: 'Along width',
  h: 'Along height',
  d: 'Along depth',
};

/** Old documents did not store a thickness axis, so infer it from the smallest nominal dimension. */
export function thicknessAxisOf(part: CustomPart): DimensionAxis | null {
  if (part.category === 'hardware') return null;
  if (part.thicknessAxis) return part.thicknessAxis;
  return AXES.reduce((smallest, axis) => (part[axis] < part[smallest] ? axis : smallest), 'w');
}

function dimensionsOf(part: CustomPart, transforms: Transforms) {
  const scale = transforms[part.id]?.scale ?? [1, 1, 1];
  return {
    w: Math.round(part.w * (scale[0] ?? 1)),
    h: Math.round(part.h * (scale[1] ?? 1)),
    d: Math.round(part.d * (scale[2] ?? 1)),
  };
}

function edgeBandLengthMm(
  edges: readonly EdgeBandSide[],
  thicknessAxis: DimensionAxis,
  dimensions: Record<DimensionAxis, number>,
): number {
  return edges.reduce((total, edge) => {
    const boundaryAxis = edge[0] as DimensionAxis;
    if (boundaryAxis === thicknessAxis) return total;
    const lengthAxis = AXES.find(
      (axis) => axis !== thicknessAxis && axis !== boundaryAxis,
    );
    return total + (lengthAxis ? dimensions[lengthAxis] : 0);
  }, 0);
}

function groupRows(rows: BomRow[]): BomRow[] {
  const grouped = new Map<string, BomRow>();
  for (const row of rows) {
    const key = JSON.stringify({
      source: row.source,
      label: row.label,
      finish: row.finish,
      w: row.w,
      h: row.h,
      d: row.d,
      thickness: row.thickness,
      sheetAreaM2: row.sheetAreaM2,
      edgeBand: row.edgeBand,
      edgeBandLengthMm: row.edgeBandLengthMm,
      grain: row.grain,
    });
    const existing = grouped.get(key);
    if (existing) existing.qty += row.qty;
    else grouped.set(key, { ...row });
  }
  return [...grouped.values()];
}

/**
 * Produces one manufacturing result for the table, summaries and CSV. Sheet
 * goods and purchased hardware are explicit categories; matching pieces are
 * combined, while sheet estimates remain separate by thickness and finish.
 */
export function computeBOM(input: BomInput): Bom {
  const hardwareDefault = findFinish(input.defaultHardwareFinishId);
  const rawRows: BomRow[] = input.customParts.map((part) => {
    const override = input.overrides[part.id];
    const baseMaterial = part.category === 'hardware'
      ? hardwareDefault.materialId
      : input.defaultMaterialId;
    const baseColor = part.category === 'hardware'
      ? hardwareDefault.colorId
      : input.defaultColorId;
    const finish = finishForAppearance(
      override?.material ?? baseMaterial,
      override?.color ?? baseColor,
    ).label;
    const dimensions = dimensionsOf(part, input.transforms);
    const thicknessAxis = thicknessAxisOf(part);
    const validEdges = thicknessAxis
      ? part.edgeBanding.filter((edge) => edge[0] !== thicknessAxis)
      : [];
    return {
      source: part.category === 'hardware' ? 'hardware' : 'sheet',
      label: part.bomLabel ?? part.label,
      qty: 1,
      finish,
      ...dimensions,
      thickness: thicknessAxis ? dimensions[thicknessAxis] : null,
      sheetAreaM2: thicknessAxis
        ? AXES.filter((axis) => axis !== thicknessAxis)
            .reduce((area, axis) => area * dimensions[axis], 1) / 1e6
        : 0,
      edgeBand: validEdges.length ? validEdges.map((edge) => EDGE_LABELS[edge]).join(', ') : 'None',
      edgeBandLengthMm: thicknessAxis
        ? edgeBandLengthMm(validEdges, thicknessAxis, dimensions)
        : 0,
      grain: part.grainAxis ? GRAIN_LABELS[part.grainAxis] : '—',
    };
  });

  const rows = groupRows(rawRows);
  const sheetRows = rows.filter((row) => row.source === 'sheet');
  const hardwareRows = rows.filter((row) => row.source === 'hardware');
  const requirementMap = new Map<string, SheetRequirement>();
  let sheetAreaM2 = 0;
  let edgeBandM = 0;

  for (const row of sheetRows) {
    if (row.thickness === null) continue;
    const areaM2 = row.sheetAreaM2 * row.qty;
    sheetAreaM2 += areaM2;
    edgeBandM += row.edgeBandLengthMm * row.qty / 1000;
    const key = `${row.finish}:${row.thickness}`;
    const requirement = requirementMap.get(key) ?? {
      finish: row.finish,
      thickness: row.thickness,
      areaM2: 0,
      sheets: 0,
    };
    requirement.areaM2 += areaM2;
    requirementMap.set(key, requirement);
  }

  const usableSheetM2 = (SHEET.width * SHEET.height * SHEET.yield) / 1e6;
  const sheetRequirements = [...requirementMap.values()].map((requirement) => ({
    ...requirement,
    areaM2: Math.round(requirement.areaM2 * 100) / 100,
    sheets: Math.ceil(requirement.areaM2 / usableSheetM2),
  }));

  return {
    rows,
    sheetRows,
    hardwareRows,
    sheetRequirements,
    totals: {
      sheetAreaM2: Math.round(sheetAreaM2 * 100) / 100,
      sheets: sheetRequirements.reduce((sum, requirement) => sum + requirement.sheets, 0),
      edgeBandM: Math.round(edgeBandM * 10) / 10,
      partCount: rows.reduce((sum, row) => sum + row.qty, 0),
    },
  };
}
