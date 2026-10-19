import { describe, expect, it } from 'vitest';
import { eulerDegreesToQuaternion } from '@/domain/rotation';
import type { CustomPart, Group } from '@/domain/types';
import { clearanceTypedEdit, clearanceWitnesses, overallSizeEdit, type BoundsLookup } from './clearance';
import type { Aabb } from './selectionGap';

function aabb(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): Aabb {
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function boundsFor(boxes: Record<string, Aabb>): BoundsLookup {
  return (partIds) => {
    const first = partIds[0];
    if (!first || partIds.length !== 1) return null;
    return boxes[first] ?? null;
  };
}

const part = (id: string, shape: CustomPart['shape'] = 'box', category: CustomPart['category'] = 'panel'): CustomPart => ({
  id,
  label: id,
  w: 400,
  h: 800,
  d: 18,
  shape,
  category,
  grainAxis: 'h',
  edgeBanding: [],
});

describe('clearanceWitnesses', () => {
  it('returns the facing gap from a bounds map', () => {
    const witnesses = clearanceWitnesses({
      groups: [],
      selectedIds: ['a'],
      visibleIds: ['a', 'b'],
      gizmoMode: 'select',
      bounds: boundsFor({
        a: aabb(0, 0, 0, 0.1, 0.2, 0.2),
        b: aabb(0.2, 0, 0, 0.3, 0.2, 0.2),
      }),
    });
    const gap = witnesses?.find((dimension) => dimension.axis === 'x' && dimension.kind === 'gap');
    expect(gap?.gapMm).toBeCloseTo(100);
  });

  it('draws overall size only while the scale gizmo is on', () => {
    const input = {
      groups: [] as Group[],
      selectedIds: ['a'],
      visibleIds: ['a'],
      bounds: boundsFor({ a: aabb(0, 0, 0, 0.4, 0.8, 0.018) }),
    };
    const scaled = clearanceWitnesses({ ...input, gizmoMode: 'scale' });
    const selected = clearanceWitnesses({ ...input, gizmoMode: 'select' });
    expect(scaled?.some((dimension) => dimension.kind === 'overall' && dimension.axis === 'x')).toBe(true);
    expect(selected?.some((dimension) => dimension.kind === 'overall')).toBe(false);
  });

  it('hides flush alignment unless the move gizmo is on', () => {
    const input = {
      groups: [] as Group[],
      selectedIds: ['a'],
      visibleIds: ['a', 'b'],
      bounds: boundsFor({
        a: aabb(0, 0, 0, 0.1, 0.2, 0.2),
        b: aabb(0.1, 0, 0, 0.2, 0.2, 0.2),
      }),
    };
    const moving = clearanceWitnesses({ ...input, gizmoMode: 'translate' });
    const scaling = clearanceWitnesses({ ...input, gizmoMode: 'scale' });
    expect(moving?.some((dimension) => dimension.kind === 'align')).toBe(true);
    expect(scaling?.some((dimension) => dimension.kind === 'align')).toBe(false);
  });

  it('returns null when a selected part has no box yet', () => {
    expect(
      clearanceWitnesses({
        groups: [],
        selectedIds: ['a'],
        visibleIds: ['a'],
        gizmoMode: 'select',
        bounds: () => null,
      }),
    ).toBeNull();
  });
});

describe('clearanceTypedEdit', () => {
  it('nudges the high side toward a larger gap', () => {
    expect(
      clearanceTypedEdit({
        kind: 'gap',
        axis: 'x',
        gapMm: 50,
        movableIsHigh: true,
        raw: '80',
        unit: 'mm',
      }),
    ).toEqual({ kind: 'nudge', deltaMm: { x: 30, y: 0, z: 0 } });
  });

  it('does nothing when the typed value matches the label', () => {
    expect(
      clearanceTypedEdit({
        kind: 'gap',
        axis: 'y',
        gapMm: 50,
        movableIsHigh: true,
        raw: '50',
        unit: 'mm',
      }),
    ).toBeNull();
  });

  it('returns an overall size in millimetres', () => {
    expect(
      clearanceTypedEdit({
        kind: 'overall',
        axis: 'z',
        gapMm: 400,
        movableIsHigh: false,
        raw: '60 cm',
        unit: 'cm',
      }),
    ).toEqual({ kind: 'overall', axis: 'z', millimetres: 600 });
  });
});

describe('overallSizeEdit', () => {
  it('writes a rotated part on the local dimension that runs along the world axis', () => {
    const edit = overallSizeEdit({
      axis: 'x',
      millimetres: 600,
      groups: [],
      selectedIds: ['door'],
      parts: [part('door')],
      quaternionOf: () => eulerDegreesToQuaternion({ x: 0, y: 90, z: 0 }),
    });
    expect(edit).toEqual({ kind: 'part-size', partId: 'door', key: 'd', millimetres: 600 });
  });

  it('resizes a fully selected cabinet on the configuration', () => {
    const group: Group = {
      id: 'cab',
      label: 'Base',
      partIds: ['a', 'b'],
      cabinet: { width: 600, height: 800, depth: 600, shelfCount: 1 },
    };
    expect(
      overallSizeEdit({
        axis: 'x',
        millimetres: 800,
        groups: [group],
        selectedIds: ['a', 'b'],
        parts: [part('a'), part('b')],
        quaternionOf: () => [0, 0, 0, 1],
      }),
    ).toEqual({ kind: 'cabinet', groupId: 'cab', key: 'width', millimetres: 800 });
  });

  it('sets a knob diameter when the typed axis is not its projection', () => {
    expect(
      overallSizeEdit({
        axis: 'x',
        millimetres: 30,
        groups: [],
        selectedIds: ['knob'],
        parts: [part('knob', 'cylinder', 'hardware')],
        quaternionOf: () => [0, 0, 0, 1],
      }),
    ).toEqual({ kind: 'hardware-diameter', partId: 'knob', millimetres: 30 });
  });
});
