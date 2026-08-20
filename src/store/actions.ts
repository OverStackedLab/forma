import {
  buildCabinetLayout,
  CABINET_CARCASS_COUNT,
  distributedDividerPositions,
  distributedShelfPositions,
  dividerPositionRange,
  dividerPositions,
  MAX_DIVIDER_COUNT,
  MAX_SHELF_COUNT,
  shelfPositionRange,
  shelfPositions,
  type CabinetLayoutPart,
} from '@/domain/cabinets';
import {
  CABINET_DIM_LIMITS,
  CABINET_PRESETS,
  CUSTOM_PANEL_LIMITS,
  findFinish,
  isHardwareFinishId,
  isLegHardwareShape,
  PANEL_PRESETS,
} from '@/domain/catalog';
import { groupMatching, livePartIds, selectionUnits } from '@/domain/parts';
import { eulerDegreesToQuaternion, invertQuaternion, multiplyQuaternions, quaternionToEulerDegrees } from '@/domain/rotation';
import {
  halfExtentAlongNormalMm,
  orientedHalfExtentsMm,
  rotateVectorByQuaternion,
  type Vector3,
} from '@/domain/spatial';
import type {
  AppearanceFinishId,
  CabinetConfig,
  CabinetPreset,
  CustomPart,
  DimensionAxis,
  EdgeBandSide,
  FormaDocument,
  Group,
  SavedVersion,
  Transform,
} from '@/domain/types';
import { downloadBlob } from '@/ui/download';
import { viewportApi, type AlignEdge } from '@/viewport/viewportApi';
import {
  createDefaultDocument,
  IDENTITY_TRANSFORM,
  snapshotDocument,
  useDocumentStore,
} from './documentStore';
import { clearHistory, commit, syncHistoryDocumentMeta } from './history';
import { migrate, SCHEMA_VERSION } from './persistence';
import { useUiStore } from './uiStore';

export type { AlignEdge };

const doc = () => useDocumentStore.getState();
const ui = () => useUiStore.getState();

let customSeq = 0;
function nextCustomId(): string {
  return `custom-${Date.now().toString(36)}-${++customSeq}`;
}

let groupSeq = 0;
function nextGroupId(): string {
  return `group-${Date.now().toString(36)}-${++groupSeq}`;
}

export function liveIds(): string[] {
  return livePartIds(doc().customParts);
}

/**
 * Clears `cabinet` when an independent size edit hits some but not all
 * members. Translate, rotate and rename do not demote — moving a carcass
 * (or one panel) must not hide shelf controls.
 */
function invalidatePartiallyEditedCabinets(groups: readonly Group[], changedIds: readonly string[]): Group[] {
  const changed = new Set(changedIds);
  return groups.map((group) => {
    if (!group.cabinet || !group.partIds.some((id) => changed.has(id))) return group;
    return group.partIds.every((id) => changed.has(id))
      ? group
      : { ...group, cabinet: undefined };
  });
}

// ─── Finish ──────────────────────────────────────────────────────────────────

/** Applies one complete finish to the selection, or to the whole-design default. */
export function applyFinish(id: AppearanceFinishId): void {
  const finish = findFinish(id);
  const selected = ui().selectedPartIds;
  commit(() => {
    if (selected.length) {
      useDocumentStore.setState((s) => {
        const overrides = { ...s.overrides };
        for (const partId of selected) {
          overrides[partId] = { material: finish.materialId, color: finish.colorId };
        }
        return { overrides };
      });
    } else {
      if (isHardwareFinishId(id)) useDocumentStore.setState({ defaultHardwareFinishId: id });
      else {
        useDocumentStore.setState({
          defaultMaterialId: finish.materialId,
          defaultColorId: finish.colorId,
        });
      }
    }
  });
}

export function resetOverrides(partIds: readonly string[]): void {
  if (!partIds.length) return;
  commit(() => {
    useDocumentStore.setState((s) => {
      const overrides = { ...s.overrides };
      for (const id of partIds) delete overrides[id];
      return { overrides };
    });
  });
  ui().showToast('Using design color');
}

// ─── Panels ──────────────────────────────────────────────────────────────────

export type DropPlacement = { point: Vector3; normal: Vector3 };

function nextInsertionX(state: FormaDocument, newHalfWidthMm: number): number {
  if (!state.customParts.length) return 0;
  let rightmostMm = -Infinity;
  for (const part of state.customParts) {
    const t = state.transforms[part.id] ?? IDENTITY_TRANSFORM;
    const extent = orientedHalfExtentsMm(part, t.quaternion, t.scale);
    rightmostMm = Math.max(rightmostMm, t.position[0] * 1000 + extent.x);
  }
  return (rightmostMm + 80 + newHalfWidthMm) / 1000;
}

export function addCustomPanel(presetId: string, placement?: DropPlacement): void {
  const preset = PANEL_PRESETS.find((p) => p.id === presetId) ?? PANEL_PRESETS[0]!;
  const s = doc();
  const id = nextCustomId();
  const halfExtents = orientedHalfExtentsMm(preset, preset.defaultQuaternion);
  const supportMm = placement
    ? halfExtentAlongNormalMm(preset, preset.defaultQuaternion, placement.normal)
    : halfExtents.y;
  const position: [number, number, number] = placement
    ? [
        placement.point.x + placement.normal.x * supportMm / 1000,
        placement.point.y + placement.normal.y * supportMm / 1000,
        placement.point.z + placement.normal.z * supportMm / 1000,
      ]
    : [nextInsertionX(s, halfExtents.x), halfExtents.y / 1000, 0];

  commit(() => {
    useDocumentStore.setState((prev) => ({
      customParts: [
        ...prev.customParts,
        {
          id,
          label: preset.label,
          w: preset.w,
          h: preset.h,
          d: preset.d,
          shape: preset.shape,
          category: preset.category,
          presetId: preset.id,
          thicknessAxis: preset.thicknessAxis,
          grainAxis: preset.grainAxis,
          edgeBanding: [...preset.edgeBanding],
        },
      ],
      transforms: {
        ...prev.transforms,
        [id]: {
          position,
          quaternion: [...preset.defaultQuaternion],
          scale: [1, 1, 1],
        },
      },
    }));
  });

  const u = ui();
  u.setSelection([id]);
  useUiStore.setState((prev) => ({
    gizmoMode: prev.gizmoMode === 'select' || prev.gizmoMode === 'pan' ? 'translate' : prev.gizmoMode,
  }));
  u.showToast(`${preset.label} added to scene`);
}

/**
 * Bottom-centre origin for a newly inserted cabinet. Floor insertions (click
 * or a ground drop) honour `preset.bottomMm` so wall units hang instead of
 * sitting on the grid; drops onto a vertical face keep the hit height.
 */
function cabinetInsertionOrigin(
  preset: CabinetPreset,
  centre: [number, number, number],
  placement?: DropPlacement,
): [number, number, number] {
  const hangMm = !placement || placement.normal.y > 0.5 ? (preset.bottomMm ?? 0) : 0;
  return [
    centre[0],
    centre[1] - preset.height / 2000 + hangMm / 1000,
    centre[2],
  ];
}

