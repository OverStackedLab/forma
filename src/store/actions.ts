import {
  assignCabinetMemberIds,
  buildCabinetLayout,
  cabinetLayoutSlots,
  distributedDividerPositions,
  distributedShelfPositions,
  dividerPositionRange,
  dividerPositions,
  MAX_DIVIDER_COUNT,
  MAX_SHELF_COUNT,
  interiorMemberPlacement,
  nextFreeInteriorPosition,
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
  isRoundHardwareShape,
  PANEL_PRESETS,
} from '@/domain/catalog';
import {
  cabinetContainingSelection,
  gizmoPartIds,
  groupMatching,
  livePartIds,
  partsInGroupOrder,
  reorderById,
  selectionPositionMetres,
  selectionTogglingGroup,
  selectionUnits,
} from '@/domain/parts';
import { inferCabinetConfig, restorableCabinetGroup } from '@/domain/restoreCabinet';
import { eulerDegreesToQuaternion, invertQuaternion, multiplyQuaternions, quaternionToEulerDegrees } from '@/domain/rotation';
import {
  halfExtentAlongNormalMm,
  localDimensionForWorldAxis,
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
  Transforms,
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
import { loadFormaText, SCHEMA_VERSION } from './persistence';
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

/**
 * Frames a freshly inserted piece. A click from the Library lands it at
 * `nextInsertionX` — clear of everything already in the scene — which on a wide
 * design is often outside the viewport, so the insert looked like it did
 * nothing (BUG-036). A drag-and-drop is already placed where the user was
 * looking, so it keeps the current camera.
 */
function frameInsertedParts(ids: readonly string[], placement?: DropPlacement): void {
  if (placement || !ids.length) return;
  viewportApi()?.frameSelection(ids);
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
  frameInsertedParts([id], placement);
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
  frameInsertedParts(ids, placement);
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

/**
 * Reports any group that just lost its parametric config. Demotion used to be
 * silent, so Add Shelf simply vanished while the user was still looking at
 * cabinet controls (BUG-020) — and the same surprise applied to a partial
 * shelf-row edit or delete. Returns true when a message was shown, so callers
 * can leave their own, less important toast unsaid.
 */
function announceDemotions(before: readonly Group[]): boolean {
  const configurable = new Set(before.filter((group) => group.cabinet).map((group) => group.id));
  if (!configurable.size) return false;
  const demoted = doc().groups.filter((group) => configurable.has(group.id) && !group.cabinet);
  if (!demoted.length) return false;
  const subject = demoted.length === 1 ? demoted[0]!.label : `${demoted.length} cabinets`;
  ui().showToast(`${subject} no longer matches a carcass — use Restore cabinet for shelf controls`);
  return true;
}

const DIM_AXIS_INDEX = { w: 0, h: 1, d: 2 } as const;

export function setCustomPartDim(id: string, key: 'w' | 'h' | 'd', value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  const limits = CUSTOM_PANEL_LIMITS[key];
  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  const groupsBefore = doc().groups;
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
  announceDemotions(groupsBefore);
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

/**
 * An interior cabinet panel duplicates like Add Panel: next free centreline
 * from that panel, still in the carcass. A loose +X/+Z clone would sit inside
 * the group AABB and measure to the outer box instead of the facing inner face.
 */
function tryDuplicateInteriorMember(groups: readonly Group[], selectedIds: readonly string[]): boolean {
  if (selectedIds.length !== 1) return false;
  const partId = selectedIds[0];
  if (!partId) return false;
  const group = cabinetContainingSelection(groups, [partId]);
  if (!group?.cabinet) return false;
  const interior = interiorMemberPlacement(group.cabinet, group.partIds, partId);
  if (interior?.kind !== 'divider') return false;

  const before = new Set(group.partIds);
  addCabinetDivider(group.id, interior.positionMm);
  const next = doc().groups.find((candidate) => candidate.id === group.id);
  const added = next?.partIds.filter((id) => !before.has(id)) ?? [];
  const addedId = added.at(-1);
  if (addedId) ui().setSelection([addedId]);
  return true;
}

export function duplicateSelected(): void {
  const s = doc();
  const selectedIds = ui().selectedPartIds;
  if (tryDuplicateInteriorMember(s.groups, selectedIds)) return;

  // Every fully selected group copies as a group, so duplicating two cabinets
  // yields two cabinets rather than a pile of loose panels (BUG-019). A single
  // member is still a loose clone — a viewport click is one piece, and copying
  // it must not clone the whole carcass (BUG-022).
  const units = selectionUnits(s.groups, selectedIds);
  const sourceIds = units.flatMap((unit) => unit.partIds);
  const sources = sourceIds
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

  // Group member order is structural for generated cabinets, so each clone
  // rebuilds its membership from the source group's order, not selection order.
  const clonedGroups: Group[] = [];
  for (const unit of units) {
    if (unit.kind !== 'group') continue;
    const source = s.groups.find((group) => group.id === unit.id);
    if (!source) continue;
    clonedGroups.push({
      id: nextGroupId(),
      label: source.label,
      partIds: source.partIds.flatMap((id) => {
        const clonedId = cloneIdBySource.get(id);
        return clonedId ? [clonedId] : [];
      }),
      cabinet: source.cabinet
        ? {
            ...source.cabinet,
            shelfPositionsMm: source.cabinet.shelfPositionsMm
              ? [...source.cabinet.shelfPositionsMm]
              : undefined,
            dividerPositionsMm: source.cabinet.dividerPositionsMm
              ? [...source.cabinet.dividerPositionsMm]
              : undefined,
          }
        : undefined,
    });
  }

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
        groups: clonedGroups.length ? [...prev.groups, ...clonedGroups] : prev.groups,
      };
    });
  });

  ui().setSelection(clones.map((c) => c.id));
  ui().showToast(duplicateToast(clonedGroups, clones.length));
}

