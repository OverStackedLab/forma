import { PANEL_PRESETS } from '@/domain/catalog';
import { groupMatching, livePartIds } from '@/domain/parts';
import { eulerDegreesToQuaternion, quaternionToEulerDegrees } from '@/domain/rotation';
import type { CustomPart, FinishId, Group, SavedVersion, Transform } from '@/domain/types';
import { viewportApi } from '@/viewport/viewportApi';
import { IDENTITY_TRANSFORM, snapshotDocument, useDocumentStore } from './documentStore';
import { commit } from './history';
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

// ─── Finish ──────────────────────────────────────────────────────────────────

/** Applies to the current selection as a per-part override, or the document default with nothing selected. */
export function applyFinish(id: FinishId): void {
  const selected = ui().selectedPartIds;
  commit(() => {
    if (selected.length) {
      useDocumentStore.setState((s) => {
        const overrides = { ...s.overrides };
        for (const partId of selected) overrides[partId] = { ...overrides[partId], body: id };
        return { overrides };
      });
    } else {
      useDocumentStore.setState({ defaultFinishId: id });
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

export function addCustomPanel(presetId: string, dropPoint?: { x: number; z: number }): void {
  const preset = PANEL_PRESETS.find((p) => p.id === presetId) ?? PANEL_PRESETS[0]!;
  const s = doc();
  const id = nextCustomId();
  const n = s.customParts.length;
  const x = dropPoint ? dropPoint.x : ((n % 4) - 1.5) * 0.5;
  const z = dropPoint ? dropPoint.z : 0.4;
  const y = preset.h / 2000;

  commit(() => {
    useDocumentStore.setState((prev) => ({
      customParts: [...prev.customParts, { id, label: preset.label, w: preset.w, h: preset.h, d: preset.d }],
      overrides: { ...prev.overrides, [id]: { body: prev.defaultFinishId } },
      transforms: {
        ...prev.transforms,
        [id]: { position: [x, y, z], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
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
  commit(() => {
    useDocumentStore.setState((s) => {
      const t = s.transforms[id];
      let transforms = s.transforms;
      if (t) {
        // The typed value becomes the new absolute size on this axis only —
        // other axes keep whatever the gizmo scaled them to.
        const scale = [...t.scale] as [number, number, number];
        scale[DIM_AXIS_INDEX[key]] = 1;
        transforms = { ...s.transforms, [id]: { ...t, scale } };
      }
      return {
        customParts: s.customParts.map((p) => (p.id === id ? { ...p, [key]: value } : p)),
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
    clones.push({ id, label: src.label, w: src.w, h: src.h, d: src.d });
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

/** Shows the group if any member is hidden; otherwise hides the whole group. */
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
  commit(() => {
    useDocumentStore.setState((s) => ({ transforms: { ...s.transforms, ...next } }));
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
