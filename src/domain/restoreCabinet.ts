import { CABINET_CARCASS_COUNT, dividerPositions, shelfPositions } from './cabinets';
import { CABINET_DIM_LIMITS, CABINET_PRESETS } from './catalog';
import { invertQuaternion } from './rotation';
import { rotateVectorByQuaternion, type Vector3 } from './spatial';
import type { CabinetConfig, CustomPart, Group, Transform, Transforms } from './types';

const FALLBACK: Transform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

const CORNER_SIGNS: readonly (readonly [number, number, number])[] = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];

function transformOf(transforms: Transforms, id: string): Transform {
  return transforms[id] ?? FALLBACK;
}

function visualSize(part: CustomPart, transform: Transform) {
  return {
    w: Math.abs(part.w * transform.scale[0]),
    h: Math.abs(part.h * transform.scale[1]),
    d: Math.abs(part.d * transform.scale[2]),
  };
}

function localPointMm(
  worldMetres: readonly [number, number, number],
  pivotMetres: readonly [number, number, number],
  invQ: Transform['quaternion'],
): Vector3 {
  return rotateVectorByQuaternion(
    {
      x: worldMetres[0] * 1000 - pivotMetres[0] * 1000,
      y: worldMetres[1] * 1000 - pivotMetres[1] * 1000,
      z: worldMetres[2] * 1000 - pivotMetres[2] * 1000,
    },
    invQ,
  );
}

function uniqueSorted(values: readonly number[], tolerance = 2): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    const rounded = Math.round(value);
    if (!unique.length || Math.abs(rounded - unique[unique.length - 1]!) > tolerance) {
      unique.push(rounded);
    }
  }
  return unique;
}

function matchesEven(
  inferred: readonly number[],
  even: readonly number[],
): boolean {
  return (
    inferred.length === even.length &&
    inferred.every((value, index) => Math.abs(value - Math.round(even[index]!)) <= 2)
  );
}

function withinLimits(
  width: number,
  height: number,
  depth: number,
): boolean {
  return (
    width >= CABINET_DIM_LIMITS.width.min &&
    width <= CABINET_DIM_LIMITS.width.max &&
    height >= CABINET_DIM_LIMITS.height.min &&
    height <= CABINET_DIM_LIMITS.height.max &&
    depth >= CABINET_DIM_LIMITS.depth.min &&
    depth <= CABINET_DIM_LIMITS.depth.max
  );
}

const PANEL_THICKNESS = 18;
const BACK_THICKNESS = 8;

function isNearThickness(value: number, expected: number): boolean {
  return Math.abs(value - expected) <= Math.max(3, expected * 0.2);
}

function boundsOf(
  items: readonly { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }[],
) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.minX);
    minY = Math.min(minY, item.minY);
    minZ = Math.min(minZ, item.minZ);
    maxX = Math.max(maxX, item.maxX);
    maxY = Math.max(maxY, item.maxY);
    maxZ = Math.max(maxZ, item.maxZ);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * Rebuilds a parametric cabinet config from a rigid group's current pieces.
 * Used only when the user asks to restore — current-schema load still leaves
 * a missing `cabinet` as a regular group (BUG-009).
 */
