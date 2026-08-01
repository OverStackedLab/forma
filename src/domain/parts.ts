import type { CustomPart, Group, PartSpec } from './types';

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
