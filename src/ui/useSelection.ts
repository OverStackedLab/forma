import { useMemo } from 'react';
import { computePartSpecs, groupMatching } from '@/domain/parts';
import type { PartSpec } from '@/domain/types';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { viewportApi } from '@/viewport/viewportApi';

export type SelectionInfo =
  | { kind: 'none' }
  | { kind: 'single'; spec: PartSpec; size: { w: number; h: number; d: number } }
  | {
      kind: 'multi';
      count: number;
      size: { w: number; h: number; d: number } | null;
      /** Set when the selection exactly matches a saved group's membership. */
      groupLabel?: string;
    };

/** The live part specs for the current document. */
export function usePartSpecs(): PartSpec[] {
  const customParts = useDocumentStore((s) => s.customParts);
  return useMemo(() => computePartSpecs(customParts), [customParts]);
}

export function useSelectionInfo(): SelectionInfo {
  const specs = usePartSpecs();
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);
  const transforms = useDocumentStore((s) => s.transforms);
  const groups = useDocumentStore((s) => s.groups);

  const ids = selectedPartIds.filter((id) => specs.some((s) => s.id === id));

  if (!ids.length) return { kind: 'none' };

  if (ids.length > 1) {
    return {
      kind: 'multi',
      count: ids.length,
      size: viewportApi()?.selectionSize(ids) ?? null,
      groupLabel: groupMatching(groups, ids)?.label,
    };
  }

  const spec = specs.find((s) => s.id === ids[0]);
  if (!spec) return { kind: 'none' };

  // Gizmo scale is document data, so a scaled panel reports its real size.
  const scale = transforms[spec.id]?.scale ?? [1, 1, 1];
  return {
    kind: 'single',
    spec,
    size: {
      w: Math.round(spec.size.x * (scale[0] ?? 1)),
      h: Math.round(spec.size.y * (scale[1] ?? 1)),
      d: Math.round(spec.size.z * (scale[2] ?? 1)),
    },
  };
}

/** The scope phrase used by both the Properties and Materials "Editing: …" chips. */
export function scopeLabel(selection: SelectionInfo): string {
  // Nothing selected doesn't edit an existing piece — there isn't one — it
  // just sets the finish newly inserted panels will start with.
  if (selection.kind === 'none') return 'New Panels';
  if (selection.kind === 'multi') return selection.groupLabel ?? `${selection.count} parts`;
  return selection.spec.label;
}
