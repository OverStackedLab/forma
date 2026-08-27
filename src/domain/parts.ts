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

/** How much of a group is in the current selection. */
export type GroupInclusion = 'none' | 'partial' | 'all';

export function groupInclusion(
  groupPartIds: readonly string[],
  selectedIds: readonly string[],
): GroupInclusion {
  if (!groupPartIds.length) return 'none';
  const selected = new Set(selectedIds);
  let hit = 0;
  for (const id of groupPartIds) if (selected.has(id)) hit += 1;
  if (hit === 0) return 'none';
  if (hit === groupPartIds.length) return 'all';
  return 'partial';
}

/** Adds a group to the selection, or removes it when every member is already in. */
export function selectionTogglingGroup(
  selectedIds: readonly string[],
  groupPartIds: readonly string[],
): string[] {
  if (groupInclusion(groupPartIds, selectedIds) === 'all') {
    return selectedIds.filter((id) => !groupPartIds.includes(id));
  }
  return [...new Set([...selectedIds, ...groupPartIds])];
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
 * The unique generated cabinet this selection belongs to. A single side, a
 * partial multi-select, the whole group, or extra loose parts still resolve
 * to that carcass so shelf controls stay available. Two cabinets do not.
 */
export function cabinetContainingSelection(
  groups: readonly Group[],
  selectedIds: readonly string[],
): Group | undefined {
  if (!selectedIds.length) return undefined;
  const hits = groups.filter(
    (group) => Boolean(group.cabinet) && selectedIds.some((id) => group.partIds.includes(id)),
  );
  return hits.length === 1 ? hits[0] : undefined;
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

/**
 * Bodies to measure a selection against. A fully selected group treats other
 * groups as one box. A single selected piece reads every other part, including
 * members of unselected cabinets, so a panel can clear to the facing inner
 * face instead of the carcass AABB.
 */
export function dimensionNeighborIds(
  groups: readonly Group[],
  allPartIds: readonly string[],
  selectedPartIds: readonly string[],
): string[][] {
  const selected = new Set(selectedPartIds);
  const live = new Set(allPartIds);
  const consumed = new Set<string>();
  const bodies: string[][] = [];
  const units = selectionUnits(groups, selectedPartIds);
  // A whole selected cabinet should read other cabinets as one box. A single
  // selected piece (including a duplicate sitting in a carcass) must see
  // individual facing panels, not the outer AABB of the unselected group.
  const collapseUnselected = units.length === 1 && units[0]?.kind === 'group';

  for (const group of groups) {
    const members = group.partIds.filter((id) => live.has(id) && !selected.has(id));
    if (!members.length) continue;
    if (group.partIds.some((id) => selected.has(id))) continue;
    if (!collapseUnselected) continue;
    bodies.push(members);
    members.forEach((id) => consumed.add(id));
  }

  for (const id of allPartIds) {
    if (selected.has(id) || consumed.has(id)) continue;
    bodies.push([id]);
  }
  return bodies;
}

/**
 * Parts the transform gizmo should drive. Two units use the Align convention:
 * the first stays fixed and only the second moves, so clearance witnesses stay
 * live while you place the mover.
 */
export function gizmoPartIds(
  groups: readonly Group[],
  selectedIds: readonly string[],
): string[] {
  const units = selectionUnits(groups, selectedIds);
  const mover = units.length === 2 ? units[1] : undefined;
  return mover ? [...mover.partIds] : [...selectedIds];
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
