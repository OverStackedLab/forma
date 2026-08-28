import { beforeEach, describe, expect, it } from 'vitest';
import { buildCabinetLayout, dividerPositions, shelfPositions } from '@/domain/cabinets';
import type { CabinetConfig, Group, Transform } from '@/domain/types';
import {
  addCabinetDivider,
  addCabinetPreset,
  addCabinetShelf,
  addCustomPanel,
  commitTransforms,
  deleteParts,
  duplicateSelected,
  nudgeSelected,
  renamePart,
  saveVersion,
  setCabinetDim,
  setCabinetShelfPositions,
  setCustomPartDim,
  setRotationAxis,
  setSelectedOverallDim,
  transformOf,
} from './actions';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';

const doc = () => useDocumentStore.getState();
const firstGroup = (): Group => doc().groups[0]!;

/** Members the group's config says it should have, for desync assertions. */
function layoutLength(group: Group): number {
  const cabinet = group.cabinet!;
  return buildCabinetLayout({
    id: cabinet.presetId ?? 'base-600',
    label: group.label,
    icon: 'cabinet',
    width: cabinet.width,
    height: cabinet.height,
    depth: cabinet.depth,
    shelfCount: cabinet.shelfCount,
    shelfPositionsMm: cabinet.shelfPositionsMm,
    dividerPositionsMm: cabinet.dividerPositionsMm,
  }).length;
}

/** Shelf part ids of a cabinet: everything after the 5 carcass pieces, minus panels. */
function shelfIdsOf(group: Group): string[] {
  const panels = dividerPositions(group.cabinet!).length;
  return group.partIds.slice(5, group.partIds.length - panels);
}

/** One drag of `ids`, committed together the way the gizmo commits a gesture. */
function moveBy(ids: string | readonly string[], delta: Partial<Record<'x' | 'y' | 'z', number>>): void {
  const next: Record<string, Transform> = {};
  for (const id of typeof ids === 'string' ? [ids] : ids) {
    const t = transformOf(id);
    next[id] = {
      ...t,
      position: [
        t.position[0] + (delta.x ?? 0),
        t.position[1] + (delta.y ?? 0),
        t.position[2] + (delta.z ?? 0),
      ],
    };
  }
  commitTransforms(next);
}

beforeEach(() => {
  useDocumentStore.getState().hydrate(createDefaultDocument());
  useUiStore.setState({
    selectedPartIds: [],
    gizmoMode: 'select',
    viewMode: 'model',
    measureActive: false,
    measurePoints: [],
    displayUnit: 'mm',
    toast: null,
  });
});

describe('BUG-029 — a moved shelf in a multi-bay cabinet', () => {
  function twoBayCabinet(): Group {
    addCabinetPreset('base-600');
    addCabinetDivider(firstGroup().id, 300);
    return firstGroup();
  }

  it('keeps one shelf row when the whole row is dragged together', () => {
    const group = twoBayCabinet();
    expect(shelfIdsOf(group)).toHaveLength(2);
    // Selecting both boards and dragging is one gesture, so one commit.
    moveBy(shelfIdsOf(group), { y: 0.1 });
    const after = firstGroup();
    expect(after.cabinet?.shelfCount).toBe(1);
    expect(shelfPositions(after.cabinet!)).toEqual([500]);
    expect(layoutLength(after)).toBe(after.partIds.length);
  });

  it('demotes rather than inventing a second shelf row from one moved bay', () => {
    const group = twoBayCabinet();
    moveBy(shelfIdsOf(group)[0]!, { y: 0.1 });
    const after = firstGroup();
    // Previously: shelfCount became 2 while only 2 shelf boards existed, and
    // the next Add Shelf produced six shelves.
    expect(after.cabinet).toBeUndefined();
    expect(after.partIds).toHaveLength(group.partIds.length);
    expect(doc().customParts).toHaveLength(group.partIds.length);
  });

  it('never leaves a cabinet whose config describes more members than it owns', () => {
    const group = twoBayCabinet();
    moveBy(shelfIdsOf(group)[0]!, { y: 0.1 });
    const after = firstGroup();
    if (after.cabinet) expect(layoutLength(after)).toBe(after.partIds.length);
  });

  it('still writes back a moved shelf in a single-bay cabinet (BUG-028)', () => {
    addCabinetPreset('base-600');
    const group = firstGroup();
    moveBy(shelfIdsOf(group)[0]!, { y: 0.1 });
    const after = firstGroup();
    expect(after.cabinet).toBeDefined();
    expect(shelfPositions(after.cabinet!)).toEqual([500]);
  });

  it('adds exactly one shelf row after a whole row was repositioned', () => {
    const group = twoBayCabinet();
    moveBy(shelfIdsOf(group), { y: 0.1 });
    addCabinetShelf(firstGroup().id, 600);
    const after = firstGroup();
    expect(shelfPositions(after.cabinet!)).toEqual([500, 600]);
    expect(shelfIdsOf(after)).toHaveLength(4); // 2 rows × 2 bays
  });
});

