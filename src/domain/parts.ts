import type { CustomPart, Group, PartSpec } from './types';

/**
 * Every part is a library panel, so this is a direct map — but it's still the
 * one place that produces "the live parts," so the mesh builder, the assembly
 * tree, the part count, Select All and the BOM all read the same list and
 * can't drift from one another.
 */
export function computePartSpecs(customParts: readonly CustomPart[]): PartSpec[] {
  return customParts.map((p) => ({
    id: p.id,
    label: p.label,
    size: { x: p.w, y: p.h, z: p.d },
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