export function inferCabinetConfig(
  parts: readonly CustomPart[],
  transforms: Transforms,
  partIds: readonly string[],
): CabinetConfig | null {
  if (partIds.length < CABINET_CARCASS_COUNT) return null;
  const byId = new Map(parts.map((part) => [part.id, part]));
  const members: CustomPart[] = [];
  for (const id of partIds) {
    const part = byId.get(id);
    if (!part || part.category !== 'panel' || part.shape !== 'box' || !part.thicknessAxis) {
      return null;
    }
    members.push(part);
  }

  const anchor = transformOf(transforms, partIds[0]!);
  const invQ = invertQuaternion(anchor.quaternion);

  const locals = members.map((part) => {
    const transform = transformOf(transforms, part.id);
    const size = visualSize(part, transform);
    const centre = localPointMm(transform.position, anchor.position, invQ);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const [sx, sy, sz] of CORNER_SIGNS) {
      const worldOffset = rotateVectorByQuaternion(
        { x: (size.w / 2) * sx, y: (size.h / 2) * sy, z: (size.d / 2) * sz },
        transform.quaternion,
      );
      const local = localPointMm(
        [
          transform.position[0] + worldOffset.x / 1000,
          transform.position[1] + worldOffset.y / 1000,
          transform.position[2] + worldOffset.z / 1000,
        ],
        anchor.position,
        invQ,
      );
      minX = Math.min(minX, local.x);
      minY = Math.min(minY, local.y);
      minZ = Math.min(minZ, local.z);
      maxX = Math.max(maxX, local.x);
      maxY = Math.max(maxY, local.y);
      maxZ = Math.max(maxZ, local.z);
    }
    return { part, size, x: centre.x, y: centre.y, z: centre.z, minX, minY, minZ, maxX, maxY, maxZ };
  });

  const verticals = locals
    .filter((item) =>
      item.part.thicknessAxis === 'w' &&
      (isNearThickness(item.size.w, PANEL_THICKNESS) || /Side/i.test(item.part.label)),
    )
    .sort((a, b) => a.x - b.x);
  const carcassHorizontals = locals
    .filter((item) =>
      item.part.thicknessAxis === 'h' &&
      (isNearThickness(item.size.h, PANEL_THICKNESS) || /(Bottom|Top)$/i.test(item.part.label)),
    )
    .sort((a, b) => a.y - b.y);
  const backs = locals.filter((item) =>
    item.part.thicknessAxis === 'd' &&
    (isNearThickness(item.size.d, BACK_THICKNESS) || /Back/i.test(item.part.label)),
  );
  if (verticals.length < 2 || carcassHorizontals.length < 2 || backs.length < 1) return null;

  const left = verticals[0]!;
  const right = verticals[verticals.length - 1]!;
  const bottom = carcassHorizontals[0]!;
  const top = carcassHorizontals[carcassHorizontals.length - 1]!;
  if (bottom === top) return null;

  const carcass = [left, right, bottom, top, ...backs];
  const { minX, minY, minZ, maxX, maxY, maxZ } = boundsOf(carcass);
  const width = Math.round(maxX - minX);
  const height = Math.round(maxY - minY);
  const depth = Math.round(maxZ - minZ);
  if (!withinLimits(width, height, depth)) return null;
  if (Math.abs(left.minX - minX) > 4 || Math.abs(right.maxX - maxX) > 4) return null;
  if (Math.abs(bottom.minY - minY) > 4 || Math.abs(top.maxY - maxY) > 4) return null;

  const shelfYs = uniqueSorted(
    locals
      .filter((item) => item.part.thicknessAxis === 'h' && item !== bottom && item !== top)
      .map((item) => item.y - minY),
  );
  const dividerXs = uniqueSorted(
    verticals.slice(1, -1).map((item) => item.x - minX),
  );

  const evenShelves = shelfPositions({ height, shelfCount: shelfYs.length });
  const shelfPositionsMm = matchesEven(shelfYs, evenShelves)
    ? undefined
    : shelfYs.length
      ? shelfPositions({ height, shelfCount: 0, shelfPositionsMm: shelfYs })
      : undefined;
  const dividerPositionsMm = dividerXs.length
    ? dividerPositions({ width, dividerPositionsMm: dividerXs })
    : undefined;

  const shelfCount = shelfPositionsMm?.length ?? shelfYs.length;
  const matchingPreset =
    shelfPositionsMm?.length || dividerPositionsMm?.length
      ? undefined
      : CABINET_PRESETS.find(
          (preset) =>
            preset.width === width &&
            preset.height === height &&
            preset.depth === depth &&
            preset.shelfCount === shelfCount,
        );

  return {
    presetId: matchingPreset?.id,
    width,
    height,
    depth,
    shelfCount,
    shelfPositionsMm,
    dividerPositionsMm,
  };
}

/** The unique rigid group containing this selection that still looks like a carcass. */
export function restorableCabinetGroup(
  groups: readonly Group[],
  parts: readonly CustomPart[],
  transforms: Transforms,
  selectedIds: readonly string[],
): Group | undefined {
  if (!selectedIds.length) return undefined;
  const containing = groups.filter(
    (group) => !group.cabinet && selectedIds.every((id) => group.partIds.includes(id)),
  );
  if (containing.length !== 1) return undefined;
  const group = containing[0]!;
  return inferCabinetConfig(parts, transforms, group.partIds) ? group : undefined;
}