function duplicateToast(clonedGroups: readonly Group[], cloneCount: number): string {
  if (clonedGroups.length === 1) return `${clonedGroups[0]!.label} group duplicated`;
  if (clonedGroups.length > 1) return `${clonedGroups.length} groups duplicated`;
  return cloneCount > 1 ? `${cloneCount} parts duplicated` : 'Part duplicated';
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

  const shelfYs = shelfPositions(cabinet);
  const slots = cabinetLayoutSlots(cabinet, group.partIds.length);

  const baysInRow = new Map<number, number>();
  for (const slot of slots) {
    if (slot.kind === 'shelf') baysInRow.set(slot.row, (baysInRow.get(slot.row) ?? 0) + 1);
  }

  const removedBaysInRow = new Map<number, number>();
  const removedPanelIndices = new Set<number>();
  for (const [index, id] of group.partIds.entries()) {
    if (!deletedIds.has(id)) continue;
    const slot = slots[index];
    // A side, top, bottom or back is structural — the caller demotes.
    if (!slot || slot.kind === 'carcass') return null;
    if (slot.kind === 'shelf') {
      removedBaysInRow.set(slot.row, (removedBaysInRow.get(slot.row) ?? 0) + 1);
    } else {
      removedPanelIndices.add(slot.index);
    }
  }

  // A shelf row is one centreline shared by every bay. Deleting only some of a
  // row's boards has no parametric representation, so demote rather than
  // quietly taking the rest of the row with it (BUG-030).
  for (const [row, removed] of removedBaysInRow) {
    if (removed !== (baysInRow.get(row) ?? 0)) return null;
  }

  const removedShelfRows = new Set(removedBaysInRow.keys());
  if (!removedShelfRows.size && !removedPanelIndices.size) return cabinet;

  const nextShelves = shelfYs.filter((_, index) => !removedShelfRows.has(index));
  const nextPanels = dividerPositions(cabinet).filter((_, index) => !removedPanelIndices.has(index));
  return {
    ...cabinet,
    shelfCount: removedShelfRows.size ? nextShelves.length : cabinet.shelfCount,
    shelfPositionsMm: removedShelfRows.size
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
  // A demotion is the surprising half of the outcome; the deletion itself is
  // visible in the viewport, so the explanation wins the single toast slot.
  if (!announceDemotions(state.groups)) {
    ui().showToast(ids.length > 1 ? `${ids.length} parts deleted` : 'Part deleted');
  }
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

/**
 * Reattaches parametric cabinet config to a rigid group that still looks like
 * a carcass. Geometry is left as-is; the next W/H/D or Add Shelf rebuilds.
 * Opening a file never does this on its own (BUG-009).
 */
export function restoreSelectedCabinet(): void {
  const state = doc();
  const selected = ui().selectedPartIds;
  const group = restorableCabinetGroup(state.groups, state.customParts, state.transforms, selected);
  const cabinet = group
    ? inferCabinetConfig(state.customParts, state.transforms, group.partIds)
    : null;
  if (!group || !cabinet) {
    ui().showToast("Can't restore this group as a cabinet");
    return;
  }
  commit(() => {
    useDocumentStore.setState((previous) => ({
      groups: previous.groups.map((candidate) =>
        candidate.id === group.id ? { ...candidate, cabinet } : candidate,
      ),
    }));
  });
  ui().showToast('Cabinet controls restored');
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

/** Adds or removes a whole group without replacing the rest of the selection. */
export function toggleGroupSelection(groupId: string): void {
  const group = doc().groups.find((g) => g.id === groupId);
  if (!group) return;
  ui().setSelection(selectionTogglingGroup(ui().selectedPartIds, group.partIds));
}

/** Moves a group before or after another in Assembly. Loose parts stay after. */
export function reorderGroups(
  sourceId: string,
  targetId: string,
  place: 'before' | 'after',
): void {
  if (sourceId === targetId) return;
  commit(() => {
    useDocumentStore.setState((s) => {
      const groups = reorderById(s.groups, sourceId, targetId, place);
      if (groups.every((group, index) => group.id === s.groups[index]?.id)) return s;
      return { groups, customParts: partsInGroupOrder(s.customParts, groups) };
    });
  });
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

/** Positions are held inside this half-extent, in metres, on every axis. */
const POSITION_LIMIT_M = 10;

/**
 * One shared correction per axis that brings a batch of positions inside
 * `POSITION_LIMIT_M`. Clamping each part on its own used to flatten a whole
 * carcass onto the boundary plane (BUG-031); a single translation moves the
 * batch as the rigid thing the user was dragging. A selection wider than the
 * range cannot fit at all — it is pulled back to the low bound rather than
 * squashed.
 */
function sharedPositionCorrection(positions: readonly Transform['position'][]): [number, number, number] {
  const correction: [number, number, number] = [0, 0, 0];
  for (const axis of [0, 1, 2] as const) {
    let lowest = Infinity;
    let highest = -Infinity;
    for (const position of positions) {
      lowest = Math.min(lowest, position[axis]);
      highest = Math.max(highest, position[axis]);
    }
    if (!Number.isFinite(lowest) || !Number.isFinite(highest)) continue;
    const over = Math.max(0, highest - POSITION_LIMIT_M);
    const under = Math.max(0, -POSITION_LIMIT_M - lowest);
    correction[axis] = under - over;
  }
  return correction;
}

/**
 * Called once when a gizmo drag ends, not per frame — so a drag is one undo
 * entry and the store isn't churned at 60 fps.
 */
export function commitTransforms(next: Record<string, Transform>): void {
  const entries = Object.entries(next);
  if (!entries.length) return;
  const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

  const cleaned = entries.map(([id, transform]) => {
    const position = transform.position.map((value) => finite(value, 0)) as Transform['position'];
    const rawQuaternion = transform.quaternion.map((value) => finite(value, 0)) as Transform['quaternion'];
    const length = Math.hypot(...rawQuaternion);
    const quaternion: Transform['quaternion'] =
      length > 1e-8
        ? rawQuaternion.map((value) => value / length) as Transform['quaternion']
        : [0, 0, 0, 1];
    // Magnitude only: a scale handle dragged through the pivot reports a
    // negative factor, and clamping that to the 0.001 floor annihilated the
    // part (BUG-035). Mirroring is not a supported edit, so the sign is dropped
    // and the part keeps its size instead.
    const scale = transform.scale.map((value) =>
      Math.min(100, Math.max(0.001, Math.abs(finite(value, 1)))),
    ) as Transform['scale'];
    return { id, position, quaternion, scale };
  });

  const groupsBefore = doc().groups;
  const correction = sharedPositionCorrection(cleaned.map((entry) => entry.position));
  const sanitized = Object.fromEntries(
    cleaned.map(({ id, position, quaternion, scale }) => [
      id,
      {
        position: [
          position[0] + correction[0],
          position[1] + correction[1],
          position[2] + correction[2],
        ],
        quaternion,
        scale,
      } satisfies Transform,
    ]),
  );

  commit(() => {
    useDocumentStore.setState((s) => {
      const transforms = { ...s.transforms, ...sanitized };
      // A committed scale is a size edit, so it demotes a partially edited
      // cabinet exactly as the typed dimension field does (BUG-033). Position
      // and rotation still never demote.
      const resized = cleaned
        .filter(({ id, scale }) => {
          const previous = s.transforms[id];
          return previous ? scale.some((value, axis) => value !== previous.scale[axis]) : false;
        })
        .map(({ id }) => id);
      const groups = invalidatePartiallyEditedCabinets(s.groups, resized);
      return {
        transforms,
        groups: groupsWithSyncedInteriors(groups, transforms, Object.keys(sanitized)),
      };
    });
  });
  announceDemotions(groupsBefore);
}

/** Translates the gizmo's current parts by a millimetre world delta. */
export function nudgeSelected(deltaMm: { x: number; y: number; z: number }): void {
  const ids = gizmoPartIds(doc().groups, ui().selectedPartIds);
  if (!ids.length) return;
  const dx = deltaMm.x / 1000;
  const dy = deltaMm.y / 1000;
  const dz = deltaMm.z / 1000;
  if (dx === 0 && dy === 0 && dz === 0) return;

  const next: Record<string, Transform> = {};
  for (const id of ids) {
    const transform = transformOf(id);
    next[id] = {
      ...transform,
      position: [
        transform.position[0] + dx,
        transform.position[1] + dy,
        transform.position[2] + dz,
      ],
    };
  }
  commitTransforms(next);
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
function cabinetPlacement(
  group: Group,
  config: CabinetConfig,
  transforms: Transforms = doc().transforms,
): {
  origin: [number, number, number];
  quaternion: Transform['quaternion'];
} {
  const layout = buildCabinetLayout(cabinetPreset(group, config));
  const anchorId = group.partIds[0];
  const anchor = (anchorId ? transforms[anchorId] : undefined) ?? IDENTITY_TRANSFORM;
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

function uniqueSortedMm(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value)))].sort((a, b) => a - b);
}

/**
 * Millimetre tolerance for "the same interior layout". Live centrelines are
 * read back as rounded integers while an even distribution is fractional
 * (High 600 spaces four shelves at 450.8, 883.6, 1316.4, 1749.2 mm), so exact
 * equality could never match and every edit froze the shelves into explicit
 * positions (BUG-032). `restoreCabinet.matchesEven` uses the same tolerance.
 */
const INTERIOR_TOLERANCE_MM = 2;

function sameMm(
  left: readonly number[],
  right: readonly number[],
  toleranceMm: number = INTERIOR_TOLERANCE_MM,
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => Math.abs(value - (right[index] ?? 0)) <= toleranceMm)
  );
}

