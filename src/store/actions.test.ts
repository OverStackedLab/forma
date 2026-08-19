import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  duplicateSelected,
  newDocument,
  openFile,
  removeCabinetDivider,
  removeCabinetShelf,
  renameDocument,
  renamePart,
  resizeCabinetFromGizmo,
  resetTransforms,
  saveToFile,
  saveVersion,
  setCabinetDim,
  setCabinetDividerPositions,
  setCabinetShelfPositions,
  setCustomPartDim,
  setGroupPositionAxis,
  setHardwareDiameter,
  setPositionAxis,
  titleFromFilename,
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

  it('downloads under the current title without any prompt when the picker is unavailable', async () => {
    renameDocument('Dining Table');
    vi.stubGlobal('window', {});
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    await saveToFile();

    expect(prompt).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().docTitle).toBe('Dining Table');
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Dining Table.forma.json');
    downloadBlob.mockRestore();
    vi.unstubAllGlobals();
  });

  it('updates the document title from the File System Access save picker', async () => {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const createWritable = vi.fn(async () => ({ write, close }));
    const showSaveFilePicker = vi.fn(async () => ({
      name: 'Sideboard.forma.json',
      createWritable,
    }));
    vi.stubGlobal('window', { showSaveFilePicker });
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    await saveToFile();

    expect(showSaveFilePicker).toHaveBeenCalled();
    expect(useDocumentStore.getState().docTitle).toBe('Sideboard');
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(downloadBlob).not.toHaveBeenCalled();
    downloadBlob.mockRestore();
    vi.unstubAllGlobals();
  });

  it('leaves the title alone when the save picker is dismissed', async () => {
    renameDocument('Keep Me');
    const showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('The user aborted a request.', 'AbortError');
    });
    vi.stubGlobal('window', { showSaveFilePicker });
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    await saveToFile();

    expect(useDocumentStore.getState().docTitle).toBe('Keep Me');
    expect(prompt).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    downloadBlob.mockRestore();
    vi.unstubAllGlobals();
  });

  it('never falls back to a download once the picker has been shown', async () => {
    const createWritable = vi.fn(async () => {
      throw new DOMException('Write access denied.', 'NotAllowedError');
    });
    const showSaveFilePicker = vi.fn(async () => ({
      name: 'Sideboard.forma.json',
      createWritable,
    }));
    vi.stubGlobal('window', { showSaveFilePicker });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    await saveToFile();

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(useUiStore.getState().toast?.message).toBe('Could not save the file');
    downloadBlob.mockRestore();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it('ignores a second save while the picker is already open', async () => {
    let resolvePicker: (handle: { name: string; createWritable: () => Promise<unknown> }) => void =
      () => undefined;
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const showSaveFilePicker = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePicker = resolve;
        }),
    );
    vi.stubGlobal('window', { showSaveFilePicker });
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);

    const first = saveToFile();
    const second = saveToFile();
    resolvePicker({ name: 'Sideboard.forma.json', createWritable: async () => ({ write, close }) });
    await Promise.all([first, second]);

    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(downloadBlob).not.toHaveBeenCalled();
    downloadBlob.mockRestore();
    vi.unstubAllGlobals();
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
});
