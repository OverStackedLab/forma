import { CUSTOM_PANEL_LIMITS, PANEL_PRESETS } from '@/domain/catalog';
import { groupMatching, livePartIds } from '@/domain/parts';
import { eulerDegreesToQuaternion, quaternionToEulerDegrees } from '@/domain/rotation';
import {
  halfExtentAlongNormalMm,
  orientedHalfExtentsMm,
  rotateVectorByQuaternion,
  type Vector3,
} from '@/domain/spatial';
import type {
  ColorId,
  CustomPart,
  FormaDocument,
  Group,
  MaterialId,
  SavedVersion,
  Transform,
} from '@/domain/types';
import { downloadBlob } from '@/ui/download';
import { viewportApi } from '@/viewport/viewportApi';
import { IDENTITY_TRANSFORM, snapshotDocument, useDocumentStore } from './documentStore';
import { commit } from './history';
import { migrate, SCHEMA_VERSION } from './persistence';
import { useUiStore } from './uiStore';

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

// ─── Material & Color ────────────────────────────────────────────────────────

/** Applies to the current selection as a per-part override, or the document default with nothing selected. */
export function applyMaterial(id: MaterialId): void {
  const selected = ui().selectedPartIds;
  commit(() => {
    if (selected.length) {
      useDocumentStore.setState((s) => {
        const overrides = { ...s.overrides };
        for (const partId of selected) overrides[partId] = { ...overrides[partId], material: id };
        return { overrides };
      });
    } else {
      useDocumentStore.setState({ defaultMaterialId: id });
    }
  });
}

/** Applies to the current selection as a per-part override, or the document default with nothing selected. */
export function applyColor(id: ColorId): void {
  const selected = ui().selectedPartIds;
  commit(() => {
    if (selected.length) {
      useDocumentStore.setState((s) => {
        const overrides = { ...s.overrides };
        for (const partId of selected) overrides[partId] = { ...overrides[partId], color: id };
        return { overrides };
      });
    } else {
      useDocumentStore.setState({ defaultColorId: id });
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
  ui().showToast('Reset to default');
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
          thicknessAxis: preset.thicknessAxis,
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

/** Renames a part. Blank input is ignored, keeping the previous name rather than going empty. */
export function renamePart(id: string, label: string): void {
  const trimmed = label.trim();
  if (!trimmed) return;
  const current = doc().customParts.find((p) => p.id === id);
  if (!current || current.label === trimmed) return;
  commit(() => {
    useDocumentStore.setState((s) => ({
      customParts: s.customParts.map((p) => (p.id === id ? { ...p, label: trimmed } : p)),
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
      };
    });
  });
}

export function duplicateSelected(): void {
  const s = doc();
  const sources = ui()
    .selectedPartIds.map((id) => s.customParts.find((p) => p.id === id))
    .filter((p): p is CustomPart => Boolean(p));

  if (!sources.length) return;

  const clones: CustomPart[] = [];
  const transforms = { ...s.transforms };
  for (const src of sources) {
    const id = nextCustomId();
    clones.push({
      id,
      label: src.label,
      w: src.w,
      h: src.h,
      d: src.d,
      shape: src.shape,
      thicknessAxis: src.thicknessAxis,
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

  commit(() => {
    useDocumentStore.setState((prev) => {
      const overrides = { ...prev.overrides };
      sources.forEach((src, i) => {
        const ov = prev.overrides[src.id];
        if (ov) overrides[clones[i]!.id] = { ...ov };
      });
      return { customParts: [...prev.customParts, ...clones], overrides, transforms };
    });
  });

  ui().setSelection(clones.map((c) => c.id));
  ui().showToast(clones.length > 1 ? `${clones.length} parts duplicated` : 'Part duplicated');
}

// ─── Deletion and visibility ─────────────────────────────────────────────────

export function deleteParts(ids: readonly string[]): void {
  if (!ids.length) return;

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
        .map((g) => ({ ...g, partIds: g.partIds.filter((id) => !ids.includes(id)) }))
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
  commit(() => {
    useDocumentStore.setState((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, label: trimmed } : g)),
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
    useDocumentStore.setState((s) => ({ transforms: { ...s.transforms, ...sanitized } }));
  });
}

/** Placement is kept; only orientation and scale reset. */
export function resetTransforms(ids: readonly string[]): void {
  if (!ids.length) return;
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

/** Drops each selected part straight down (or up) until its bottom face touches the floor. */
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

// ─── Selection helpers ───────────────────────────────────────────────────────

export function selectAll(): void {
  ui().setSelection(liveIds());
}

// ─── Versions ────────────────────────────────────────────────────────────────

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

// ─── File ────────────────────────────────────────────────────────────────────

function sanitizeFilename(title: string): string {
  const trimmed = title.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return trimmed || 'Untitled Design';
}

/**
 * Downloads the whole document — geometry, materials, groups and version
 * history — as a .forma.json file, using the same schema-versioned envelope
 * as localStorage autosave. This is a separate file on disk, distinct from a
 * Save Version snapshot, which stays inside this one document.
 */
export function saveToFile(): void {
  const s = doc();
  const document: FormaDocument = {
    ...snapshotDocument(s),
    docTitle: s.docTitle,
    versions: s.versions,
    currentVersionId: s.currentVersionId,
  };
  const envelope = { schemaVersion: SCHEMA_VERSION, doc: document };
  downloadBlob(
    new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }),
    `${sanitizeFilename(s.docTitle)}.forma.json`,
  );
  ui().showToast('Saved to file');
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

  commit(() => {
    useDocumentStore.getState().replaceSnapshot(structuredClone(next));
    useDocumentStore.setState({
      docTitle: next.docTitle,
      versions: next.versions,
      currentVersionId: next.currentVersionId,
    });
  });
  ui().clearSelection();
  useUiStore.setState({ historyOpen: false });
  ui().showToast(`Opened ${next.docTitle}`);
}