/**
 * A config the group's current members can actually render. Writing one whose
 * layout is a different length leaves the group describing more pieces than it
 * owns, which the next rebuild resolves by remapping ids onto the wrong roles
 * (BUG-029).
 */
function layoutMatchesMembers(group: Group, config: CabinetConfig): boolean {
  return buildCabinetLayout(cabinetPreset(group, config)).length === group.partIds.length;
}

/**
 * Shelf rows and panel centrelines from live transforms, so a gizmo /
 * typed-gap move is not discarded the next time Add Shelf or Add Panel
 * rebuilds.
 *
 * Shelves are collapsed by layout *row*, not by distinct height. A cabinet
 * with an interior panel carries one shelf board per bay on a shared
 * centreline, so reading every board as its own row turned a single moved
 * shelf into a whole extra row of shelves (BUG-029). Returns null when the
 * pieces can no longer be described parametrically at all — the caller demotes
 * rather than writing a config the members do not match.
 */
function liveInteriorCentrelines(
  group: Group,
  cabinet: CabinetConfig,
  transforms: Transforms = doc().transforms,
): {
  shelves: number[];
  panels: number[];
} | null {
  const layout = buildCabinetLayout(cabinetPreset(group, cabinet));
  if (layout.length !== group.partIds.length) return null;
  const slots = cabinetLayoutSlots(cabinet, group.partIds.length);
  const placement = cabinetPlacement(group, cabinet, transforms);
  const inverse = invertQuaternion(placement.quaternion);
  const shelfRows = new Map<number, number[]>();
  const panelsByIndex = new Map<number, number>();

  for (const [index, partId] of group.partIds.entries()) {
    const slot = slots[index];
    if (!slot || slot.kind === 'carcass') continue;
    const world = transforms[partId]?.position;
    if (!world) continue;
    const local = rotateVectorByQuaternion(
      {
        x: world[0] - placement.origin[0],
        y: world[1] - placement.origin[1],
        z: world[2] - placement.origin[2],
      },
      inverse,
    );
    if (slot.kind === 'shelf') {
      const row = shelfRows.get(slot.row) ?? [];
      row.push(local.y * 1000);
      shelfRows.set(slot.row, row);
    } else {
      panelsByIndex.set(slot.index, local.x * 1000 + cabinet.width / 2);
    }
  }

  const shelves: number[] = [];
  for (const heights of shelfRows.values()) {
    const lowest = Math.min(...heights);
    const highest = Math.max(...heights);
    // Every bay in a row shares one centreline. A bay moved off that line has
    // no parametric representation, so the cabinet stops being regenerable.
    if (highest - lowest > INTERIOR_TOLERANCE_MM) return null;
    shelves.push((lowest + highest) / 2);
  }
  return {
    shelves: uniqueSortedMm(shelves),
    panels: uniqueSortedMm([...panelsByIndex.values()]),
  };
}

