import { describe, expect, it } from 'vitest';
import type { CabinetLayoutPart } from './cabinets';
import { applyGeneratedLayout, anchorPlacement } from './generatedAssembly';
import type { CustomPart, Group, Transform } from './types';

function layoutPart(label: string, w: number, positionMm: [number, number, number]): CabinetLayoutPart {
  return {
    label,
    bomLabel: label,
    w,
    h: 18,
    d: 100,
    shape: 'box',
    category: 'panel',
    thicknessAxis: 'h',
    grainAxis: 'w',
    edgeBanding: ['d-max'],
    positionMm,
    quaternion: [0, 0, 0, 1],
  };
}

function part(id: string, w: number): CustomPart {
  return {
    id,
    label: id,
    w,
    h: 18,
    d: 100,
    shape: 'box',
    category: 'panel',
    thicknessAxis: 'h',
    grainAxis: 'd',
    edgeBanding: [],
  };
}

const identity: Transform = {
  position: [1, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

describe('anchorPlacement', () => {
  it('reads the group origin from the first member', () => {
    const placement = anchorPlacement(['a'], [100, 0, 0], { a: identity });
    expect(placement.origin[0]).toBeCloseTo(0.9);
    expect(placement.quaternion).toEqual([0, 0, 0, 1]);
  });
});

describe('applyGeneratedLayout', () => {
  const group: Group = { id: 'g', label: 'Old', partIds: ['a', 'b'] };

  it('updates a kept member, adds a new one, and drops a removed one', () => {
    const next = applyGeneratedLayout(
      {
        customParts: [part('a', 10), part('b', 10)],
        transforms: { a: identity, b: identity },
        groups: [group],
        overrides: { b: { color: 'white' } },
        hiddenIds: ['b'],
      },
      group,
      [layoutPart('Side', 18, [0, 0, 0]), layoutPart('Bottom', 200, [0, 9, 0])],
      ['a', 'c'],
      { origin: [0, 0, 0], quaternion: [0, 0, 0, 1] },
      { label: 'Drawer box 40×20 cm', drawer: { width: 362, height: 180, depth: 550 } },
    );
    expect(next.groups[0]).toMatchObject({
      label: 'Drawer box 40×20 cm',
      partIds: ['a', 'c'],
      drawer: { width: 362 },
    });
    expect(next.customParts.map((item) => item.id)).toEqual(['a', 'c']);
    expect(next.customParts[0]).toMatchObject({ w: 18, grainAxis: 'd', edgeBanding: [] });
    expect(next.customParts[1]).toMatchObject({ w: 200, grainAxis: 'w', edgeBanding: ['d-max'] });
    expect(next.transforms.b).toBeUndefined();
    expect(next.overrides.b).toBeUndefined();
    expect(next.hiddenIds).toEqual([]);
    expect(next.transforms.c?.position).toEqual([0, 0.009, 0]);
  });

  it('writes a cabinet configuration without clearing other group fields', () => {
    const cabinetGroup: Group = { ...group, drawer: { width: 1, height: 1, depth: 1 } };
    const next = applyGeneratedLayout(
      {
        customParts: [part('a', 10)],
        transforms: {},
        groups: [cabinetGroup],
        overrides: {},
        hiddenIds: [],
      },
      cabinetGroup,
      [layoutPart('Side', 18, [0, 0, 0])],
      ['a'],
      { origin: [0, 0, 0], quaternion: [0, 0, 0, 1] },
      { label: 'Base cabinet 80 cm', cabinet: { width: 800, height: 800, depth: 600, shelfCount: 1 } },
    );
    expect(next.groups[0]?.cabinet?.width).toBe(800);
    expect(next.groups[0]?.drawer?.width).toBe(1);
  });
});
