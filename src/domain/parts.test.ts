import { describe, expect, it } from 'vitest';
import {
  computePartSpecs,
  cabinetContainingSelection,
  groupContaining,
  groupInclusion,
  dimensionNeighborIds,
  gizmoPartIds,
  groupMatching,
  livePartIds,
  selectionPositionMetres,
  selectionTogglingGroup,
  selectionUnits,
} from './parts';
import type { CustomPart, Group, Transform } from './types';

const shelf: CustomPart = {
  id: 'custom-1', label: 'Shelf', w: 800, h: 18, d: 300, shape: 'box',
  category: 'panel', thicknessAxis: 'h', grainAxis: 'w', edgeBanding: ['d-max'],
};
const divider: CustomPart = {
  id: 'custom-2', label: 'Divider', w: 18, h: 700, d: 400, shape: 'box',
  category: 'panel', thicknessAxis: 'w', grainAxis: 'h', edgeBanding: ['d-max'],
};

describe('computePartSpecs', () => {
  it('returns no parts for an empty scene', () => {
    expect(computePartSpecs([])).toEqual([]);
  });

  it('maps every custom part to a spec, in order', () => {
    const specs = computePartSpecs([shelf, divider]);
    expect(specs.map((s) => s.id)).toEqual(['custom-1', 'custom-2']);
    expect(specs[0]).toEqual({
      id: 'custom-1',
      label: 'Shelf',
      size: { x: 800, y: 18, z: 300 },
      shape: 'box',
      category: 'panel',
    });
  });

  it('reflects a deletion by omission — the caller filters customParts directly', () => {
    const specs = computePartSpecs([divider]);
    expect(specs.map((s) => s.id)).toEqual(['custom-2']);
  });
});

describe('livePartIds', () => {
  it('gives the tree, part count and Select All one shared source of truth', () => {
    const parts = [shelf, divider];
    expect(livePartIds(parts)).toEqual(computePartSpecs(parts).map((s) => s.id));
  });

  it('is empty for an empty scene', () => {
    expect(livePartIds([])).toEqual([]);
  });
});

describe('groupInclusion', () => {
  const members = ['a', 'b', 'c'];

  it('is none, partial, or all', () => {
    expect(groupInclusion(members, [])).toBe('none');
    expect(groupInclusion(members, ['a'])).toBe('partial');
    expect(groupInclusion(members, ['a', 'b', 'c'])).toBe('all');
    expect(groupInclusion(members, ['a', 'b', 'c', 'd'])).toBe('all');
  });
});

describe('selectionTogglingGroup', () => {
  const members = ['a', 'b'];

  it('adds the group when it is not fully selected', () => {
    expect(selectionTogglingGroup(['x'], members)).toEqual(['x', 'a', 'b']);
    expect(selectionTogglingGroup(['a'], members)).toEqual(['a', 'b']);
  });

  it('removes only that group when every member is selected', () => {
    expect(selectionTogglingGroup(['a', 'b', 'x'], members)).toEqual(['x']);
  });
});

describe('groupMatching', () => {
  const group: Group = { id: 'group-1', label: 'Group 1', partIds: ['custom-1', 'custom-2'] };

  it('finds the group whose membership exactly matches the selection', () => {
    expect(groupMatching([group], ['custom-1', 'custom-2'])).toBe(group);
    expect(groupMatching([group], ['custom-2', 'custom-1'])).toBe(group);
  });

  it('does not match a partial selection', () => {
    expect(groupMatching([group], ['custom-1'])).toBeUndefined();
  });

  it('does not match a superset selection', () => {
    expect(groupMatching([group], ['custom-1', 'custom-2', 'custom-3'])).toBeUndefined();
  });

  it('never matches a single-part selection', () => {
    const soloGroup: Group = { id: 'g2', label: 'Solo', partIds: ['custom-1'] };
    expect(groupMatching([soloGroup], ['custom-1'])).toBeUndefined();
  });
});

describe('groupContaining', () => {
  const group: Group = { id: 'group-1', label: 'Group 1', partIds: ['custom-1', 'custom-2'] };

  it('finds the group a part belongs to', () => {
    expect(groupContaining([group], 'custom-1')).toBe(group);
  });

  it('returns undefined for an ungrouped part', () => {
    expect(groupContaining([group], 'custom-3')).toBeUndefined();
  });
});