/** Adds a complete open-front cabinet as one named, selectable group. */
export function addCabinetPreset(presetId: string, placement?: DropPlacement): void {
  const preset = CABINET_PRESETS.find((candidate) => candidate.id === presetId) ?? CABINET_PRESETS[0]!;
  const state = doc();
  const layout = buildCabinetLayout(preset);
  const supportMm = placement
    ? Math.abs(placement.normal.x) * preset.width / 2 +
      Math.abs(placement.normal.y) * preset.height / 2 +
      Math.abs(placement.normal.z) * preset.depth / 2
    : 0;
  const centre: [number, number, number] = placement
    ? [
        placement.point.x + placement.normal.x * supportMm / 1000,
        placement.point.y + placement.normal.y * supportMm / 1000,
        placement.point.z + placement.normal.z * supportMm / 1000,
      ]
    : [nextInsertionX(state, preset.width / 2), preset.height / 2000, 0];
  const origin = cabinetInsertionOrigin(preset, centre, placement);
  const ids = layout.map(() => nextCustomId());
  const newParts: CustomPart[] = layout.map((item, index) => ({
    id: ids[index]!,
    label: item.label,
    w: item.w,
    h: item.h,
    d: item.d,
    shape: item.shape,
    category: item.category,
    bomLabel: item.bomLabel,
    thicknessAxis: item.thicknessAxis,
    grainAxis: item.grainAxis,
    edgeBanding: [...item.edgeBanding],
  }));
  const group: Group = {
    id: nextGroupId(),
    label: preset.label,
    partIds: ids,
    cabinet: {
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      depth: preset.depth,
      shelfCount: preset.shelfCount,
    },
  };

  commit(() => {
    useDocumentStore.setState((previous) => {
      const transforms = { ...previous.transforms };
      layout.forEach((item, index) => {
        transforms[ids[index]!] = {
          position: [
            origin[0] + item.positionMm[0] / 1000,
            origin[1] + item.positionMm[1] / 1000,
            origin[2] + item.positionMm[2] / 1000,
          ],
          quaternion: [...item.quaternion],
          scale: [1, 1, 1],
        };
      });
      return {
        customParts: [...previous.customParts, ...newParts],
        transforms,
        groups: [...previous.groups, group],
      };
    });
  });

  const stateUi = ui();
  stateUi.setSelection(ids);
  useUiStore.setState((previous) => ({
    gizmoMode:
      previous.gizmoMode === 'select' || previous.gizmoMode === 'pan'
        ? 'translate'
        : previous.gizmoMode,
  }));
  stateUi.showToast(`${preset.label} cabinet added`);
}

/** Renames a part. Blank input is ignored, keeping the previous name rather than going empty. */
export function renamePart(id: string, label: string): void {
  const trimmed = label.trim();
  if (!trimmed) return;
  const current = doc().customParts.find((p) => p.id === id);
  if (!current || current.label === trimmed) return;
  commit(() => {
    useDocumentStore.setState((s) => ({
      customParts: s.customParts.map((p) =>
        p.id === id ? { ...p, label: trimmed, bomLabel: undefined } : p,
      ),
    }));
  });
}

const DIM_AXIS_INDEX = { w: 0, h: 1, d: 2 } as const;

export function setCustomPartDim(id: string, key: 'w' | 'h' | 'd', value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  const limits = CUSTOM_PANEL_LIMITS[key];
  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  commit(() => {
    useDocumentStore.setState((s) => {
      const t = s.transforms[id];
      let transforms = s.transforms;
      const part = s.customParts.find((p) => p.id === id);
      if (t) {
        // The typed value becomes the new absolute size on this axis only —
        // other axes keep whatever the gizmo scaled them to.
        const scale = [...t.scale] as [number, number, number];
        const oldSize = part ? part[key] * Math.max(scale[DIM_AXIS_INDEX[key]], 0.001) : clamped;
        scale[DIM_AXIS_INDEX[key]] = 1;
        const localDelta = { x: 0, y: 0, z: 0 };
        const component = key === 'w' ? 'x' : key === 'h' ? 'y' : 'z';
        localDelta[component] = (clamped - oldSize) / 2000;
        const worldDelta = rotateVectorByQuaternion(localDelta, t.quaternion);
        transforms = {
          ...s.transforms,
          [id]: {
            ...t,
            position: [
              t.position[0] + worldDelta.x,
              t.position[1] + worldDelta.y,
              t.position[2] + worldDelta.z,
            ],
            scale,
          },
        };
      }
      return {
        customParts: s.customParts.map((p) => (p.id === id ? { ...p, [key]: clamped } : p)),
        transforms,
        groups: invalidatePartiallyEditedCabinets(s.groups, [id]),
      };
    });
  });
}

/** Keeps round hardware circular while exposing one Diameter control. */
export function setHardwareDiameter(id: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  const limits = CUSTOM_PANEL_LIMITS.w;
  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  commit(() => {
    useDocumentStore.setState((state) => {
      const part = state.customParts.find((candidate) => candidate.id === id);
      const transform = state.transforms[id];
      const standing = isLegHardwareShape(part?.shape);
      return {
        customParts: state.customParts.map((candidate) => {
          if (candidate.id !== id) return candidate;
          return standing
            ? { ...candidate, w: clamped, d: clamped }
            : { ...candidate, w: clamped, h: clamped };
        }),
        transforms: transform
          ? {
              ...state.transforms,
              [id]: {
                ...transform,
                scale: standing
                  ? [1, transform.scale[1], 1]
                  : [1, 1, transform.scale[2]],
              },
            }
          : state.transforms,
      };
    });
  });
}

export function setPartGrainAxis(id: string, axis: DimensionAxis): void {
  const part = doc().customParts.find((candidate) => candidate.id === id);
  if (!part || part.category === 'hardware' || part.thicknessAxis === axis) return;
  commit(() => {
    useDocumentStore.setState((state) => ({
      customParts: state.customParts.map((candidate) =>
        candidate.id === id ? { ...candidate, grainAxis: axis } : candidate,
      ),
    }));
  });
}

export function togglePartEdgeBand(id: string, edge: EdgeBandSide): void {
  const part = doc().customParts.find((candidate) => candidate.id === id);
  if (!part || part.category === 'hardware' || part.thicknessAxis === edge[0]) return;
  commit(() => {
    useDocumentStore.setState((state) => ({
      customParts: state.customParts.map((candidate) => {
        if (candidate.id !== id) return candidate;
        const edgeBanding = candidate.edgeBanding.includes(edge)
          ? candidate.edgeBanding.filter((candidateEdge) => candidateEdge !== edge)
          : [...candidate.edgeBanding, edge];
        return { ...candidate, edgeBanding };
      }),
    }));
  });
}

