import { beforeEach, describe, expect, it } from 'vitest';
import type { Transform } from '@/domain/types';
import {
  addCabinetPreset,
  addCustomPanel,
  commitTransforms,
  duplicateSelected,
  newDocument,
  renameDocument,
  resizeCabinetFromGizmo,
  resetTransforms,
  saveVersion,
  setCabinetDim,
  setCustomPartDim,
  setGroupPositionAxis,
  setHardwareDiameter,
} from './actions';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { canUndo, clearHistory, redo, undo } from './history';
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
      displayUnit: 'mm',
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

  it('resizes a cabinet parametrically without changing panel thicknesses', () => {
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    setCabinetDim(group.id, 'width', 900);

    const state = useDocumentStore.getState();
    const resized = state.groups[0]!;
    const members = resized.partIds.map((id) => state.customParts.find((part) => part.id === id)!);
    expect(resized.cabinet?.width).toBe(900);
    expect(resized.label).toBe('Base 900');
    expect(members.slice(0, 2).map((part) => part.w)).toEqual([18, 18]);
    expect(members[2]).toMatchObject({ w: 864, h: 18, d: 552 });
    expect(members[4]).toMatchObject({ w: 864, h: 684, d: 8 });
    expect(state.transforms[resized.partIds[0]!]!.position[0]).toBeCloseTo(-0.441, 8);
    expect(state.transforms[resized.partIds[1]!]!.position[0]).toBeCloseTo(0.441, 8);
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
    expect(resized.cabinet).toMatchObject({ width: 900, height: 900, depth: 672 });
    expect(members[0]).toMatchObject({ w: 18, h: 900, d: 672 });
    expect(members[2]).toMatchObject({ w: 864, h: 18, d: 664 });
    expect(members[4]).toMatchObject({ w: 864, h: 864, d: 8 });
    expect(resized.partIds.every((id) => state.transforms[id]!.scale.every((value) => value === 1)))
      .toBe(true);
    pivotAfter.forEach((value, axis) => expect(value).toBeCloseTo(pivotBefore[axis]!, 8));

    expect(undo()).toBe(true);
    state = useDocumentStore.getState();
    expect(state.groups[0]?.cabinet).toMatchObject({ width: 600, height: 720, depth: 560 });
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
    expect(state.transforms[group.partIds[0]!]!.position[1]).toBeCloseTo(0.36, 8);
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
});