describe('BUG-030 — deleting a shelf in a multi-bay cabinet', () => {
  it('demotes instead of silently removing the facing bay too', () => {
    addCabinetPreset('base-600');
    addCabinetDivider(firstGroup().id, 300);
    const group = firstGroup();
    const shelves = shelfIdsOf(group);
    expect(shelves).toHaveLength(2);

    deleteParts([shelves[0]!]);
    const after = firstGroup();
    expect(doc().customParts.some((part) => part.id === shelves[1])).toBe(true);
    expect(after.partIds).toHaveLength(group.partIds.length - 1);
    expect(after.cabinet).toBeUndefined();
  });

  it('still drops a whole row parametrically when every bay is deleted', () => {
    addCabinetPreset('base-600');
    addCabinetDivider(firstGroup().id, 300);
    const group = firstGroup();
    deleteParts(shelfIdsOf(group));
    const after = firstGroup();
    expect(after.cabinet).toBeDefined();
    expect(shelfPositions(after.cabinet!)).toEqual([]);
  });

  it('still deletes a lone shelf parametrically in a single-bay cabinet (BUG-014)', () => {
    addCabinetPreset('base-600');
    const group = firstGroup();
    deleteParts([shelfIdsOf(group)[0]!]);
    const after = firstGroup();
    expect(after.cabinet).toBeDefined();
    expect(after.cabinet?.shelfCount).toBe(0);
  });
});

describe('BUG-031 — the ±10 m position limit', () => {
  it('moves a selection to the boundary as one rigid structure', () => {
    addCabinetPreset('base-600');
    const group = firstGroup();
    const spacingBefore = group.partIds.map((id) => transformOf(id).position[0]);
    useUiStore.getState().setSelection([...group.partIds]);

    for (let i = 0; i < 4; i++) nudgeSelected({ x: 4000, y: 0, z: 0 });

    const after = group.partIds.map((id) => transformOf(id).position[0]);
    // Previously every panel landed on x = 10 and the carcass became a plane.
    expect(new Set(after.map((x) => Math.round(x * 1000))).size)
      .toBe(new Set(spacingBefore.map((x) => Math.round(x * 1000))).size);
    after.forEach((x, index) => {
      expect(x - after[0]!).toBeCloseTo(spacingBefore[index]! - spacingBefore[0]!, 9);
    });
    expect(Math.max(...after)).toBeLessThanOrEqual(10 + 1e-9);
  });

  it('still keeps every part inside the limit', () => {
    addCustomPanel('shelf');
    const id = doc().customParts[0]!.id;
    const t = transformOf(id);
    commitTransforms({ [id]: { ...t, position: [50, -50, 0] } });
    expect(transformOf(id).position[0]).toBeLessThanOrEqual(10);
    expect(transformOf(id).position[1]).toBeGreaterThanOrEqual(-10);
  });
});

describe('BUG-032 — cabinets with fractional even shelf spacing', () => {
  it('does not freeze High 600 shelves into explicit positions', () => {
    addCabinetPreset('high-600');
    setCabinetDim(firstGroup().id, 'depth', 500);
    expect(firstGroup().cabinet?.shelfPositionsMm).toBeUndefined();
  });

  it('returns to the catalog preset when the size is set back', () => {
    addCabinetPreset('high-600');
    const id = firstGroup().id;
    setCabinetDim(id, 'width', 700);
    expect(firstGroup().cabinet?.presetId).toBeUndefined();

    setCabinetDim(firstGroup().id, 'width', 600);
    expect(firstGroup().cabinet?.presetId).toBe('high-600');
    expect(firstGroup().label).toBe('High 600');
  });

  it('redistributes shelves when the cabinet gets taller', () => {
    addCabinetPreset('high-600');
    setCabinetDim(firstGroup().id, 'height', 2600);
    const shelves = shelfPositions(firstGroup().cabinet!);
    // Evenly through the taller interior, not frozen near the old positions.
    expect(Math.max(...shelves)).toBeGreaterThan(2000);
  });

  it('still keeps a deliberately placed shelf', () => {
    addCabinetPreset('high-600');
    setCabinetShelfPositions(firstGroup().id, [300, 900, 1500, 2000]);
    setCabinetDim(firstGroup().id, 'depth', 500);
    expect(shelfPositions(firstGroup().cabinet!)).toEqual([300, 900, 1500, 2000]);
  });
});