function cabinetWithLiveInterior(
  group: Group,
  cabinet: CabinetConfig,
  transforms: Transforms = doc().transforms,
): CabinetConfig {
  const live = liveInteriorCentrelines(group, cabinet, transforms);
  // Nothing readable: keep the stored config rather than guessing a new one.
  if (!live) return cabinet;
  const shelves = live.shelves.length ? live.shelves : shelfPositions(cabinet);
  const panels = live.panels.length ? live.panels : dividerPositions(cabinet);
  const evenShelves = shelfPositions({ height: cabinet.height, shelfCount: shelves.length });
  return {
    ...cabinet,
    shelfCount: shelves.length,
    shelfPositionsMm: shelves.length && !sameMm(shelves, evenShelves) ? shelves : undefined,
    dividerPositionsMm: panels.length ? panels : undefined,
  };
}

/**
 * Writes gizmo / typed-position moves back onto `cabinet` so Properties and
 * the next Add Shelf / Add Panel keep the placed centrelines. Only runs when
 * an interior member actually moved — dragging a side must not rewrite
 * interiors from a shifted origin.
 */
function groupsWithSyncedInteriors(
  groups: readonly Group[],
  transforms: Transforms,
  changedIds: readonly string[],
): Group[] {
  const changed = new Set(changedIds);
  return groups.map((group) => {
    const cabinet = group.cabinet;
    if (!cabinet) return group;
    const interiorMoved = group.partIds.some((id) => {
      if (!changed.has(id)) return false;
      return Boolean(interiorMemberPlacement(cabinet, group.partIds, id));
    });
    if (!interiorMoved) return group;
    // One bay's shelf moved off its row: the parametric config cannot express
    // that, so the group demotes to a plain group instead of gaining a phantom
    // shelf row (BUG-029). Restore cabinet can rebuild the config later.
    if (!liveInteriorCentrelines(group, cabinet, transforms)) {
      return { ...group, cabinet: undefined };
    }
    const next = cabinetWithLiveInterior(group, cabinet, transforms);
    if (!layoutMatchesMembers(group, next)) return { ...group, cabinet: undefined };
    const sameShelves = sameMm(shelfPositions(next), shelfPositions(cabinet));
    const samePanels = sameMm(dividerPositions(next), dividerPositions(cabinet));
    return sameShelves && samePanels ? group : { ...group, cabinet: next };
  });
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
 * Rebuilds a cabinet from its parametric config. Carcass, shelf, and panel ids
 * stay bound to those roles so adding a bay does not turn a panel into a shelf.
 * New members mint ids; removed roles drop theirs.
 */
function commitCabinetResize(
  group: Group,
  requested: CabinetConfig,
  placement: { origin: [number, number, number]; quaternion: Transform['quaternion'] },
): void {
  const { config, label } = cabinetResizeMetadata(group, requested);
  const nextGroup = { ...group, label };
  const layout = buildCabinetLayout(cabinetPreset(nextGroup, config));
  const nextIds = assignCabinetMemberIds(
    group.partIds,
    group.cabinet ?? config,
    layout.length,
    config,
    nextCustomId,
  );
  const nextIdSet = new Set(nextIds);
  const removedIds = group.partIds.filter((id) => !nextIdSet.has(id));
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

  // Keep a partial selection on the same members when ids survive the rebuild.
  // Selecting the whole carcass here used to jump Properties off the piece the
  // user was placing, and index-stable ids turned that piece into a new shelf.
  const selected = ui().selectedPartIds;
  if (!selected.some((id) => group.partIds.includes(id))) return;
  const selectedWholeCabinet = group.partIds.every((id) => selected.includes(id));
  if (selectedWholeCabinet) {
    ui().setSelection(nextIds);
    return;
  }
  const stillLive = selected.filter((id) => nextIdSet.has(id));
  if (stillLive.length) ui().setSelection(stillLive);
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
  const live = cabinetWithLiveInterior(group, group.cabinet);
  const nextConfig: CabinetConfig = {
    ...live,
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
  const live = cabinetWithLiveInterior(group, group.cabinet);
  const sorted = shelfPositions({
    height: live.height,
    shelfCount: positionsMm.length,
    shelfPositionsMm: positionsMm.filter((y) => Number.isFinite(y)),
  });
  const nextConfig: CabinetConfig = {
    ...live,
    shelfCount: sorted.length,
    shelfPositionsMm: sorted.length ? sorted : undefined,
  };
  const placement = cabinetPlacement(group, group.cabinet);
  commitCabinetResize(group, nextConfig, placement);
}

/** Adds one shelf at the given centreline height, keeping the existing ones. */
export function addCabinetShelf(groupId: string, positionMm: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet || !Number.isFinite(positionMm)) return;
  const live = cabinetWithLiveInterior(group, group.cabinet);
  const current = shelfPositions(live);
  if (current.length >= MAX_SHELF_COUNT) {
    ui().showToast(`A cabinet holds at most ${MAX_SHELF_COUNT} shelves`);
    return;
  }
  const range = shelfPositionRange(live.height);
  const next = nextFreeInteriorPosition(current, positionMm, range);
  if (next === null) {
    ui().showToast('No free space for another shelf');
    return;
  }
  setCabinetShelfPositions(groupId, [...current, next]);
  const rounded = Math.round(positionMm);
  ui().showToast(
    rounded < range.min || rounded > range.max
      ? `Shelf clamped into the cabinet at ${next} mm`
      : `Shelf added at ${next} mm`,
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
  const live = cabinetWithLiveInterior(group, group.cabinet);
  const sorted = dividerPositions({
    width: live.width,
    dividerPositionsMm: positionsMm.filter((x) => Number.isFinite(x)),
  });
  const nextConfig: CabinetConfig = {
    ...live,
    dividerPositionsMm: sorted.length ? sorted : undefined,
  };
  const placement = cabinetPlacement(group, group.cabinet);
  commitCabinetResize(group, nextConfig, placement);
}

/** Adds one vertical panel at the given centreline, keeping the existing ones. */
export function addCabinetDivider(groupId: string, positionMm: number): void {
  const group = doc().groups.find((candidate) => candidate.id === groupId);
  if (!group?.cabinet || !Number.isFinite(positionMm)) return;
  const live = cabinetWithLiveInterior(group, group.cabinet);
  const current = dividerPositions(live);
  if (current.length >= MAX_DIVIDER_COUNT) {
    ui().showToast(`A cabinet holds at most ${MAX_DIVIDER_COUNT} panels`);
    return;
  }
  const range = dividerPositionRange(live.width);
  const next = nextFreeInteriorPosition(current, positionMm, range);
  if (next === null) {
    ui().showToast('No free space for another panel');
    return;
  }
  setCabinetDividerPositions(groupId, [...current, next]);
  const rounded = Math.round(positionMm);
  ui().showToast(
    rounded < range.min || rounded > range.max
      ? `Panel clamped into the cabinet at ${next} mm`
      : `Panel added at ${next} mm`,
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
    useDocumentStore.setState((s) => {
      const transforms = { ...s.transforms, [id]: { ...current, position } };
      return {
        transforms,
        groups: groupsWithSyncedInteriors(s.groups, transforms, [id]),
      };
    });
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
  const current = selectionPositionMetres(doc().customParts, doc().transforms, ids)[index] ?? 0;
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

/**
 * Types an overall W/H/D witness while the scale gizmo is on. Targets the
 * same parts the gizmo drives: a cabinet group resizes parametrically, a
 * single part writes its catalog size, a rigid group scales around the pivot.
 */
export function setSelectedOverallDim(axis: 'x' | 'y' | 'z', millimetres: number): void {
  if (!Number.isFinite(millimetres) || millimetres <= 0) return;
  const state = doc();
  const ids = gizmoPartIds(state.groups, ui().selectedPartIds);
  if (!ids.length) return;

  const selected = new Set(ids);
  const cabinet = cabinetContainingSelection(state.groups, ids);
  if (
    cabinet?.cabinet &&
    cabinet.partIds.length === ids.length &&
    cabinet.partIds.every((id) => selected.has(id))
  ) {
    const key = axis === 'x' ? 'width' : axis === 'y' ? 'height' : 'depth';
    setCabinetDim(cabinet.id, key, millimetres);
    return;
  }

  if (ids.length === 1) {
    const id = ids[0];
    if (!id) return;
    const part = state.customParts.find((candidate) => candidate.id === id);
    if (!part) return;
    // The witness measures the world AABB, so the world axis must be mapped
    // back onto the part's own axis before writing a catalog dimension.
    // Assuming x→w unconditionally meant typing the W label on a door rotated
    // 90° about Y resized its depth instead (BUG-037).
    const key = localDimensionForWorldAxis(transformOf(id).quaternion, axis);
    if (part.category === 'hardware') {
      if (isLegHardwareShape(part.shape)) {
        if (key === 'h') setCustomPartDim(id, 'h', millimetres);
        else setHardwareDiameter(id, millimetres);
        return;
      }
      if (isRoundHardwareShape(part.shape)) {
        if (key === 'd') setCustomPartDim(id, 'd', millimetres);
        else setHardwareDiameter(id, millimetres);
        return;
      }
    }
    setCustomPartDim(id, key, millimetres);
    return;
  }

  setSelectionSizeAxis(ids, axis, millimetres);
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
  viewportApi()?.frameAll();
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

/** Guards against a second Save while a write is in flight (e.g. a double-click). */
let isSavingToFile = false;

/**
 * Saves the whole document — geometry, materials, groups and version
 * history — as a downloaded `.forma.json` file, using the same schema-versioned
 * envelope as localStorage autosave. A native save picker is not used: Chrome's
 * File System Access write often fails after the dialog (BUG-026), which left
 * only a "Could not save the file" toast. Distinct from Save Version, which
 * stays inside this one document until downloaded from Version History.
 */
export async function saveToFile(): Promise<boolean> {
  if (isSavingToFile) return false;
  isSavingToFile = true;
  try {
    const title = sanitizeFilename(doc().docTitle);
    renameDocument(title);
    const payload = serializeCurrentDocument();
    downloadBlob(new Blob([payload], { type: 'application/json' }), `${title}.forma.json`);
    ui().showToast(`Saved ${title}`);
    return true;
  } catch (error) {
    console.error('Save to file failed', error);
    ui().showToast('Could not save the file');
    return false;
  } finally {
    isSavingToFile = false;
  }
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
  const result = loadFormaText(await file.text());
  if (!result.ok) {
    if (result.reason === 'empty') {
      ui().showToast('That file is empty. It may not have finished saving.');
    } else if (result.reason === 'invalid-json') {
      ui().showToast('Could not read that file');
    } else {
      ui().showToast('Not a Forma file, or an unsupported version');
    }
    return;
  }
  const next = result.doc;

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
  viewportApi()?.frameAll();
  ui().showToast(`Opened ${title}`);
}
