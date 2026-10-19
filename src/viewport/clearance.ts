import { isLegHardwareShape, isRoundHardwareShape } from '@/domain/catalog';
import {
  cabinetContainingSelection,
  dimensionNeighborIds,
  gizmoPartIds,
  groupMatching,
  selectionUnits,
} from '@/domain/parts';
import { localDimensionForWorldAxis } from '@/domain/spatial';
import type { CustomPart, DimensionAxis, Group, Transform } from '@/domain/types';
import { convertedValue, parseLength, type DisplayUnit } from '@/domain/units';
import type { GizmoMode } from '@/store/uiStore';
import {
  coplanarAlignments,
  gapsBetweenBoxes,
  gapDeltaMm,
  nearestCoplanarAlignments,
  nearestFacingGaps,
  overallDimensions,
  type Aabb,
  type Axis,
  type GapDimension,
} from './selectionGap';

/** Boxes for a set of part ids. Live meshes in the app, a plain map in tests. */
export type BoundsLookup = (partIds: readonly string[]) => Aabb | null;

export type ClearanceEdit =
  | { kind: 'nudge'; deltaMm: { x: number; y: number; z: number } }
  | { kind: 'overall'; axis: Axis; millimetres: number };

export type OverallSizeEdit =
  | { kind: 'cabinet'; groupId: string; key: 'width' | 'height' | 'depth'; millimetres: number }
  | { kind: 'drawer'; groupId: string; key: 'width' | 'height' | 'depth'; millimetres: number }
  | { kind: 'part-size'; partId: string; key: DimensionAxis; millimetres: number }
  | { kind: 'hardware-diameter'; partId: string; millimetres: number }
  | { kind: 'rigid-group'; partIds: readonly string[]; axis: Axis; millimetres: number };

/**
 * Witnesses for the current selection. `null` means the boxes are not ready
 * and the caller should try again next frame. An empty list is a real result:
 * nothing to draw.
 */
export function clearanceWitnesses(input: {
  groups: readonly Group[];
  selectedIds: readonly string[];
  visibleIds: readonly string[];
  gizmoMode: GizmoMode;
  bounds: BoundsLookup;
}): GapDimension[] | null {
  const { groups, selectedIds, visibleIds, gizmoMode, bounds } = input;
  const units = selectionUnits(groups, selectedIds);
  if (units.length === 2) {
    const first = units[0];
    const second = units[1];
    if (!first || !second) return null;
    const boxA = bounds(first.partIds);
    const boxB = bounds(second.partIds);
    if (!boxA || !boxB) return null;
    const pair = alignmentsForMode(
      [
        ...gapsBetweenBoxes(boxA, boxB),
        ...(first.kind === 'group' && second.kind === 'group' ? coplanarAlignments(boxA, boxB) : []),
      ],
      gizmoMode,
    );
    const overall = gizmoMode === 'scale' ? overallForIds(bounds, gizmoPartIds(groups, selectedIds)) : [];
    return [...overall, ...pair];
  }
  if (units.length !== 1) return null;
  const selected = units[0];
  if (!selected) return null;
  const selectedBox = bounds(selected.partIds);
  if (!selectedBox) return null;
  const others: Aabb[] = [];
  const groupOthers: Aabb[] = [];
  for (const partIds of dimensionNeighborIds(groups, visibleIds, selected.partIds)) {
    const box = bounds(partIds);
    if (box) others.push(box);
  }
  if (selected.kind === 'group') {
    const live = new Set(visibleIds);
    for (const group of groups) {
      if (group.id === selected.id) continue;
      const ids = group.partIds.filter((id) => live.has(id));
      if (!ids.length) continue;
      const box = bounds(ids);
      if (box) groupOthers.push(box);
    }
  }
  const overallIds = gizmoMode === 'scale' ? gizmoPartIds(groups, selectedIds) : [];
  return [
    ...overallForIds(bounds, overallIds),
    ...alignmentsForMode(
      [
        ...nearestFacingGaps(selectedBox, others),
        ...(selected.kind === 'group' ? nearestCoplanarAlignments(selectedBox, groupOthers) : []),
      ],
      gizmoMode,
    ),
  ];
}