export function duplicateSelected(): void {
  const s = doc();
  const selectedIds = ui().selectedPartIds;
  const sourceGroup = groupMatching(s.groups, selectedIds);
  const sources = selectedIds
    .map((id) => s.customParts.find((p) => p.id === id))
    .filter((p): p is CustomPart => Boolean(p));

  if (!sources.length) return;

  const clones: CustomPart[] = [];
  const cloneIdBySource = new Map<string, string>();
  const transforms = { ...s.transforms };
  for (const src of sources) {
    const id = nextCustomId();
    cloneIdBySource.set(src.id, id);
    clones.push({
      id,
      label: src.label,
      w: src.w,
      h: src.h,
      d: src.d,
      shape: src.shape,
      category: src.category,
      presetId: src.presetId,
      bomLabel: src.bomLabel,
      thicknessAxis: src.thicknessAxis,
      grainAxis: src.grainAxis,
      edgeBanding: [...src.edgeBanding],
    });
    const t = s.transforms[src.id];
    // Clones are offset 80 mm in X and Z, inheriting orientation and scale.
    transforms[id] = t
      ? {
          position: [(t.position[0] ?? 0) + 0.08, t.position[1] ?? 0, (t.position[2] ?? 0) + 0.08],
          quaternion: [...t.quaternion],
          scale: [...t.scale],
        }
      : { position: [0.08, src.h / 2000, 0.08], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
  }

  // Group member order is structural for generated cabinets, so rebuild the
  // membership from the source group's order rather than selection order.
  const clonedGroup: Group | undefined = sourceGroup
    ? {
        id: nextGroupId(),
        label: sourceGroup.label,
        partIds: sourceGroup.partIds.map((id) => cloneIdBySource.get(id)!),
        cabinet: sourceGroup.cabinet
          ? {
              ...sourceGroup.cabinet,
              shelfPositionsMm: sourceGroup.cabinet.shelfPositionsMm
                ? [...sourceGroup.cabinet.shelfPositionsMm]
                : undefined,
              dividerPositionsMm: sourceGroup.cabinet.dividerPositionsMm
                ? [...sourceGroup.cabinet.dividerPositionsMm]
                : undefined,
            }
          : undefined,
      }
    : undefined;

  commit(() => {
    useDocumentStore.setState((prev) => {
      const overrides = { ...prev.overrides };
      sources.forEach((src, i) => {
        const ov = prev.overrides[src.id];
        if (ov) overrides[clones[i]!.id] = { ...ov };
      });
      return {
        customParts: [...prev.customParts, ...clones],
        overrides,
        transforms,
        groups: clonedGroup ? [...prev.groups, clonedGroup] : prev.groups,
      };
    });
  });

  ui().setSelection(clones.map((c) => c.id));
  ui().showToast(
    clonedGroup
      ? `${clonedGroup.label} group duplicated`
      : clones.length > 1
        ? `${clones.length} parts duplicated`
        : 'Part duplicated',
  );
}

// ─── Deletion and visibility ─────────────────────────────────────────────────

/**
 * If every deleted member is a generated shelf or interior panel, returns a
 * config that drops those members. Deleting a carcass piece (side / top /
 * bottom / back) returns null so the caller demotes — a rebuild would remap
 * surviving ids onto the wrong generated roles.
 */
function configAfterInteriorDelete(group: Group, deletedIds: Set<string>): CabinetConfig | null {
  const cabinet = group.cabinet;
  if (!cabinet) return null;
  const layout = buildCabinetLayout(cabinetPreset(group, cabinet));
  if (layout.length !== group.partIds.length) return null;

  const panelCount = dividerPositions(cabinet).length;
  const shelfPartCount = layout.length - CABINET_CARCASS_COUNT - panelCount;
  if (shelfPartCount < 0) return null;
  const shelfYs = shelfPositions(cabinet);
  const bayCount = shelfYs.length === 0 ? 1 : shelfPartCount / shelfYs.length;
  if (shelfYs.length > 0 && (bayCount < 1 || !Number.isInteger(bayCount))) return null;

  const removedShelfHeights = new Set<number>();
  const removedPanelIndices = new Set<number>();
  for (const [index, id] of group.partIds.entries()) {
    if (!deletedIds.has(id)) continue;
    if (index < CABINET_CARCASS_COUNT) return null;
    if (index < CABINET_CARCASS_COUNT + shelfPartCount) {
      removedShelfHeights.add(Math.floor((index - CABINET_CARCASS_COUNT) / bayCount));
    } else {
      removedPanelIndices.add(index - CABINET_CARCASS_COUNT - shelfPartCount);
    }
  }
  if (!removedShelfHeights.size && !removedPanelIndices.size) return cabinet;

  const nextShelves = shelfYs.filter((_, index) => !removedShelfHeights.has(index));
  const nextPanels = dividerPositions(cabinet).filter((_, index) => !removedPanelIndices.has(index));
  return {
    ...cabinet,
    shelfCount: removedShelfHeights.size ? nextShelves.length : cabinet.shelfCount,
    shelfPositionsMm: removedShelfHeights.size
      ? nextShelves.length
        ? nextShelves
        : undefined
      : cabinet.shelfPositionsMm,
    dividerPositionsMm: removedPanelIndices.size
      ? nextPanels.length
        ? nextPanels
        : undefined
      : cabinet.dividerPositionsMm,
  };
}

export function deleteParts(ids: readonly string[]): void {
  if (!ids.length) return;

  const deleted = new Set(ids);
  const state = doc();
  const hit = state.groups.filter(
    (group) => group.cabinet && group.partIds.some((id) => deleted.has(id)),
  );
  if (hit.length === 1) {
    const group = hit[0];
    if (group?.cabinet && ids.every((id) => group.partIds.includes(id))) {
      const nextConfig = configAfterInteriorDelete(group, deleted);
      if (nextConfig) {
        const placement = cabinetPlacement(group, group.cabinet);
        commitCabinetResize(group, nextConfig, placement);
        ui().showToast(ids.length > 1 ? `${ids.length} parts deleted` : 'Part deleted');
        return;
      }
    }
  }

  commit(() => {
    useDocumentStore.setState((prev) => {
      const overrides = { ...prev.overrides };
      const transforms = { ...prev.transforms };
      for (const id of ids) {
        delete overrides[id];
        delete transforms[id];
      }
      // A group with one or zero surviving members isn't a group anymore.
      const groups = prev.groups
        .map((g) => {
          const partIds = g.partIds.filter((id) => !ids.includes(id));
          return {
            ...g,
            partIds,
            // Once a carcass member is deliberately removed it becomes a
            // regular editable group; parametric rebuilding would otherwise
            // reassign the surviving ids to the wrong generated roles.
            cabinet: partIds.length === g.partIds.length ? g.cabinet : undefined,
          };
        })
        .filter((g) => g.partIds.length > 1);
      return {
        customParts: prev.customParts.filter((p) => !ids.includes(p.id)),
        hiddenIds: prev.hiddenIds.filter((id) => !ids.includes(id)),
        overrides,
        transforms,
        groups,
      };
    });
  });

  useUiStore.setState((prev) => ({
    selectedPartIds: prev.selectedPartIds.filter((id) => !ids.includes(id)),
  }));
  ui().showToast(ids.length > 1 ? `${ids.length} parts deleted` : 'Part deleted');
}

// ─── Groups ──────────────────────────────────────────────────────────────────

/** Groups the current selection into one persisted, named multi-selection. */
export function groupSelected(): void {
  const selected = ui().selectedPartIds;
  if (selected.length < 2) return;
  const alreadyGrouped = new Set(doc().groups.flatMap((group) => group.partIds));
  if (selected.some((id) => alreadyGrouped.has(id))) {
    ui().showToast('Ungroup existing parts before creating a new group');
    return;
  }
  const label = `Group ${doc().groups.length + 1}`;
  const group: Group = { id: nextGroupId(), label, partIds: [...selected] };
  commit(() => {
    useDocumentStore.setState((prev) => ({ groups: [...prev.groups, group] }));
  });
  ui().showToast(`Grouped ${selected.length} parts`);
}

/** Dissolves the group the current selection matches. Members are untouched. */
export function ungroupSelected(): void {
  const match = groupMatching(doc().groups, ui().selectedPartIds);
  if (!match) return;
  commit(() => {
    useDocumentStore.setState((prev) => ({ groups: prev.groups.filter((g) => g.id !== match.id) }));
  });
  ui().showToast('Ungrouped');
}

/** Renames a group. Blank input is ignored, keeping the previous name rather than going empty. */
export function renameGroup(groupId: string, label: string): void {
  const trimmed = label.trim();
  if (!trimmed) return;
  const current = doc().groups.find((g) => g.id === groupId);
  if (!current || current.label === trimmed) return;
  const cabinetLayout = current.cabinet
    ? buildCabinetLayout(cabinetPreset({ ...current, label: trimmed }, current.cabinet))
    : null;
  const memberIndex = new Map(current.partIds.map((id, index) => [id, index]));
  commit(() => {
    useDocumentStore.setState((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, label: trimmed } : g)),
      customParts: cabinetLayout
        ? s.customParts.map((part) => {
            const index = memberIndex.get(part.id);
            const generated = index === undefined ? undefined : cabinetLayout[index];
            return generated
              ? { ...part, label: generated.label, bomLabel: generated.bomLabel }
              : part;
          })
        : s.customParts,
    }));
  });
}

