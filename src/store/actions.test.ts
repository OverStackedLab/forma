import { beforeEach, describe, expect, it } from 'vitest';
import type { Transform } from '@/domain/types';
import {
  addCabinetPreset,
  addCustomPanel,
  commitTransforms,
  resetTransforms,
  setCabinetDim,
  setCustomPartDim,
  setHardwareDiameter,
} from './actions';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { clearHistory } from './history';
import { useUiStore } from './uiStore';

describe('library construction actions', () => {
  beforeEach(() => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({ selectedPartIds: [], gizmoMode: 'select', toast: null });
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
});