/** The document edit for a typed clearance or overall label. */
export function clearanceTypedEdit(input: {
  kind: GapDimension['kind'];
  axis: Axis;
  gapMm: number;
  movableIsHigh: boolean;
  raw: string;
  unit: DisplayUnit;
}): ClearanceEdit | null {
  if (typedMatchesDisplay(input.raw, input.gapMm, input.unit)) return null;
  const target = parseLength(input.raw, input.unit);
  if (input.kind === 'overall') {
    if (target === null || target <= 0) return null;
    return { kind: 'overall', axis: input.axis, millimetres: target };
  }
  const delta = target === null ? null : gapDeltaMm(input.movableIsHigh, input.gapMm, target);
  if (delta === null || delta === 0) return null;
  return {
    kind: 'nudge',
    deltaMm: {
      x: input.axis === 'x' ? delta : 0,
      y: input.axis === 'y' ? delta : 0,
      z: input.axis === 'z' ? delta : 0,
    },
  };
}

/**
 * What an overall W/H/D edit changes. A whole cabinet or drawer resizes
 * parametrically. One part writes its own dimension, mapped from the world
 * axis. Anything else is a rigid resize of the gizmo's parts.
 */
export function overallSizeEdit(input: {
  axis: Axis;
  millimetres: number;
  groups: readonly Group[];
  selectedIds: readonly string[];
  parts: readonly CustomPart[];
  quaternionOf: (id: string) => Transform['quaternion'];
}): OverallSizeEdit | null {
  if (!Number.isFinite(input.millimetres) || input.millimetres <= 0) return null;
  const ids = gizmoPartIds(input.groups, input.selectedIds);
  if (!ids.length) return null;
  const selected = new Set(ids);
  const cabinet = cabinetContainingSelection(input.groups, ids);
  if (
    cabinet?.cabinet &&
    cabinet.partIds.length === ids.length &&
    cabinet.partIds.every((id) => selected.has(id))
  ) {
    return {
      kind: 'cabinet',
      groupId: cabinet.id,
      key: cabinetKey(input.axis),
      millimetres: input.millimetres,
    };
  }
  const drawerGroup = groupMatching(input.groups, ids);
  if (drawerGroup?.drawer) {
    return {
      kind: 'drawer',
      groupId: drawerGroup.id,
      key: cabinetKey(input.axis),
      millimetres: input.millimetres,
    };
  }
  if (ids.length === 1) {
    const id = ids[0];
    if (!id) return null;
    const part = input.parts.find((candidate) => candidate.id === id);
    if (!part) return null;
    const key = localDimensionForWorldAxis(input.quaternionOf(id), input.axis);
    if (part.category === 'hardware') {
      if (isLegHardwareShape(part.shape)) {
        return key === 'h'
          ? { kind: 'part-size', partId: id, key, millimetres: input.millimetres }
          : { kind: 'hardware-diameter', partId: id, millimetres: input.millimetres };
      }
      if (isRoundHardwareShape(part.shape)) {
        return key === 'd'
          ? { kind: 'part-size', partId: id, key, millimetres: input.millimetres }
          : { kind: 'hardware-diameter', partId: id, millimetres: input.millimetres };
      }
    }
    return { kind: 'part-size', partId: id, key, millimetres: input.millimetres };
  }
  return { kind: 'rigid-group', partIds: ids, axis: input.axis, millimetres: input.millimetres };
}

function cabinetKey(axis: Axis): 'width' | 'height' | 'depth' {
  if (axis === 'x') return 'width';
  if (axis === 'y') return 'height';
  return 'depth';
}

function alignmentsForMode(dimensions: readonly GapDimension[], gizmoMode: GizmoMode): GapDimension[] {
  if (gizmoMode === 'translate') return [...dimensions];
  return dimensions.filter((dimension) => dimension.kind !== 'align');
}

function overallForIds(bounds: BoundsLookup, ids: readonly string[]): GapDimension[] {
  if (!ids.length) return [];
  const box = bounds(ids);
  return box ? overallDimensions(box) : [];
}

function typedMatchesDisplay(raw: string, gapMm: number, unit: DisplayUnit): boolean {
  const typed = raw.trim().replace(/,/g, '').toLowerCase();
  const shown = String(convertedValue(gapMm, unit));
  return typed === shown || typed === `${shown} ${unit}` || typed === `${shown}${unit}`;
}
