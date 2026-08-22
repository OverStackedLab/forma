import { orientedHalfExtentsMm } from './spatial';
import type { CustomPart, Group, PartSpec, Transform, Transforms } from './types';

/**
 * Every panel, front and hardware item maps directly — but this is still the
 * one place that produces "the live parts," so the mesh builder, the assembly
 * tree, the part count, Select All and the BOM all read the same list and
 * can't drift from one another.
 */
export function computePartSpecs(customParts: readonly CustomPart[]): PartSpec[] {
  return customParts.map((p) => ({
    id: p.id,
    label: p.label,
    size: { x: p.w, y: p.h, z: p.d },
    shape: p.shape,
    category: p.category,
  }));
}

/** Live part ids in tree order — used by Select All and the part count. */
export function livePartIds(customParts: readonly CustomPart[]): string[] {
  return customParts.map((p) => p.id);
}

/** The group whose membership exactly matches this selection, if any. */
export function groupMatching(groups: readonly Group[], selectedIds: readonly string[]): Group | undefined {
  if (selectedIds.length < 2) return undefined;
  const selected = new Set(selectedIds);
  return groups.find((g) => g.partIds.length === selected.size && g.partIds.every((id) => selected.has(id)));
}

/** The group a single part belongs to, if any. */
export function groupContaining(groups: readonly Group[], partId: string): Group | undefined {
  return groups.find((g) => g.partIds.includes(partId));
}

/**
 * The unique generated cabinet that fully contains this selection. A single
 * side panel, a partial multi-select, or the whole group all resolve to the
 * same carcass so shelf controls stay available without an exact group match.
 */
export function cabinetContainingSelection(
  groups: readonly Group[],
  selectedIds: readonly string[],
): Group | undefined {
  if (!selectedIds.length) return undefined;
  return groups.find(
    (group) => Boolean(group.cabinet) && selectedIds.every((id) => group.partIds.includes(id)),
  );
}

export type SelectionUnit = {
  kind: 'group' | 'part';
  id: string;
  partIds: string[];
};

/**
 * Collapses a flat part selection into the rigid items it represents while
 * preserving selection order. A fully selected group is one unit; a partial
 * group selection remains individual parts so members can still be edited.
 */
export function selectionUnits(
  groups: readonly Group[],
  selectedIds: readonly string[],
): SelectionUnit[] {
  const selected = new Set(selectedIds);
  const consumed = new Set<string>();
  const units: SelectionUnit[] = [];

  for (const partId of selectedIds) {
    if (consumed.has(partId)) continue;
    const group = groupContaining(groups, partId);
    if (group && group.partIds.every((id) => selected.has(id))) {
      units.push({ kind: 'group', id: group.id, partIds: [...group.partIds] });
      group.partIds.forEach((id) => consumed.add(id));
    } else {
      units.push({ kind: 'part', id: partId, partIds: [partId] });
      consumed.add(partId);
    }
  }

  return units;
}

const FALLBACK_TRANSFORM: Transform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

/**
 * Shared selection position in metres. X and Z are the member-origin
 * centroid; Y is the underside of the combined AABB so a group sitting on
 * the grid reads 0, not the mid-height of its panels.
 */
export function selectionPositionMetres(
  parts: readonly CustomPart[],
  transforms: Transforms,
  ids: readonly string[],
): [number, number, number] {
  if (!ids.length) return [0, 0, 0];
  const byId = new Map(parts.map((part) => [part.id, part]));
  let sumX = 0;
  let sumZ = 0;
  let minY = Infinity;
  for (const id of ids) {
    const transform = transforms[id] ?? FALLBACK_TRANSFORM;
    const part = byId.get(id);
    const extents = part
      ? orientedHalfExtentsMm(
          { w: part.w, h: part.h, d: part.d },
          transform.quaternion,
          transform.scale,
        )
      : { x: 0, y: 0, z: 0 };
    sumX += transform.position[0];
    sumZ += transform.position[2];
    minY = Math.min(minY, transform.position[1] - extents.y / 1000);
  }
  const count = ids.length;
  return [sumX / count, Number.isFinite(minY) ? minY : 0, sumZ / count];
}