describe('BUG-033 — a gizmo scale on one cabinet member', () => {
  it('demotes the cabinet the way a typed dimension edit does', () => {
    addCabinetPreset('base-600');
    const shelf = shelfIdsOf(firstGroup())[0]!;
    const t = transformOf(shelf);
    commitTransforms({ [shelf]: { ...t, scale: [1, 3, 1] } });
    expect(firstGroup().cabinet).toBeUndefined();
    expect(transformOf(shelf).scale).toEqual([1, 3, 1]);
  });

  it('leaves the cabinet alone for a move that changes no scale', () => {
    addCabinetPreset('base-600');
    const shelf = shelfIdsOf(firstGroup())[0]!;
    moveBy(shelf, { y: 0.05 });
    expect(firstGroup().cabinet).toBeDefined();
  });
});

describe('BUG-035 — a scale handle dragged through the pivot', () => {
  it('keeps the part at its size instead of collapsing it to 0.001×', () => {
    addCustomPanel('shelf');
    const id = doc().customParts[0]!.id;
    const t = transformOf(id);
    commitTransforms({ [id]: { ...t, scale: [-1, 1, 1] } });
    expect(transformOf(id).scale).toEqual([1, 1, 1]);
  });

  it('still clamps an extreme magnitude', () => {
    addCustomPanel('shelf');
    const id = doc().customParts[0]!.id;
    const t = transformOf(id);
    commitTransforms({ [id]: { ...t, scale: [1000, 0, 1] } as Transform });
    const scale = transformOf(id).scale;
    expect(scale[0]).toBe(100);
    expect(scale[1]).toBe(0.001);
  });
});

describe('BUG-037 — typing an overall witness on a rotated part', () => {
  it('resizes the world axis the label is drawn along', () => {
    addCustomPanel('door'); // 400 × 800 × 18
    const id = doc().customParts[0]!.id;
    useUiStore.getState().setSelection([id]);
    setRotationAxis(id, 'y', 90); // world size becomes 18 × 800 × 400

    setSelectedOverallDim('x', 600);

    const part = doc().customParts[0]!;
    // The local depth carries the world X extent after a quarter turn.
    expect(part.d).toBe(600);
    expect(part.w).toBe(400);
  });

  it('is unchanged for a part in its insertion orientation', () => {
    addCustomPanel('door');
    const id = doc().customParts[0]!.id;
    useUiStore.getState().setSelection([id]);
    setSelectedOverallDim('x', 600);
    expect(doc().customParts[0]!.w).toBe(600);
  });

  it('drives a rotated leg’s height from the axis it now stands on', () => {
    addCustomPanel('enhet-leg'); // 50 × 125 × 50, height on local h
    const id = doc().customParts[0]!.id;
    useUiStore.getState().setSelection([id]);
    setRotationAxis(id, 'z', 90); // the leg now lies along world X

    setSelectedOverallDim('x', 200);

    expect(doc().customParts[0]!.h).toBe(200);
  });
});

describe('BUG-034 — coincident interior positions', () => {
  it('collapses shelves typed onto the same centreline', () => {
    addCabinetPreset('high-600');
    setCabinetShelfPositions(firstGroup().id, [400, 400, 400, 400]);
    const cabinet = firstGroup().cabinet as CabinetConfig;
    expect(shelfPositions(cabinet)).toEqual([400]);
    expect(cabinet.shelfCount).toBe(1);
  });

  it('keeps shelves that are a board thickness apart', () => {
    addCabinetPreset('high-600');
    setCabinetShelfPositions(firstGroup().id, [400, 418, 436]);
    expect(shelfPositions(firstGroup().cabinet!)).toEqual([400, 418, 436]);
  });
});

describe('BUG-040 — Measure and the gizmos', () => {
  it('keeps the gizmo attached when Measure is switched on', () => {
    useUiStore.getState().setGizmoMode('scale');
    useUiStore.getState().toggleMeasure();
    expect(useUiStore.getState().measureActive).toBe(true);
    expect(useUiStore.getState().gizmoMode).toBe('scale');
  });

  it('keeps a measurement running when the gizmo tool changes', () => {
    useUiStore.getState().toggleMeasure();
    useUiStore.getState().addMeasurePoint({ x: 0, y: 0, z: 0 });
    useUiStore.getState().setGizmoMode('translate');
    expect(useUiStore.getState().measureActive).toBe(true);
    expect(useUiStore.getState().measurePoints).toHaveLength(1);
  });

  it('still clears points when Measure is toggled off and on', () => {
    useUiStore.getState().toggleMeasure();
    useUiStore.getState().addMeasurePoint({ x: 0, y: 0, z: 0 });
    useUiStore.getState().toggleMeasure();
    expect(useUiStore.getState().measurePoints).toEqual([]);
  });
});

