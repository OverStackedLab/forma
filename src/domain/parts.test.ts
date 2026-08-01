import { describe, expect, it } from 'vitest';
import { computePartSpecs, groupContaining, groupMatching, livePartIds } from './parts';
import type { CustomPart, Group } from './types';

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