/** Selects every member of a group at once — clicking the group row in the tree. */
export function selectGroup(groupId: string): void {
  const group = doc().groups.find((g) => g.id === groupId);
  if (group) ui().setSelection(group.partIds);
}

/** Hides the whole group if any member is visible; otherwise shows every member. */
export function toggleGroupVisibility(groupId: string): void {
  const s = doc();
  const group = s.groups.find((g) => g.id === groupId);
  if (!group) return;
  const anyVisible = group.partIds.some((id) => !s.hiddenIds.includes(id));
  commit(() => {
    useDocumentStore.setState((prev) => {
      const hidden = new Set(prev.hiddenIds);
      for (const id of group.partIds) {
        if (anyVisible) hidden.add(id);
        else hidden.delete(id);
      }
      return { hiddenIds: [...hidden] };
    });
  });
}

export function togglePartVisibility(id: string): void {
  commit(() => {
    useDocumentStore.setState((s) => ({
      hiddenIds: s.hiddenIds.includes(id)
        ? s.hiddenIds.filter((x) => x !== id)
        : [...s.hiddenIds, id],
    }));
  });
}

// ─── Transforms ──────────────────────────────────────────────────────────────

/**
 * Called once when a gizmo drag ends, not per frame — so a drag is one undo
 * entry and the store isn't churned at 60 fps.
 */
export function commitTransforms(next: Record<string, Transform>): void {
  if (!Object.keys(next).length) return;
  const sanitized = Object.fromEntries(
    Object.entries(next).map(([id, transform]) => {
      const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
      const position = transform.position.map((value) =>
        Math.min(10, Math.max(-10, finite(value, 0))),
      ) as Transform['position'];
      const rawQuaternion = transform.quaternion.map((value) => finite(value, 0)) as Transform['quaternion'];
      const length = Math.hypot(...rawQuaternion);
      const quaternion: Transform['quaternion'] =
        length > 1e-8
          ? rawQuaternion.map((value) => value / length) as Transform['quaternion']
          : [0, 0, 0, 1];
      const scale = transform.scale.map((value) =>
        Math.min(100, Math.max(0.001, finite(value, 1))),
      ) as Transform['scale'];
      return [id, { position, quaternion, scale } satisfies Transform];
    }),
  );
  commit(() => {
    useDocumentStore.setState((s) => ({
      transforms: { ...s.transforms, ...sanitized },
    }));
  });
}

function cabinetPreset(group: Group, config: CabinetConfig) {
  return {
    id: config.presetId ?? CABINET_PRESETS[0]!.id,
    label: group.label,
    width: config.width,
    height: config.height,
    depth: config.depth,
    shelfCount: config.shelfCount,
    shelfPositionsMm: config.shelfPositionsMm,
    dividerPositionsMm: config.dividerPositionsMm,
    icon: 'cabinet',
  } as const;
}

/** Finds the cabinet's bottom-centre origin and shared assembly orientation. */
function cabinetPlacement(group: Group, config: CabinetConfig): {
  origin: [number, number, number];
  quaternion: Transform['quaternion'];
} {
  const layout = buildCabinetLayout(cabinetPreset(group, config));
  const anchor = doc().transforms[group.partIds[0]!] ?? IDENTITY_TRANSFORM;
  const local = layout[0]?.positionMm ?? [0, 0, 0];
  const offset = rotateVectorByQuaternion(
    {
      x: local[0] * anchor.scale[0] / 1000,
      y: local[1] * anchor.scale[1] / 1000,
      z: local[2] * anchor.scale[2] / 1000,
    },
    anchor.quaternion,
  );
  return {
    origin: [
      anchor.position[0] - offset.x,
      anchor.position[1] - offset.y,
      anchor.position[2] - offset.z,
    ],
    quaternion: [...anchor.quaternion],
  };
}

/** Keeps the gizmo's shared member-centroid fixed while a cabinet is rebuilt. */
function cabinetPivotPlacement(group: Group, config: CabinetConfig): {
  origin: [number, number, number];
  quaternion: Transform['quaternion'];
} {
  const transforms = group.partIds.map((id) => doc().transforms[id] ?? IDENTITY_TRANSFORM);
  const pivot = [0, 1, 2].map(
    (index) => transforms.reduce((sum, transform) => sum + transform.position[index]!, 0) /
      transforms.length,
  ) as [number, number, number];
  const quaternion = [...transforms[0]!.quaternion] as Transform['quaternion'];
  const layout = buildCabinetLayout(cabinetPreset(group, config));
  const localPivot = [0, 1, 2].map(
    (index) => layout.reduce((sum, item) => sum + item.positionMm[index]!, 0) /
      layout.length / 1000,
  );
  const offset = rotateVectorByQuaternion(
    { x: localPivot[0]!, y: localPivot[1]!, z: localPivot[2]! },
    quaternion,
  );
  return {
    origin: [pivot[0] - offset.x, pivot[1] - offset.y, pivot[2] - offset.z],
    quaternion,
  };
}

