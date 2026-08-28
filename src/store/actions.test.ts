import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectionPositionMetres } from '@/domain/parts';
import type { Transform } from '@/domain/types';
import * as download from '@/ui/download';
import {
  addCabinetDivider,
  addCabinetPreset,
  addCabinetShelf,
  addCustomPanel,
  commitTransforms,
  distributeCabinetDividers,
  distributeCabinetShelves,
  downloadVersion,
  deleteParts,
  duplicateSelected,
  newDocument,
  nudgeSelected,
  openFile,
  removeCabinetDivider,
  removeCabinetShelf,
  renameDocument,
  renamePart,
  resizeCabinetFromGizmo,
  resetTransforms,
  restoreSelectedCabinet,
  saveToFile,
  saveVersion,
  setCabinetDim,
  setCabinetDividerPositions,
  setCabinetShelfPositions,
  setCustomPartDim,
  setGroupPositionAxis,
  setGroupRotationAxis,
  setHardwareDiameter,
  setPositionAxis,
  setSelectionPositionAxis,
  setSelectionRotationAxis,
  selectGroup,
  titleFromFilename,
  toggleGroupSelection,
} from './actions';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { canUndo, clearHistory, redo, undo } from './history';
import { SCHEMA_VERSION } from './persistence';
import { useUiStore } from './uiStore';