describe('BUG-019 — duplicating more than one cabinet', () => {
  it('copies each selected cabinet as a configurable cabinet', () => {
    addCabinetPreset('base-600');
    addCabinetPreset('wall-600');
    const before = doc().groups;
    expect(before).toHaveLength(2);

    useUiStore.getState().setSelection(before.flatMap((group) => group.partIds));
    duplicateSelected();

    const after = doc().groups;
    expect(after).toHaveLength(4);
    // Previously both cabinets were cloned as loose parts with no config.
    expect(after.slice(2).every((group) => Boolean(group.cabinet))).toBe(true);
    expect(after.slice(2).map((group) => group.label)).toEqual(['Base 600', 'Wall 600']);
    expect(after[2]!.partIds).toHaveLength(before[0]!.partIds.length);
  });

  it('still clones a single cabinet as one group', () => {
    addCabinetPreset('base-600');
    useUiStore.getState().setSelection([...firstGroup().partIds]);
    duplicateSelected();
    expect(doc().groups).toHaveLength(2);
    expect(doc().groups[1]?.cabinet).toBeDefined();
  });

  it('still clones a lone carcass member as a loose part (BUG-022)', () => {
    addCabinetPreset('base-600');
    const side = firstGroup().partIds[0]!;
    useUiStore.getState().setSelection([side]);
    duplicateSelected();
    expect(doc().groups).toHaveLength(1);
    expect(doc().customParts).toHaveLength(7);
  });

  it('clones a group and a loose part together, each in its own shape', () => {
    addCabinetPreset('base-600');
    addCustomPanel('shelf');
    const loose = doc().customParts.at(-1)!.id;
    useUiStore.getState().setSelection([...doc().groups[0]!.partIds, loose]);
    duplicateSelected();
    expect(doc().groups).toHaveLength(2);
    expect(doc().groups[1]?.cabinet).toBeDefined();
    // 6 carcass + 1 loose, doubled.
    expect(doc().customParts).toHaveLength(14);
  });
});

describe('BUG-020 — demotion is announced', () => {
  it('explains why shelf controls disappeared after a per-part resize', () => {
    addCabinetPreset('base-600');
    const side = firstGroup().partIds[0]!;
    setCustomPartDim(side, 'h', 500);
    expect(firstGroup().cabinet).toBeUndefined();
    expect(useUiStore.getState().toast?.message).toContain('Restore cabinet');
  });

  it('says nothing when the cabinet survives the edit', () => {
    addCabinetPreset('base-600');
    useUiStore.setState({ toast: null });
    setCabinetDim(firstGroup().id, 'width', 700);
    expect(firstGroup().cabinet).toBeDefined();
    expect(useUiStore.getState().toast?.message ?? '').not.toContain('Restore cabinet');
  });

  it('explains a demotion caused by deleting part of a shelf row', () => {
    addCabinetPreset('base-600');
    addCabinetDivider(firstGroup().id, 300);
    deleteParts([shelfIdsOf(firstGroup())[0]!]);
    expect(useUiStore.getState().toast?.message).toContain('Restore cabinet');
  });
});

describe('BUG-012 — factory thicknesses are reachable', () => {
  it('accepts an 18 mm side and a 32 mm knob diameter on W', () => {
    addCustomPanel('flat');
    const id = doc().customParts[0]!.id;
    setCustomPartDim(id, 'w', 18);
    expect(doc().customParts[0]!.w).toBe(18);
    setCustomPartDim(id, 'w', 8);
    expect(doc().customParts[0]!.w).toBe(8);
  });

  it('keeps an 8 mm cabinet back through a save and reload', async () => {
    const { migrate, SCHEMA_VERSION } = await import('./persistence');
    addCustomPanel('back'); // 600 × 800 × 8
    const id = doc().customParts[0]!.id;
    setCustomPartDim(id, 'w', 8);
    const restored = migrate({
      schemaVersion: SCHEMA_VERSION,
      doc: { ...doc(), customParts: doc().customParts, transforms: doc().transforms },
    });
    expect(restored?.customParts[0]?.w).toBe(8);
  });
});

describe('IMP-016 — commit does less work', () => {
  it('still refuses to stack a no-op on the undo stack', () => {
    addCustomPanel('shelf');
    const id = doc().customParts[0]!.id;
    renamePart(id, 'Shelf'); // unchanged label — early-returns before commit
    const depthBefore = doc().customParts.length;
    setCustomPartDim(id, 'w', 800); // already 800
    expect(doc().customParts.length).toBe(depthBefore);
  });

  it('still reconciles the current version after an edit and an undo', async () => {
    const { undo } = await import('./history');
    addCustomPanel('shelf');
    saveVersion();
    const versionId = doc().currentVersionId;
    expect(versionId).not.toBeNull();

    setCustomPartDim(doc().customParts[0]!.id, 'w', 900);
    expect(doc().currentVersionId).toBeNull();

    undo();
    expect(doc().currentVersionId).toBe(versionId);
  });
});