function cabinetResizeMetadata(group: Group, requested: CabinetConfig): {
  config: CabinetConfig;
  label: string;
} {
  const config = { ...requested };
  const currentPreset = CABINET_PRESETS.find((preset) => preset.id === group.cabinet?.presetId);
  // Custom shelf or panel positions mean the cabinet is no longer any catalog preset.
  const matchingPreset =
    config.shelfPositionsMm?.length || config.dividerPositionsMm?.length
      ? undefined
      : CABINET_PRESETS.find(
          (preset) =>
            preset.width === config.width &&
            preset.height === config.height &&
            preset.depth === config.depth &&
            preset.shelfCount === config.shelfCount,
        );
  config.presetId = matchingPreset?.id;
  const generatedLabel =
    currentPreset?.label === group.label || /^(Base|Wall|Tall|High) \d+×\d+×\d+$/.test(group.label);
  const family = currentPreset?.label.split(' ')[0] ?? group.label.split(' ')[0] ?? 'Cabinet';
  const label = generatedLabel
    ? matchingPreset?.label ??
      `${family} ${config.width}×${config.height}×${config.depth}`
    : group.label;
  return { config, label };
}

/**
 * Rebuilds a cabinet from its parametric config. The generated layout keeps a
 * stable order (carcass first, then shelves, then vertical panels), so existing
 * member ids are reused by index; a longer layout mints ids for added members
 * and a shorter one deletes the surplus.
 */
function commitCabinetResize(
  group: Group,
  requested: CabinetConfig,
  placement: { origin: [number, number, number]; quaternion: Transform['quaternion'] },
): void {
  const { config, label } = cabinetResizeMetadata(group, requested);
  const nextGroup = { ...group, label };
  const layout = buildCabinetLayout(cabinetPreset(nextGroup, config));
  const nextIds = layout.map((_, index) => group.partIds[index] ?? nextCustomId());
  const removedIds = group.partIds.slice(layout.length);
  const indexById = new Map(nextIds.map((id, index) => [id, index]));

  const layoutTransform = (item: CabinetLayoutPart): Transform => {
    const offset = rotateVectorByQuaternion(
      {
        x: item.positionMm[0] / 1000,
        y: item.positionMm[1] / 1000,
        z: item.positionMm[2] / 1000,
      },
      placement.quaternion,
    );
    return {
      position: [
        placement.origin[0] + offset.x,
        placement.origin[1] + offset.y,
        placement.origin[2] + offset.z,
      ],
      quaternion: [...placement.quaternion],
      scale: [1, 1, 1],
    };
  };

  commit(() => {
    useDocumentStore.setState((previous) => {
      const transforms = { ...previous.transforms };
      const overrides = { ...previous.overrides };
      for (const [index, id] of nextIds.entries()) transforms[id] = layoutTransform(layout[index]!);
      for (const id of removedIds) {
        delete transforms[id];
        delete overrides[id];
      }

      const existing = new Set(group.partIds);
      const addedParts: CustomPart[] = nextIds
        .map((id, index) => ({ id, item: layout[index]! }))
        .filter(({ id }) => !existing.has(id))
        .map(({ id, item }) => ({
          id,
          label: item.label,
          w: item.w,
          h: item.h,
          d: item.d,
          shape: item.shape,
          category: item.category,
          bomLabel: item.bomLabel,
          thicknessAxis: item.thicknessAxis,
          grainAxis: item.grainAxis,
          edgeBanding: [...item.edgeBanding],
        }));

      return {
        customParts: [
          ...previous.customParts
            .filter((part) => !removedIds.includes(part.id))
            .map((part) => {
              const index = indexById.get(part.id);
              const item = index === undefined ? undefined : layout[index];
              if (!item) return part;
              return {
                ...part,
                label: item.label,
                bomLabel: item.bomLabel,
                w: item.w,
                h: item.h,
                d: item.d,
                category: item.category,
                thicknessAxis: item.thicknessAxis,
              };
            }),
          ...addedParts,
        ],
        hiddenIds: previous.hiddenIds.filter((id) => !removedIds.includes(id)),
        transforms,
        overrides,
        groups: previous.groups.map((candidate) =>
          candidate.id === group.id
            ? { ...candidate, label, partIds: nextIds, cabinet: config }
            : candidate,
        ),
      };
    });
  });

  // Keep the whole cabinet selected through membership changes, so the
  // parametric controls stay on screen and stale ids never linger.
  const selected = new Set(ui().selectedPartIds);
  if (group.partIds.some((id) => selected.has(id))) ui().setSelection(nextIds);
}

/** Rebuilds a generated cabinet while keeping its bottom-centre placement. */
export function setCabinetDim(
  groupId: string,
  key: 'width' | 'height' | 'depth',
  value: number,
): void {
  if (!Number.isFinite(value)) return;
  const state = doc();
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const limits = CABINET_DIM_LIMITS[key];
  const nextConfig: CabinetConfig = {
    ...group.cabinet,
    [key]: Math.min(limits.max, Math.max(limits.min, value)),
  };
  const placement = cabinetPlacement(group, group.cabinet);
  commitCabinetResize(group, nextConfig, placement);
}

/**
 * Replaces a cabinet's shelves with explicit centreline heights (mm from the
 * cabinet bottom). Positions are clamped into the interior, sorted, and
 * capped at MAX_SHELF_COUNT; the carcass is rebuilt in place.
 */
export function setCabinetShelfPositions(groupId: string, positionsMm: readonly number[]): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const sorted = shelfPositions({
    height: group.cabinet.height,
    shelfCount: positionsMm.length,
    shelfPositionsMm: positionsMm.filter((y) => Number.isFinite(y)),
  });
  const nextConfig: CabinetConfig = {
    ...group.cabinet,
    shelfCount: sorted.length,
    shelfPositionsMm: sorted,
  };
  const placement = cabinetPlacement(group, group.cabinet);
  commitCabinetResize(group, nextConfig, placement);
}

/** Adds one shelf at the given centreline height, keeping the existing ones. */
export function addCabinetShelf(groupId: string, positionMm: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet || !Number.isFinite(positionMm)) return;
  const current = shelfPositions(group.cabinet);
  if (current.length >= MAX_SHELF_COUNT) {
    ui().showToast(`A cabinet holds at most ${MAX_SHELF_COUNT} shelves`);
    return;
  }
  setCabinetShelfPositions(groupId, [...current, positionMm]);
  const range = shelfPositionRange(group.cabinet.height);
  const clamped = Math.min(range.max, Math.max(range.min, Math.round(positionMm)));
  ui().showToast(
    clamped === Math.round(positionMm)
      ? `Shelf added at ${clamped} mm`
      : `Shelf clamped into the cabinet at ${clamped} mm`,
  );
}

/** Removes the shelf at the given index (bottom-up) of the effective shelf list. */
export function removeCabinetShelf(groupId: string, index: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const current = shelfPositions(group.cabinet);
  if (index < 0 || index >= current.length) return;
  setCabinetShelfPositions(groupId, current.filter((_, i) => i !== index));
  ui().showToast('Shelf removed');
}

/**
 * Replaces all shelves with `count` shelves spaced `spacingMm` apart (centre
 * to centre, starting one spacing above the cabinet floor). Shelves that
 * would not fit the interior are dropped.
 */