describe('library construction actions', () => {
  beforeEach(() => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({
      selectedPartIds: [],
      gizmoMode: 'select',
      viewMode: 'model',
      historyOpen: false,
      measureActive: false,
      displayUnit: 'cm',
      gridSizeM: 4,
      toast: null,
    });
    clearHistory();
  });

  it('adds world-aligned round purchased hardware', () => {
    addCustomPanel('knob');
    const part = useDocumentStore.getState().customParts[0]!;
    const transform = useDocumentStore.getState().transforms[part.id]!;
    expect(part).toMatchObject({
      category: 'hardware',
      w: 32,
      h: 32,
      d: 25,
      grainAxis: null,
      edgeBanding: [],
    });
    expect(transform.quaternion).toEqual([0, 0, 0, 1]);

    setHardwareDiameter(part.id, 40);
    expect(useDocumentStore.getState().customParts[0]).toMatchObject({ w: 40, h: 40, d: 25 });
  });

  it('adds ENERYDA as a bow-pull handle', () => {
    addCustomPanel('eneryda');
    expect(useDocumentStore.getState().customParts[0]).toMatchObject({
      label: 'ENERYDA',
      category: 'hardware',
      shape: 'eneryda',
      w: 112,
      h: 17,
      d: 30,
      thicknessAxis: null,
      grainAxis: null,
    });
  });

  it('adds BAGGANÄS with its disc-knob profile', () => {
    addCustomPanel('bagganas');
    expect(useDocumentStore.getState().customParts[0]).toMatchObject({
      label: 'BAGGANÄS',
      category: 'hardware',
      shape: 'bagganas',
      w: 21,
      h: 21,
      d: 24,
    });
  });

  it('adds an ENHET cabinet leg standing on the floor', () => {
    addCustomPanel('enhet-leg');
    const part = useDocumentStore.getState().customParts[0]!;
    const transform = useDocumentStore.getState().transforms[part.id]!;
    expect(part).toMatchObject({
      label: 'ENHET',
      category: 'hardware',
      shape: 'enhet-leg',
      w: 50,
      h: 125,
      d: 50,
      thicknessAxis: null,
      grainAxis: null,
    });
    // Centre sits at half height so the foot rests on the grid.
    expect(transform.position[1]).toBeCloseTo(0.0625, 8);

    setHardwareDiameter(part.id, 60);
    expect(useDocumentStore.getState().customParts[0]).toMatchObject({ w: 60, h: 125, d: 60 });
  });

  it('hangs wall cabinets above the floor so their top lines up with a tall unit', () => {
    addCabinetPreset('wall-600');
    addCabinetPreset('base-600');
    const state = useDocumentStore.getState();
    const wall = state.groups[0]!;
    const base = state.groups[1]!;
    // Left side centre is half the 800 mm carcass above a 1400 mm underside.
    expect(state.transforms[wall.partIds[0]!]!.position[1]).toBeCloseTo(1.8, 8);
    expect(state.transforms[base.partIds[0]!]!.position[1]).toBeCloseTo(0.4, 8);
  });

  it('keeps a wall cabinet at hanging height when dropped onto the floor', () => {
    addCabinetPreset('wall-600', {
      point: { x: 0.4, y: 0, z: -0.2 },
      normal: { x: 0, y: 1, z: 0 },
    });
    const state = useDocumentStore.getState();
    const side = state.transforms[state.groups[0]!.partIds[0]!]!;
    expect(side.position[0]).toBeCloseTo(0.4 - 0.291, 8);
    expect(side.position[1]).toBeCloseTo(1.8, 8);
    expect(side.position[2]).toBeCloseTo(-0.2, 8);
  });

  it('resizes a cabinet parametrically without changing panel thicknesses', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    setCabinetDim(group.id, 'width', 800);

    const state = useDocumentStore.getState();
    const resized = state.groups[0]!;
    const members = resized.partIds.map((id) => state.customParts.find((part) => part.id === id)!);
    expect(resized.cabinet?.width).toBe(800);
    expect(resized.label).toBe('Base 800');
    expect(members.slice(0, 2).map((part) => part.w)).toEqual([18, 18]);
    expect(members[2]).toMatchObject({ w: 764, h: 18, d: 592 });
    expect(members[4]).toMatchObject({ w: 764, h: 764, d: 8 });
    expect(state.transforms[resized.partIds[0]!]!.position[0]).toBeCloseTo(-0.391, 8);
    expect(state.transforms[resized.partIds[1]!]!.position[0]).toBeCloseTo(0.391, 8);
  });

  it('turns a full-cabinet gizmo scale into one parametric resize around the shared pivot', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    const pivotBefore = [0, 1, 2].map((axis) =>
      group.partIds.reduce(
        (sum, id) => sum + useDocumentStore.getState().transforms[id]!.position[axis]!,
        0,
      ) / group.partIds.length,
    );

    expect(resizeCabinetFromGizmo(group.partIds, [1.5, 1.25, 1.2])).toBe(true);

    let state = useDocumentStore.getState();
    const resized = state.groups[0]!;
    const members = resized.partIds.map((id) => state.customParts.find((part) => part.id === id)!);
    const pivotAfter = [0, 1, 2].map((axis) =>
      resized.partIds.reduce((sum, id) => sum + state.transforms[id]!.position[axis]!, 0) /
      resized.partIds.length,
    );
    expect(resized.cabinet).toMatchObject({ width: 900, height: 1000, depth: 720 });
    expect(members[0]).toMatchObject({ w: 18, h: 1000, d: 720 });
    expect(members[2]).toMatchObject({ w: 864, h: 18, d: 712 });
    expect(members[4]).toMatchObject({ w: 864, h: 964, d: 8 });
    expect(resized.partIds.every((id) => state.transforms[id]!.scale.every((value) => value === 1)))
      .toBe(true);
    pivotAfter.forEach((value, axis) => expect(value).toBeCloseTo(pivotBefore[axis]!, 8));

    expect(undo()).toBe(true);
    state = useDocumentStore.getState();
    expect(state.groups[0]?.cabinet).toMatchObject({ width: 600, height: 800, depth: 600 });
  });

  it('resets a rotated cabinet as one coherent carcass', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    const quarterTurn = [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const;
    const changed: Record<string, Transform> = {};
    group.partIds.forEach((id) => {
      const current = useDocumentStore.getState().transforms[id]!;
      changed[id] = {
        ...current,
        position: [current.position[2], current.position[1], -current.position[0]],
        quaternion: [...quarterTurn],
      };
    });
    commitTransforms(changed);

    resetTransforms(group.partIds);
    const state = useDocumentStore.getState();
    expect(state.transforms[group.partIds[0]!]!.position[0]).toBeCloseTo(-0.291, 8);
    expect(state.transforms[group.partIds[0]!]!.position[1]).toBeCloseTo(0.4, 8);
    expect(state.transforms[group.partIds[0]!]!.position[2]).toBeCloseTo(0, 8);
    expect(state.transforms[group.partIds[1]!]!.position[0]).toBeCloseTo(0.291, 8);
    expect(group.partIds.every((id) =>
      state.transforms[id]!.quaternion.every((value, index) => value === [0, 0, 0, 1][index]),
    )).toBe(true);
  });

  it('turns a cabinet into a regular group after one member is structurally edited', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    setCustomPartDim(group.partIds[0]!, 'h', 700);
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeUndefined();
  });

  it('restores cabinet controls on a demoted carcass without rebuilding it', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    const leftId = group.partIds[0]!;
    setCustomPartDim(leftId, 'h', 700);
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeUndefined();

    restoreSelectedCabinet();

    const state = useDocumentStore.getState();
    expect(state.groups[0]?.cabinet).toMatchObject({
      width: 600,
      height: 800,
      depth: 600,
      shelfCount: 1,
    });
    expect(state.customParts.find((part) => part.id === leftId)?.h).toBe(700);
    expect(useUiStore.getState().toast?.message).toBe('Cabinet controls restored');
  });

  it('nudges the gizmo selection and leaves the first of two units fixed', () => {
    addCustomPanel('shelf');
    addCustomPanel('shelf');
    const [first, second] = useDocumentStore.getState().customParts.map((part) => part.id);
    const firstX = useDocumentStore.getState().transforms[first!]!.position[0];
    const secondX = useDocumentStore.getState().transforms[second!]!.position[0];
    useUiStore.setState({ selectedPartIds: [first!, second!] });

    nudgeSelected({ x: 10, y: 0, z: 0 });

    const state = useDocumentStore.getState();
    expect(state.transforms[first!]!.position[0]).toBeCloseTo(firstX, 8);
    expect(state.transforms[second!]!.position[0]).toBeCloseTo(secondX + 0.01, 8);
  });

  it('restores a cabinet after a shelf thickness edit that hid Add Shelf', () => {
    addCabinetPreset('base-600');
    const shelfId = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Shelf'),
    )!.id;
    setCustomPartDim(shelfId, 'h', 700);
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeUndefined();

    restoreSelectedCabinet();

    expect(useDocumentStore.getState().groups[0]?.cabinet).toMatchObject({
      width: 600,
      height: 800,
      depth: 600,
      shelfCount: 1,
    });
    expect(useDocumentStore.getState().customParts.find((part) => part.id === shelfId)?.h).toBe(700);
  });

  it('keeps cabinet config after a member is moved, rotated or renamed', () => {
    addCabinetPreset('base-400');
    const group = useDocumentStore.getState().groups[0]!;
    const id = group.partIds[0]!;
    const current = useDocumentStore.getState().transforms[id]!;

    setPositionAxis(id, 'x', 1500);
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeDefined();

    commitTransforms({
      [id]: { ...current, position: [1.5, current.position[1], current.position[2]] },
    });
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeDefined();

    renamePart(id, 'Moved side');
    expect(useDocumentStore.getState().groups[0]?.cabinet).toMatchObject({
      width: 400,
      height: 800,
      depth: 600,
    });
  });

  it('duplicates a cabinet as an independent, undoable group', () => {
    addCabinetPreset('base-600');
    const source = useDocumentStore.getState().groups[0]!;
    const sourceAnchor = useDocumentStore.getState().transforms[source.partIds[0]!]!;

    duplicateSelected();

    let state = useDocumentStore.getState();
    const copy = state.groups[1]!;
    expect(state.customParts).toHaveLength(12);
    expect(state.groups).toHaveLength(2);
    expect(copy.id).not.toBe(source.id);
    expect(copy.label).toBe(source.label);
    expect(copy.partIds).toHaveLength(source.partIds.length);
    expect(copy.partIds).not.toEqual(source.partIds);
    expect(copy.cabinet).toEqual(source.cabinet);
    expect(state.transforms[copy.partIds[0]!]!.position).toEqual([
      sourceAnchor.position[0] + 0.08,
      sourceAnchor.position[1],
      sourceAnchor.position[2] + 0.08,
    ]);
    expect(useUiStore.getState().selectedPartIds).toEqual(copy.partIds);

    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().groups).toHaveLength(1);
    expect(useDocumentStore.getState().customParts).toHaveLength(6);
    expect(redo()).toBe(true);
    expect(useDocumentStore.getState().groups).toHaveLength(2);

    // Parametric changes to the copy must not rebuild the original cabinet.
    setCabinetDim(copy.id, 'width', 900);
    state = useDocumentStore.getState();
    expect(state.groups.find((group) => group.id === source.id)?.cabinet?.width).toBe(600);
    expect(state.groups.find((group) => group.id === copy.id)?.cabinet?.width).toBe(900);
  });

  it('duplicates only the selected cabinet member, not the whole carcass', () => {
    addCabinetPreset('base-600');
    const source = useDocumentStore.getState().groups[0]!;
    const memberId = source.partIds[0]!;
    useUiStore.getState().setSelection([memberId]);

    duplicateSelected();

    const state = useDocumentStore.getState();
    expect(state.groups).toHaveLength(1);
    expect(state.customParts).toHaveLength(7);
    expect(state.groups[0]?.cabinet).toEqual(source.cabinet);
    expect(useUiStore.getState().selectedPartIds).toHaveLength(1);
    expect(useUiStore.getState().selectedPartIds[0]).not.toBe(memberId);
  });

  it('places a second Add Panel click on the next free centreline', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);
    addCabinetDivider(group.id, 300);
    expect(useDocumentStore.getState().groups[0]?.cabinet?.dividerPositionsMm).toEqual([300, 400]);
    expect(useUiStore.getState().toast?.message).toBe('Panel added at 400 mm');
  });

  it('duplicates an interior panel like Add Panel, not as a loose offset copy', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);
    const panelId = useDocumentStore.getState().groups[0]!.partIds.at(-1)!;
    useUiStore.getState().setSelection([panelId]);

    duplicateSelected();

    const state = useDocumentStore.getState();
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]?.cabinet?.dividerPositionsMm).toEqual([300, 400]);
    expect(state.customParts).toHaveLength(10);
    expect(useUiStore.getState().selectedPartIds).toHaveLength(1);
    expect(useUiStore.getState().selectedPartIds[0]).not.toBe(panelId);
    expect(useUiStore.getState().toast?.message).toBe('Panel added at 400 mm');
  });

  it('keeps an interior panel id and selection when adding another panel', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);
    const panel = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Panel 1'),
    )!;
    useUiStore.getState().setSelection([panel.id]);

    addCabinetDivider(group.id, 300);

    const next = useDocumentStore.getState();
    const still = next.customParts.find((part) => part.id === panel.id);
    expect(still?.label).toContain('Panel');
    expect(still?.thicknessAxis).toBe('w');
    expect(next.groups[0]?.cabinet?.dividerPositionsMm).toEqual([300, 400]);
    expect(useUiStore.getState().selectedPartIds).toEqual([panel.id]);
  });

  it('keeps a nudged panel offset when Add Shelf rebuilds the carcass', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);
    const panel = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Panel 1'),
    )!;
    useUiStore.getState().setSelection([panel.id]);
    nudgeSelected({ x: 40, y: 0, z: 0 });

    addCabinetShelf(group.id, 250);

    const next = useDocumentStore.getState();
    expect(next.groups[0]?.cabinet?.dividerPositionsMm).toEqual([340]);
    expect(Math.round((next.transforms[panel.id]!.position[0] ?? 0) * 1000)).toBe(40);
    expect(next.customParts.find((part) => part.id === panel.id)?.label).toContain('Panel');
  });

  it('keeps an interior panel id and selection when adding another panel', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);
    const panel = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Panel 1'),
    )!;
    useUiStore.getState().setSelection([panel.id]);

    addCabinetDivider(group.id, 300);

    const state = useDocumentStore.getState();
    const still = state.customParts.find((part) => part.id === panel.id);
    expect(still?.label).toContain('Panel');
    expect(still?.thicknessAxis).toBe('w');
    expect(state.groups[0]?.cabinet?.dividerPositionsMm).toEqual([300, 400]);
    expect(useUiStore.getState().selectedPartIds).toEqual([panel.id]);
  });

  it('keeps a nudged panel offset when Add Shelf rebuilds the carcass', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);
    const panel = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Panel 1'),
    )!;
    useUiStore.getState().setSelection([panel.id]);
    nudgeSelected({ x: 40, y: 0, z: 0 });

    addCabinetShelf(group.id, 250);

    const state = useDocumentStore.getState();
    expect(state.groups[0]?.cabinet?.dividerPositionsMm).toEqual([340]);
    expect(Math.round((state.transforms[panel.id]!.position[0] ?? 0) * 1000)).toBe(40);
    expect(state.customParts.find((part) => part.id === panel.id)?.label).toContain('Panel');
  });

  it('adds, moves and removes cabinet shelves by explicit position', () => {
    addCabinetPreset('base-600');
    let group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(6);

    // One shelf at 30 cm joins the preset's existing centred shelf.
    addCabinetShelf(group.id, 300);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(7);
    expect(group.cabinet?.shelfPositionsMm).toEqual([300, 400]);
    expect(group.cabinet?.presetId).toBeUndefined();

    // Every member, including the new shelf, has a transform and a part.
    const state = useDocumentStore.getState();
    for (const id of group.partIds) {
      expect(state.transforms[id]).toBeDefined();
      expect(state.customParts.find((part) => part.id === id)).toBeDefined();
    }
    const shelfIds = group.partIds.slice(5);
    const shelfYs = shelfIds.map((id) => Math.round(state.transforms[id]!.position[1] * 1000));
    expect(shelfYs).toEqual([300, 400]);

    // Moving a shelf keeps the count; removing one shrinks the group.
    setCabinetShelfPositions(group.id, [250, 500]);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.cabinet?.shelfPositionsMm).toEqual([250, 500]);
    expect(group.partIds).toHaveLength(7);

    removeCabinetShelf(group.id, 0);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(6);
    expect(group.cabinet?.shelfPositionsMm).toEqual([500]);

    // Each shelf edit is one undo step.
    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().groups[0]!.partIds).toHaveLength(7);
    expect(undo()).toBe(true);
    expect(undo()).toBe(true);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(6);
    expect(group.cabinet?.shelfPositionsMm).toBeUndefined();
    expect(group.cabinet?.presetId).toBe('base-600');
  });

  it('distributes shelves by spacing and drops the ones that do not fit', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;

    distributeCabinetShelves(group.id, 4, 200);

    const next = useDocumentStore.getState().groups[0]!;
    // 800 high: shelves at 218/418/618; the fourth would leave the interior.
    expect(next.cabinet?.shelfPositionsMm).toEqual([218, 418, 618]);
    expect(next.partIds).toHaveLength(8);
    expect(useUiStore.getState().toast?.message).toBe('Only 3 of 4 shelves fit');
  });

  it('adds, moves and removes cabinet panels by explicit position', () => {
    addCabinetPreset('base-600');
    let group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(6);

    addCabinetDivider(group.id, 300);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.cabinet?.dividerPositionsMm).toEqual([300]);
    expect(group.cabinet?.presetId).toBeUndefined();
    // One centred panel splits the preset shelf into two bay shelves.
    expect(group.partIds).toHaveLength(8);

    const state = useDocumentStore.getState();
    for (const id of group.partIds) {
      expect(state.transforms[id]).toBeDefined();
      expect(state.customParts.find((part) => part.id === id)).toBeDefined();
    }
    const panel = state.customParts.find((part) => part.label.includes('Panel 1'));
    expect(panel).toMatchObject({ w: 18, h: 764, d: 592 });
    expect(Math.round((state.transforms[panel!.id]!.position[0] ?? 0) * 1000)).toBe(0);

    setCabinetDividerPositions(group.id, [200, 400]);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.cabinet?.dividerPositionsMm).toEqual([200, 400]);
    expect(group.partIds).toHaveLength(10);

    removeCabinetDivider(group.id, 0);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(8);
    expect(group.cabinet?.dividerPositionsMm).toEqual([400]);

    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().groups[0]!.partIds).toHaveLength(10);
    expect(undo()).toBe(true);
    expect(undo()).toBe(true);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(6);
    expect(group.cabinet?.dividerPositionsMm).toBeUndefined();
    expect(group.cabinet?.presetId).toBe('base-600');
  });

  it('distributes panels by spacing and drops the ones that do not fit', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;

    distributeCabinetDividers(group.id, 4, 200);

    const next = useDocumentStore.getState().groups[0]!;
    // 600 wide: panels at 218/418; the third (618) would leave the interior.
    expect(next.cabinet?.dividerPositionsMm).toEqual([218, 418]);
    expect(next.partIds).toHaveLength(10);
    expect(useUiStore.getState().toast?.message).toBe('Only 2 of 4 panels fit');
  });

  it('keeps cabinet config when a generated shelf or interior panel is deleted', () => {
    addCabinetPreset('base-600');
    let group = useDocumentStore.getState().groups[0]!;
    const shelfId = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Shelf'),
    )!.id;

    deleteParts([shelfId]);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.cabinet).toBeDefined();
    expect(group.cabinet?.shelfCount).toBe(0);
    expect(group.partIds).toHaveLength(5);

    addCabinetDivider(group.id, 300);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.partIds).toHaveLength(6);
    const panelId = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Panel 1'),
    )!.id;
    deleteParts([panelId]);
    group = useDocumentStore.getState().groups[0]!;
    expect(group.cabinet).toBeDefined();
    expect(group.cabinet?.dividerPositionsMm).toBeUndefined();
    expect(group.partIds).toHaveLength(5);

    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().groups[0]!.cabinet?.dividerPositionsMm).toEqual([300]);
  });

  it('demotes a cabinet when a carcass panel is deleted', () => {
    addCabinetPreset('base-600');
    const leftId = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Left Side'),
    )!.id;
    deleteParts([leftId]);
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeUndefined();
  });

  it('starts a clean document without resetting workspace preferences', () => {
    addCustomPanel('shelf');
    renameDocument('Kitchen');
    saveVersion();
    useUiStore.setState({
      displayUnit: 'cm',
      gridSizeM: 6,
      viewMode: 'cutlist',
      historyOpen: true,
      measureActive: true,
    });
    expect(canUndo()).toBe(true);

    newDocument();

    const state = useDocumentStore.getState();
    expect(state.customParts).toEqual([]);
    expect(state.groups).toEqual([]);
    expect(state.docTitle).toBe('Untitled Design');
    expect(state.versions).toEqual([]);
    expect(state.currentVersionId).toBeNull();
    expect(canUndo()).toBe(false);
    expect(useUiStore.getState()).toMatchObject({
      selectedPartIds: [],
      displayUnit: 'cm',
      gridSizeM: 6,
      viewMode: 'model',
      leftTab: 'assembly',
      rightTab: 'properties',
      historyOpen: false,
      measureActive: false,
    });
  });

  it('moves a group pivot without changing member spacing or cabinet metadata', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    const before = group.partIds.map((id) => useDocumentStore.getState().transforms[id]!.position[0]);

    setGroupPositionAxis(group.id, 'x', 500);

    const state = useDocumentStore.getState();
    const after = group.partIds.map((id) => state.transforms[id]!.position[0]);
    expect(after.reduce((sum, value) => sum + value, 0) / after.length).toBeCloseTo(0.5, 8);
    after.forEach((value, index) => {
      expect(value - after[0]!).toBeCloseTo(before[index]! - before[0]!, 8);
    });
    expect(state.groups[0]?.cabinet?.width).toBe(600);
  });

  it('sets group Y from the underside so a floor cabinet starts at 0', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    const ids = group.partIds;
    const snapshot = () => useDocumentStore.getState();
    expect(
      selectionPositionMetres(snapshot().customParts, snapshot().transforms, ids)[1],
    ).toBeCloseTo(0, 6);

    setGroupPositionAxis(group.id, 'y', 100);

    expect(
      selectionPositionMetres(snapshot().customParts, snapshot().transforms, ids)[1],
    ).toBeCloseTo(0.1, 6);
    expect(snapshot().groups[0]?.cabinet?.width).toBe(600);
  });

  it('rotates a group around its shared pivot without changing cabinet metadata', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    const before = group.partIds.map((id) => useDocumentStore.getState().transforms[id]!.position);
    const pivot = [0, 1, 2].map(
      (index) => before.reduce((sum, position) => sum + position[index]!, 0) / before.length,
    );

    setGroupRotationAxis(group.id, 'y', 90);

    const state = useDocumentStore.getState();
    const after = group.partIds.map((id) => state.transforms[id]!.position);
    const nextPivot = [0, 1, 2].map(
      (index) => after.reduce((sum, position) => sum + position[index]!, 0) / after.length,
    );
    nextPivot.forEach((value, index) => expect(value).toBeCloseTo(pivot[index]!, 8));
    after.forEach((position, memberIndex) => {
      const dx = before[memberIndex]![0]! - pivot[0]!;
      const dz = before[memberIndex]![2]! - pivot[2]!;
      expect(position[0]! - nextPivot[0]!).toBeCloseTo(dz, 8);
      expect(position[1]).toBeCloseTo(before[memberIndex]![1]!, 8);
      expect(position[2]! - nextPivot[2]!).toBeCloseTo(-dx, 8);
    });
    const quaternion = state.transforms[group.partIds[0]!]!.quaternion;
    expect(quaternion[0]).toBeCloseTo(0, 8);
    expect(quaternion[1]).toBeCloseTo(Math.SQRT1_2, 8);
    expect(quaternion[2]).toBeCloseTo(0, 8);
    expect(quaternion[3]).toBeCloseTo(Math.SQRT1_2, 8);
    expect(state.groups[0]?.cabinet?.width).toBe(600);
  });

  it('moves several groups together from the shared selection pivot', () => {
    addCabinetPreset('base-600');
    addCabinetPreset('base-600');
    const ids = useDocumentStore.getState().customParts.map((part) => part.id);
    const before = ids.map((id) => useDocumentStore.getState().transforms[id]!.position[0]);
    const pivot = before.reduce((sum, value) => sum + value, 0) / before.length;

    setSelectionPositionAxis(ids, 'x', 1000);

    const after = ids.map((id) => useDocumentStore.getState().transforms[id]!.position[0]);
    expect(after.reduce((sum, value) => sum + value, 0) / after.length).toBeCloseTo(1, 8);
    after.forEach((value, index) => {
      expect(value - after[0]!).toBeCloseTo(before[index]! - before[0]!, 8);
    });
    expect(after[0]! - before[0]!).toBeCloseTo(1 - pivot, 8);
    expect(useDocumentStore.getState().groups.map((group) => group.cabinet?.width)).toEqual([600, 600]);
  });

  it('rotates several groups together around the shared selection pivot', () => {
    addCabinetPreset('base-600');
    addCabinetPreset('base-600');
    const ids = useDocumentStore.getState().customParts.map((part) => part.id);
    const before = ids.map((id) => useDocumentStore.getState().transforms[id]!.position);
    const pivot = [0, 1, 2].map(
      (index) => before.reduce((sum, position) => sum + position[index]!, 0) / before.length,
    );

    setSelectionRotationAxis(ids, 'y', 90);

    const after = ids.map((id) => useDocumentStore.getState().transforms[id]!.position);
    const nextPivot = [0, 1, 2].map(
      (index) => after.reduce((sum, position) => sum + position[index]!, 0) / after.length,
    );
    nextPivot.forEach((value, index) => expect(value).toBeCloseTo(pivot[index]!, 8));
    after.forEach((position, memberIndex) => {
      const dx = before[memberIndex]![0]! - pivot[0]!;
      const dz = before[memberIndex]![2]! - pivot[2]!;
      expect(position[0]! - nextPivot[0]!).toBeCloseTo(dz, 8);
      expect(position[1]).toBeCloseTo(before[memberIndex]![1]!, 8);
      expect(position[2]! - nextPivot[2]!).toBeCloseTo(-dx, 8);
    });
    expect(useDocumentStore.getState().groups.map((group) => group.cabinet?.width)).toEqual([600, 600]);
  });

  it('toggles a group in or out of a multi-group selection', () => {
    addCabinetPreset('base-600');
    addCabinetPreset('base-600');
    const [first, second] = useDocumentStore.getState().groups;
    selectGroup(first!.id);
    toggleGroupSelection(second!.id);
    expect(useUiStore.getState().selectedPartIds).toEqual([...first!.partIds, ...second!.partIds]);
    toggleGroupSelection(first!.id);
    expect(useUiStore.getState().selectedPartIds).toEqual(second!.partIds);
  });
});

