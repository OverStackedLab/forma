import { describe, expect, it } from 'vitest';
import { buildCabinetLayout, shelfPositions } from './cabinets';
import { CABINET_PRESETS } from './catalog';
import {
  cabinetConfigAfterInteriorDelete,
  cabinetGroupsAfterMemberEdit,
  cabinetLoadedFromGroup,
  rebuildCabinet,
} from './cabinetLifecycle';
import type { CabinetConfig, CustomPart, Group, Transform, Transforms } from './types';

const base = CABINET_PRESETS.find((preset) => preset.id === 'base-600')!;

function placedCabinet(): { group: Group; parts: CustomPart[]; transforms: Transforms } {
  const layout = buildCabinetLayout(base);
  const parts: CustomPart[] = layout.map((item, index) => ({
    id: `p${index}`,
    label: item.label,
    w: item.w,
    h: item.h,
    d: item.d,
    shape: item.shape,
    category: item.category,
    bomLabel: item.bomLabel,
    thicknessAxis: item.thicknessAxis,
    grainAxis: item.grainAxis,
    edgeBanding: [...item.edgeBanding],
  }));
  const transforms: Transforms = Object.fromEntries(
    layout.map((item, index) => [
      `p${index}`,
      {
        position: [item.positionMm[0] / 1000, item.positionMm[1] / 1000, item.positionMm[2] / 1000],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
      } satisfies Transform,
    ]),
  );
  const cabinet: CabinetConfig = {
    presetId: base.id,
    width: base.width,
    height: base.height,
    depth: base.depth,
    shelfCount: base.shelfCount,
  };
  return {
    group: { id: 'g', label: base.label, partIds: parts.map((part) => part.id), cabinet },
    parts,
    transforms,
  };
}

describe('cabinetGroupsAfterMemberEdit', () => {
  it('removes the cabinet configuration when one member changes size', () => {
    const { group, transforms } = placedCabinet();
    const [next] = cabinetGroupsAfterMemberEdit([group], transforms, ['p5'], ['p5']);
    expect(next?.cabinet).toBeUndefined();
  });

  it('writes a moved shelf centreline back onto the cabinet configuration', () => {
    const { group, transforms } = placedCabinet();
    const shelf = transforms.p5!;
    transforms.p5 = {
      ...shelf,
      position: [shelf.position[0], shelf.position[1] + 0.1, shelf.position[2]],
    };
    const [next] = cabinetGroupsAfterMemberEdit([group], transforms, ['p5'], []);
    expect(shelfPositions(next!.cabinet!)).toEqual([500]);
  });

  it('removes a drawer configuration on a partial size edit', () => {
    const group: Group = {
      id: 'd',
      label: 'Drawer',
      partIds: ['a', 'b'],
      drawer: { width: 562, height: 180, depth: 550 },
    };
    const [next] = cabinetGroupsAfterMemberEdit([group], {}, ['a'], ['a']);
    expect(next?.drawer).toBeUndefined();
  });
});

describe('cabinetConfigAfterInteriorDelete', () => {
  it('returns null when a side is deleted', () => {
    const { group } = placedCabinet();
    expect(cabinetConfigAfterInteriorDelete(group, new Set(['p0']))).toBeNull();
  });

  it('drops the shelf when the shelf is deleted', () => {
    const { group } = placedCabinet();
    expect(cabinetConfigAfterInteriorDelete(group, new Set(['p5']))).toMatchObject({ shelfCount: 0 });
  });
});

describe('rebuildCabinet', () => {
  it('keeps member ids and applies the new width', () => {
    const { group, parts, transforms } = placedCabinet();
    const next = rebuildCabinet(
      { customParts: parts, transforms, groups: [group], overrides: {}, hiddenIds: [] },
      group,
      { ...group.cabinet!, width: 800 },
      () => 'new-id',
    );
    const rebuilt = next.groups[0]!;
    expect(rebuilt.partIds).toEqual(group.partIds);
    expect(rebuilt.cabinet?.width).toBe(800);
    expect(next.customParts.find((part) => part.id === 'p2')?.w).toBe(764);
  });
});

describe('cabinetLoadedFromGroup', () => {
  it('leaves a current file without a cabinet configuration as a plain group', () => {
    const { group, parts } = placedCabinet();
    const loaded = cabinetLoadedFromGroup({
      label: group.label,
      partIds: group.partIds,
      parts,
      cabinet: undefined,
      legacyAxes: false,
    });
    expect(loaded.cabinet).toBeUndefined();
  });

  it('keeps a saved grain axis on a current file', () => {
    const { group, parts } = placedCabinet();
    const side = { ...parts[0]!, grainAxis: 'd' as const };
    const loaded = cabinetLoadedFromGroup({
      label: group.label,
      partIds: group.partIds,
      parts: [side, ...parts.slice(1)],
      cabinet: group.cabinet,
      legacyAxes: false,
    });
    expect(loaded.parts[0]?.grainAxis).toBe('d');
    expect(loaded.parts[0]?.bomLabel).toBe('Base cabinet 60 cm Side');
  });
});