export function distributeCabinetShelves(groupId: string, count: number, spacingMm: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const positions = distributedShelfPositions(group.cabinet, count, spacingMm);
  if (!positions.length) {
    ui().showToast('No shelf fits that spacing');
    return;
  }
  setCabinetShelfPositions(groupId, positions);
  ui().showToast(
    positions.length < count
      ? `Only ${positions.length} of ${count} shelves fit`
      : `${positions.length} ${positions.length === 1 ? 'shelf' : 'shelves'} every ${Math.round(spacingMm)} mm`,
  );
}

/**
 * Replaces a cabinet's vertical panels with explicit centreline offsets (mm
 * from the cabinet left). Positions are clamped into the interior, sorted,
 * and capped at MAX_DIVIDER_COUNT; the carcass is rebuilt in place.
 */
export function setCabinetDividerPositions(groupId: string, positionsMm: readonly number[]): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const sorted = dividerPositions({
    width: group.cabinet.width,
    dividerPositionsMm: positionsMm.filter((x) => Number.isFinite(x)),
  });
  const nextConfig: CabinetConfig = {
    ...group.cabinet,
    dividerPositionsMm: sorted.length ? sorted : undefined,
  };
  const placement = cabinetPlacement(group, group.cabinet);
  commitCabinetResize(group, nextConfig, placement);
}

/** Adds one vertical panel at the given centreline, keeping the existing ones. */
export function addCabinetDivider(groupId: string, positionMm: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet || !Number.isFinite(positionMm)) return;
  const current = dividerPositions(group.cabinet);
  if (current.length >= MAX_DIVIDER_COUNT) {
    ui().showToast(`A cabinet holds at most ${MAX_DIVIDER_COUNT} panels`);
    return;
  }
  setCabinetDividerPositions(groupId, [...current, positionMm]);
  const range = dividerPositionRange(group.cabinet.width);
  const clamped = Math.min(range.max, Math.max(range.min, Math.round(positionMm)));
  ui().showToast(
    clamped === Math.round(positionMm)
      ? `Panel added at ${clamped} mm`
      : `Panel clamped into the cabinet at ${clamped} mm`,
  );
}

/** Removes the vertical panel at the given index (left-to-right). */
export function removeCabinetDivider(groupId: string, index: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const current = dividerPositions(group.cabinet);
  if (index < 0 || index >= current.length) return;
  setCabinetDividerPositions(groupId, current.filter((_, i) => i !== index));
  ui().showToast('Panel removed');
}

/**
 * Replaces all vertical panels with `count` panels spaced `spacingMm` apart
 * (centre to centre, starting one spacing in from the left inner face).
 * Panels that would not fit the interior are dropped.
 */
export function distributeCabinetDividers(groupId: string, count: number, spacingMm: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet) return;
  const positions = distributedDividerPositions(group.cabinet, count, spacingMm);
  if (!positions.length) {
    ui().showToast('No panel fits that spacing');
    return;
  }
  setCabinetDividerPositions(groupId, positions);
  ui().showToast(
    positions.length < count
      ? `Only ${positions.length} of ${count} panels fit`
      : `${positions.length} ${positions.length === 1 ? 'panel' : 'panels'} every ${Math.round(spacingMm)} mm`,
  );
}

/**
 * Converts a complete cabinet's shared-pivot scale gesture into one parametric
 * rebuild. Returns true when the gesture was handled and raw mesh transforms
 * must not be committed.
 */
export function resizeCabinetFromGizmo(
  ids: readonly string[],
  scale: Transform['scale'],
): boolean {
  const group = groupMatching(doc().groups, ids);
  if (!group?.cabinet || scale.some((value) => !Number.isFinite(value) || value <= 0)) return false;

  const dimensions = ['width', 'height', 'depth'] as const;
  const nextConfig = { ...group.cabinet };
  dimensions.forEach((key, index) => {
    const limits = CABINET_DIM_LIMITS[key];
    nextConfig[key] = Math.min(
      limits.max,
      Math.max(limits.min, Math.round(group.cabinet![key] * scale[index]!)),
    );
  });
  const placement = cabinetPivotPlacement(group, nextConfig);
  commitCabinetResize(group, nextConfig, placement);
  ui().showToast('Cabinet dimensions updated');
  return true;
}

/** Placement is kept; only orientation and scale reset. */
export function resetTransforms(ids: readonly string[]): void {
  if (!ids.length) return;
  const cabinetGroup = groupMatching(doc().groups, ids);
  if (cabinetGroup?.cabinet) {
    const placement = cabinetPlacement(cabinetGroup, cabinetGroup.cabinet);
    const layout = buildCabinetLayout(cabinetPreset(cabinetGroup, cabinetGroup.cabinet));
    commit(() => {
      useDocumentStore.setState((previous) => {
        const transforms = { ...previous.transforms };
        cabinetGroup.partIds.forEach((id, index) => {
          const item = layout[index];
          if (!item) return;
          transforms[id] = {
            position: [
              placement.origin[0] + item.positionMm[0] / 1000,
              placement.origin[1] + item.positionMm[1] / 1000,
              placement.origin[2] + item.positionMm[2] / 1000,
            ],
            quaternion: [0, 0, 0, 1],
            scale: [1, 1, 1],
          };
        });
        return { transforms };
      });
    });
    ui().showToast('Cabinet transform reset');
    return;
  }
  commit(() => {
    useDocumentStore.setState((prev) => {
      const transforms = { ...prev.transforms };
      for (const id of ids) {
        const t = transforms[id];
        if (t) transforms[id] = { ...t, quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
      }
      return { transforms };
    });
  });
  ui().showToast('Transform reset');
}

export function transformOf(id: string): Transform {
  return doc().transforms[id] ?? IDENTITY_TRANSFORM;
}

const POSITION_AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

/** Sets an exact part-centre position from a millimetre UI value. */
export function setPositionAxis(id: string, axis: 'x' | 'y' | 'z', millimetres: number): void {
  if (!Number.isFinite(millimetres)) return;
  const current = transformOf(id);
  const position = [...current.position] as [number, number, number];
  position[POSITION_AXIS_INDEX[axis]] = Math.min(10, Math.max(-10, millimetres / 1000));
  commit(() => {
    useDocumentStore.setState((s) => ({
      transforms: { ...s.transforms, [id]: { ...current, position } },
    }));
  });
}

/** Sets the multi-select pivot position by translating every selected part equally. */
export function setSelectionPositionAxis(
  ids: readonly string[],
  axis: 'x' | 'y' | 'z',
  millimetres: number,
): void {
  if (!Number.isFinite(millimetres) || ids.length < 1) return;
  const index = POSITION_AXIS_INDEX[axis];
  const transforms = ids.map((id) => ({ id, transform: transformOf(id) }));
  const current = transforms.reduce((sum, item) => sum + item.transform.position[index], 0) /
    transforms.length;
  const requested = millimetres / 1000 - current;
  const minDelta = Math.max(...transforms.map((item) => -10 - item.transform.position[index]));
  const maxDelta = Math.min(...transforms.map((item) => 10 - item.transform.position[index]));
  const delta = Math.min(maxDelta, Math.max(minDelta, requested));
  if (Math.abs(delta) < 1e-10) return;

  const next: Record<string, Transform> = {};
  for (const { id, transform } of transforms) {
    const position = [...transform.position] as Transform['position'];
    position[index] += delta;
    next[id] = { ...transform, position };
  }
  commitTransforms(next);
}

/** Sets the multi-select pivot position by translating every group member equally. */
export function setGroupPositionAxis(
  groupId: string,
  axis: 'x' | 'y' | 'z',
  millimetres: number,
): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.partIds.length) return;
  setSelectionPositionAxis(group.partIds, axis, millimetres);
}