describe('cabinetContainingSelection', () => {
  const cabinet: Group = {
    id: 'cab-1',
    label: 'Base 400',
    partIds: ['a', 'b', 'c'],
    cabinet: { width: 400, height: 800, depth: 600, shelfCount: 1 },
  };
  const rigid: Group = { id: 'g-1', label: 'Rigid', partIds: ['d', 'e'] };
  const other: Group = {
    id: 'cab-2',
    label: 'Wall 800',
    partIds: ['f', 'g'],
    cabinet: { width: 800, height: 800, depth: 370, shelfCount: 1 },
  };

  it('resolves a single member, a partial set, and the full group to the same cabinet', () => {
    expect(cabinetContainingSelection([cabinet], ['a'])).toBe(cabinet);
    expect(cabinetContainingSelection([cabinet], ['b', 'c'])).toBe(cabinet);
    expect(cabinetContainingSelection([cabinet], ['c', 'a', 'b'])).toBe(cabinet);
  });

  it('ignores rigid groups and selections that spill outside one cabinet', () => {
    expect(cabinetContainingSelection([rigid], ['d', 'e'])).toBeUndefined();
    expect(cabinetContainingSelection([cabinet, other], ['a', 'f'])).toBeUndefined();
    expect(cabinetContainingSelection([cabinet], [])).toBeUndefined();
  });
});

describe('selectionUnits', () => {
  const first: Group = { id: 'group-1', label: 'First', partIds: ['a', 'b'] };
  const second: Group = { id: 'group-2', label: 'Second', partIds: ['c', 'd'] };

  it('treats complete groups as rigid units in selection order', () => {
    expect(selectionUnits([first, second], ['a', 'b', 'c', 'd'])).toEqual([
      { kind: 'group', id: 'group-1', partIds: ['a', 'b'] },
      { kind: 'group', id: 'group-2', partIds: ['c', 'd'] },
    ]);
  });

  it('keeps partial groups and loose pieces individually selectable', () => {
    expect(selectionUnits([first], ['a', 'loose'])).toEqual([
      { kind: 'part', id: 'a', partIds: ['a'] },
      { kind: 'part', id: 'loose', partIds: ['loose'] },
    ]);
  });
});

describe('dimensionNeighborIds', () => {
  const first: Group = { id: 'group-1', label: 'First', partIds: ['a', 'b', 'c'] };
  const second: Group = { id: 'group-2', label: 'Second', partIds: ['d', 'e'] };

  it('treats an unselected group as one body', () => {
    expect(dimensionNeighborIds([first, second], ['a', 'b', 'c', 'd', 'e'], ['d', 'e'])).toEqual([
      ['a', 'b', 'c'],
    ]);
  });

  it('leaves siblings of a partially selected group as individual parts', () => {
    expect(dimensionNeighborIds([first], ['a', 'b', 'c'], ['b'])).toEqual([['a'], ['c']]);
  });
});

describe('gizmoPartIds', () => {
  const first: Group = { id: 'group-1', label: 'First', partIds: ['a', 'b'] };
  const second: Group = { id: 'group-2', label: 'Second', partIds: ['c', 'd'] };

  it('drives only the second unit when exactly two are selected', () => {
    expect(gizmoPartIds([first, second], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
    expect(gizmoPartIds([first], ['a', 'loose'])).toEqual(['loose']);
  });

  it('drives the whole selection when there are not exactly two units', () => {
    expect(gizmoPartIds([first], ['a', 'b'])).toEqual(['a', 'b']);
    expect(gizmoPartIds([first, second], ['a', 'b', 'c', 'd', 'loose'])).toEqual([
      'a',
      'b',
      'c',
      'd',
      'loose',
    ]);
  });
});

describe('selectionPositionMetres', () => {
  const at = (x: number, y: number, z: number): Transform => ({
    position: [x, y, z],
    quaternion: [0, 0, 0, 1],
    scale: [1, 1, 1],
  });

  it('uses the underside for Y so parts on the grid read 0', () => {
    const [x, y, z] = selectionPositionMetres(
      [shelf, divider],
      {
        'custom-1': at(0, 0.009, 0),
        'custom-2': at(0.8, 0.35, 0),
      },
      ['custom-1', 'custom-2'],
    );
    expect(x).toBeCloseTo(0.4, 8);
    expect(y).toBeCloseTo(0, 8);
    expect(z).toBeCloseTo(0, 8);
  });
});