describe('save and open title', () => {
  beforeEach(() => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({ selectedPartIds: [], toast: null });
    clearHistory();
  });

  it('derives a document title from common Forma filenames', () => {
    expect(titleFromFilename('Kitchen Remodel.forma.json')).toBe('Kitchen Remodel');
    expect(titleFromFilename('/tmp/From Disk.json')).toBe('From Disk');
    expect(titleFromFilename('bad:name*.forma.json')).toBe('bad-name-');
  });

  it('keeps a Save Version checkpoint in the document without downloading', () => {
    renameDocument('Kitchen');
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    saveVersion();

    const state = useDocumentStore.getState();
    expect(state.versions).toHaveLength(1);
    expect(state.versions[0]?.label).toBe('Version 1');
    expect(state.currentVersionId).toBe(state.versions[0]?.id);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(useUiStore.getState().toast?.message).toBe('Saved Version 1');
    downloadBlob.mockRestore();
  });

  it('downloads a named version file from Version History', () => {
    renameDocument('Kitchen');
    saveVersion();
    const id = useDocumentStore.getState().versions[0]!.id;
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    downloadVersion(id);

    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Kitchen - Version 1.forma.json');
    expect(useUiStore.getState().toast?.message).toBe('Downloaded Version 1');
    downloadBlob.mockRestore();
  });

  it('downloads under the current title without a native save picker', async () => {
    renameDocument('Dining Table');
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    const ok = await saveToFile();

    expect(ok).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().docTitle).toBe('Dining Table');
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Dining Table.forma.json');
    expect(useUiStore.getState().toast?.message).toBe('Saved Dining Table');
    downloadBlob.mockRestore();
    vi.unstubAllGlobals();
  });

  it('toasts when the download itself throws', async () => {
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => {
      throw new Error('blocked');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const ok = await saveToFile();

    expect(ok).toBe(false);
    expect(useUiStore.getState().toast?.message).toBe('Could not save the file');
    downloadBlob.mockRestore();
    consoleError.mockRestore();
  });

  it('sets the document title from the opened file name', async () => {
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      doc: { ...createDefaultDocument(), docTitle: 'Inside JSON' },
    };
    const file = new File([JSON.stringify(envelope)], 'From Disk.forma.json', {
      type: 'application/json',
    });

    await openFile(file);

    expect(useDocumentStore.getState().docTitle).toBe('From Disk');
  });

  it('toasts a specific message when the opened file is empty', async () => {
    const file = new File([''], 'Broken Save.forma.json', { type: 'application/json' });
    await openFile(file);
    expect(useUiStore.getState().toast?.message).toBe(
      'That file is empty. It may not have finished saving.',
    );
  });

  it('still refuses a file that is not a Forma document', async () => {
    const file = new File([JSON.stringify({ hello: 'world' })], 'notes.json', {
      type: 'application/json',
    });
    await openFile(file);
    expect(useUiStore.getState().toast?.message).toBe(
      'Not a Forma file, or an unsupported version',
    );
  });
});