/**
 * Sets one axis of a selection's rotation, turning every part around the shared
 * pivot — the numeric counterpart to dragging the rotate gizmo.
 */
export function setSelectionRotationAxis(
  ids: readonly string[],
  axis: 'x' | 'y' | 'z',
  degrees: number,
): void {
  if (!Number.isFinite(degrees) || ids.length < 1) return;
  const members = ids.map((id) => ({ id, transform: transformOf(id) }));
  const reference = members[0]?.transform.quaternion;
  if (!reference) return;
  const euler = quaternionToEulerDegrees(reference);
  if (Math.abs(euler[axis] - degrees) < 1e-6) return;
  euler[axis] = degrees;
  const delta = multiplyQuaternions(eulerDegreesToQuaternion(euler), invertQuaternion(reference));
  const count = members.length;
  const pivot = [0, 1, 2].map(
    (index) => members.reduce((sum, item) => sum + item.transform.position[index]!, 0) / count,
  );
  const next: Record<string, Transform> = {};
  for (const { id, transform } of members) {
    const rotated = rotateVectorByQuaternion(
      {
        x: transform.position[0] - pivot[0]!,
        y: transform.position[1] - pivot[1]!,
        z: transform.position[2] - pivot[2]!,
      },
      delta,
    );
    next[id] = {
      ...transform,
      position: [pivot[0]! + rotated.x, pivot[1]! + rotated.y, pivot[2]! + rotated.z],
      quaternion: multiplyQuaternions(delta, transform.quaternion),
    };
  }
  commitTransforms(next);
}

/**
 * Sets one axis of a group's rotation, turning every member around the shared
 * pivot — the numeric counterpart to dragging the rotate gizmo on a group.
 */
export function setGroupRotationAxis(
  groupId: string,
  axis: 'x' | 'y' | 'z',
  degrees: number,
): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.partIds.length) return;
  setSelectionRotationAxis(group.partIds, axis, degrees);
}

/** Sets one exact overall dimension of a regular (non-cabinet) selection as one rigid resize. */
export function setSelectionSizeAxis(
  ids: readonly string[],
  axis: 'x' | 'y' | 'z',
  millimetres: number,
): void {
  if (!Number.isFinite(millimetres) || ids.length < 2) return;
  const selected = new Set(ids);
  if (doc().groups.some((group) => group.cabinet && group.partIds.some((id) => selected.has(id)))) {
    return;
  }
  const api = viewportApi();
  if (!api) return;
  const target = Math.min(20_000, Math.max(1, millimetres));
  const next = api.computeGroupResize(ids, axis, target);
  if (!next) return;
  commitTransforms(next);
}

/** Sets one exact overall dimension of a regular group as one rigid resize. */
export function setGroupSizeAxis(
  groupId: string,
  axis: 'x' | 'y' | 'z',
  millimetres: number,
): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.partIds.length) return;
  setSelectionSizeAxis(group.partIds, axis, millimetres);
}

/**
 * Sets one axis of a part's rotation directly, in degrees — the numeric
 * counterpart to dragging the rotate gizmo. The other two axes keep their
 * current values, read back from the stored quaternion.
 */
export function setRotationAxis(id: string, axis: 'x' | 'y' | 'z', degrees: number): void {
  if (!Number.isFinite(degrees)) return;
  const current = transformOf(id);
  const euler = quaternionToEulerDegrees(current.quaternion);
  euler[axis] = degrees;
  const quaternion = eulerDegreesToQuaternion(euler);
  commit(() => {
    useDocumentStore.setState((s) => ({
      transforms: { ...s.transforms, [id]: { ...current, quaternion } },
    }));
  });
}

/** Moves the complete selection vertically until its shared lowest point touches the floor. */
export function snapToFloor(ids: readonly string[]): void {
  if (!ids.length) return;
  const api = viewportApi();
  // The viewport is lazy-loaded and can briefly be unmounted (React Strict
  // Mode's double-invoke, or the initial chunk load) while this button is
  // already clickable — silently no-op rather than claiming a check that
  // never actually happened.
  if (!api) return;
  const next = api.computeFloorSnap(ids);
  if (!next) {
    ui().showToast('Already on the floor');
    return;
  }
  commitTransforms(next);
  ui().showToast(ids.length > 1 ? `${ids.length} parts snapped to floor` : 'Snapped to floor');
}

const ALIGN_EDGE_PHRASE: Record<AlignEdge, string> = {
  left: 'left',
  right: 'right',
  'center-x': 'centres',
  front: 'front',
  back: 'back',
  top: 'top',
  bottom: 'bottom',
};

function selectionUnitLabel(
  state: FormaDocument,
  unit: { kind: 'group' | 'part'; id: string },
): string {
  if (unit.kind === 'group')
    return state.groups.find((group) => group.id === unit.id)?.label ?? 'Group';
  return state.customParts.find((part) => part.id === unit.id)?.label ?? 'Piece';
}

/** Keeps the first selected piece/group fixed and snaps the second one to it. */
export function snapSelectedTogether(): void {
  const state = doc();
  const units = selectionUnits(state.groups, ui().selectedPartIds);
  if (units.length !== 2) {
    ui().showToast('Select a target, then Shift-select one piece or group to move');
    return;
  }
  const api = viewportApi();
  const target = units[0];
  const moving = units[1];
  if (!api || !target || !moving) return;
  const next = api.computeSnapTogether(target.partIds, moving.partIds);
  if (!next) {
    ui().showToast('The selected items are already touching');
    return;
  }
  commitTransforms(next);
  ui().showToast(`${selectionUnitLabel(state, moving)} snapped to ${selectionUnitLabel(state, target)}`);
}

/**
 * Keeps the first selected piece/group fixed and matches one bound of the
 * second, leaving the other axes unchanged — so a wall cabinet can share a
 * floor cabinet's left edge without leaving its hang height.
 */
export function alignSelected(edge: AlignEdge): void {
  const state = doc();
  const units = selectionUnits(state.groups, ui().selectedPartIds);
  if (units.length !== 2) {
    ui().showToast('Select a target, then Shift-select one piece or group to move');
    return;
  }
  const api = viewportApi();
  const target = units[0];
  const moving = units[1];
  if (!api || !target || !moving) return;
  const next = api.computeAlign(target.partIds, moving.partIds, edge);
  if (!next) {
    ui().showToast('The selected items are already aligned');
    return;
  }
  commitTransforms(next);
  ui().showToast(
    `${selectionUnitLabel(state, moving)} aligned ${ALIGN_EDGE_PHRASE[edge]} with ${selectionUnitLabel(state, target)}`,
  );
}

// ─── Selection helpers ───────────────────────────────────────────────────────

export function selectAll(): void {
  ui().setSelection(liveIds());
}

// ─── Versions ────────────────────────────────────────────────────────────────

/**
 * Snapshots the live design into Version History. The checkpoint lives in
 * this browser (autosave); download a local copy from the history panel.
 */
export function saveVersion(): void {
  const s = doc();
  const id = `v${Date.now().toString(36)}`;
  const version: SavedVersion = {
    id,
    label: `Version ${s.versions.length + 1}`,
    createdAt: Date.now(),
    doc: snapshotDocument(s),
  };
  useDocumentStore.getState().setVersions([...s.versions, version], id);
  // Versions live outside commit(); keep stacked snapshots from resurrecting
  // a version-less document when the user undoes a later geometry edit.
  syncHistoryDocumentMeta();
  ui().showToast(`Saved ${version.label}`);
}

export function restoreVersion(id: string): void {
  const version = doc().versions.find((v) => v.id === id);
  if (!version) return;
  commit(() => {
    useDocumentStore.getState().replaceSnapshot(structuredClone(version.doc));
    useDocumentStore.setState({ currentVersionId: id });
  });
  ui().clearSelection();
  useUiStore.setState({ historyOpen: false });
  ui().showToast(`Restored ${version.label}`);
}

/** Downloads one checkpoint as a .forma.json file Open File can reload. */
export function downloadVersion(id: string): void {
  const version = doc().versions.find((candidate) => candidate.id === id);
  if (!version) return;
  const filename = `${sanitizeFilename(doc().docTitle)} - ${version.label}.forma.json`;
  const document: FormaDocument = {
    ...structuredClone(version.doc),
    docTitle: doc().docTitle,
    versions: [],
    currentVersionId: null,
  };
  try {
    downloadBlob(
      new Blob(
        [JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc: document }, null, 2)],
        { type: 'application/json' },
      ),
      filename,
    );
    ui().showToast(`Downloaded ${version.label}`);
  } catch {
    ui().showToast('Could not download the file');
  }
}

/**
 * Renames the document. Blank input is ignored, keeping the previous title.
 * Not wrapped in commit() — the title is document metadata, not a geometry
 * edit — but history snapshots still carry it for whole-document undo
 * (`openFile`), so stacked entries are patched to keep Undo from reverting
 * the rename.
 */
export function renameDocument(title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  if (doc().docTitle === trimmed) return;
  useDocumentStore.getState().setDocTitle(trimmed);
  syncHistoryDocumentMeta();
}

// ─── File ────────────────────────────────────────────────────────────────────

/** Starts a clean local document while keeping workspace display preferences. */
export function newDocument(): void {
  useDocumentStore.getState().hydrate(createDefaultDocument());
  // A new file is a fresh history boundary: Undo must never reach back into a
  // different design after the user confirmed that they wanted to replace it.
  clearHistory();
  useUiStore.setState({
    selectedPartIds: [],
    gizmoMode: 'select',
    viewMode: 'model',
    leftTab: 'assembly',
    rightTab: 'properties',
    measureActive: false,
    measurePoints: [],
    marquee: null,
    historyOpen: false,
  });
  ui().showToast('New design created');
}

function sanitizeFilename(title: string): string {
  const trimmed = title.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return trimmed || 'Untitled Design';
}

/**
 * Derives the document title from an on-disk filename. Strips a trailing
 * `.forma.json` or `.json`, then applies the same sanitization used when saving.
 */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '').trim();
  const stem = base.replace(/\.forma\.json$/i, '').replace(/\.json$/i, '');
  return sanitizeFilename(stem);
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

/** Guards against a second Save while the picker is open (e.g. a double-click). */
let isSavingToFile = false;

/**
 * Saves the whole document — geometry, materials, groups and version
 * history — as a .forma.json file, using the same schema-versioned envelope
 * as localStorage autosave. Prefers the File System Access save picker, where
 * the chosen on-disk name drives `docTitle` so the header matches the file.
 * Where the picker is unavailable, downloads under the current title with no
 * extra dialog — the browser may still show its own save dialog, and that is
 * the only one the user sees. Distinct from Save Version, which stays inside
 * this one document until downloaded from Version History.
 */
export async function saveToFile(): Promise<void> {
  if (isSavingToFile) return;
  isSavingToFile = true;
  try {
    await saveToFileOnce();
  } finally {
    isSavingToFile = false;
  }
}

async function saveToFileOnce(): Promise<void> {
  const title = sanitizeFilename(doc().docTitle);
  const pickerWindow = typeof window !== 'undefined' ? (window as SaveFilePickerWindow) : undefined;

  if (typeof pickerWindow?.showSaveFilePicker === 'function') {
    let handle: FileSystemFileHandle;
    try {
      handle = await pickerWindow.showSaveFilePicker({
        suggestedName: `${title}.forma.json`,
        types: [
          {
            description: 'Forma design',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
    } catch (error) {
      // User dismissed the picker — not a save, so change nothing.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // The API exists but refused to show a dialog (embedded frame, browser
      // policy). Nothing was shown yet, so the download below is the only dialog.
      await writeDocumentToFile(title);
      return;
    }

    // The picker was already shown — never stack a second save dialog on top
    // of it. If the write fails, report it rather than falling back.
    try {
      await writeDocumentToFile(titleFromFilename(handle.name), handle);
    } catch (error) {
      console.error('Save to file failed', error);
      ui().showToast('Could not save the file');
    }
    return;
  }

  await writeDocumentToFile(title);
}

async function writeDocumentToFile(
  title: string,
  handle?: FileSystemFileHandle,
): Promise<void> {
  renameDocument(title);
  const payload = serializeCurrentDocument();

  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(payload);
    await writable.close();
  } else {
    try {
      downloadBlob(new Blob([payload], { type: 'application/json' }), `${title}.forma.json`);
    } catch {
      throw new Error('Could not download the file');
    }
  }
  ui().showToast(`Saved ${title}`);
}

/** Same schema-versioned envelope as localStorage autosave and Open File. */
function serializeCurrentDocument(): string {
  const state = doc();
  const document: FormaDocument = {
    ...snapshotDocument(state),
    docTitle: state.docTitle,
    versions: state.versions,
    currentVersionId: state.currentVersionId,
  };
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc: document }, null, 2);
}

/** Reads a .forma.json file and replaces the current document with it, as one undo step. */
export async function openFile(file: File): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    ui().showToast('Could not read that file');
    return;
  }

  const next: FormaDocument | null = migrate(parsed);
  if (!next) {
    ui().showToast('Not a Forma file, or an unsupported version');
    return;
  }

  // The on-disk name is the source of truth for the header once a file is opened.
  const title = titleFromFilename(file.name);
  commit(() => {
    useDocumentStore.getState().replaceSnapshot(structuredClone(next));
    useDocumentStore.setState({
      docTitle: title,
      versions: next.versions,
      currentVersionId: next.currentVersionId,
    });
  });
  ui().clearSelection();
  useUiStore.setState({ historyOpen: false });
  ui().showToast(`Opened ${title}`);
}
