import { describe, expect, it } from 'vitest';
import { buildCabinetLayout } from './cabinets';
import { CABINET_PRESETS, PANEL_PRESETS } from './catalog';
import { eulerDegreesToQuaternion, multiplyQuaternions } from './rotation';
import { inferCabinetConfig, restorableCabinetGroup } from './restoreCabinet';
import { rotateVectorByQuaternion } from './spatial';
import type { CustomPart, Group, Transform, Transforms } from './types';

function fromLayout(presetId: string) {
  const preset = CABINET_PRESETS.find((candidate) => candidate.id === presetId)!;
  const layout = buildCabinetLayout(preset);
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
        quaternion: [...item.quaternion],
        scale: [1, 1, 1],
      } satisfies Transform,
    ]),
  );
  return { parts, transforms, partIds: parts.map((part) => part.id) };
}

describe('inferCabinetConfig', () => {
  it('reads a Base 600 carcass back into its catalog config', () => {
    const { parts, transforms, partIds } = fromLayout('base-600');
    expect(inferCabinetConfig(parts, transforms, partIds)).toEqual({
      presetId: 'base-600',
      width: 600,
      height: 800,
      depth: 600,
      shelfCount: 1,
    });
  });

  it('keeps width and depth when the whole cabinet is yawed 90°', () => {
    const { parts, transforms, partIds } = fromLayout('wall-600');
    const yaw = eulerDegreesToQuaternion({ x: 0, y: 90, z: 0 });
    const rotated: Transforms = Object.fromEntries(
      partIds.map((id) => {
        const current = transforms[id]!;
        const offset = rotateVectorByQuaternion(
          { x: current.position[0], y: current.position[1], z: current.position[2] },
          yaw,
        );
        return [
          id,
          {
            position: [offset.x, offset.y, offset.z] as Transform['position'],
            quaternion: multiplyQuaternions(yaw, current.quaternion),
            scale: current.scale,
          },
        ];
      }),
    );
    expect(inferCabinetConfig(parts, rotated, partIds)).toMatchObject({
      presetId: 'wall-600',
      width: 600,
      height: 800,
      depth: 370,
      shelfCount: 1,
    });
  });

  it('records explicit interior-panel offsets', () => {
    const preset = CABINET_PRESETS.find((candidate) => candidate.id === 'base-600')!;
    const layout = buildCabinetLayout({ ...preset, dividerPositionsMm: [300] });
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
          quaternion: [...item.quaternion],
          scale: [1, 1, 1],
        } satisfies Transform,
      ]),
    );
    expect(inferCabinetConfig(parts, transforms, parts.map((part) => part.id))).toMatchObject({
      width: 600,
      height: 800,
      depth: 600,
      shelfCount: 1,
      dividerPositionsMm: [300],
    });
  });

  it('rejects a pair of shelves that is not a carcass', () => {
    const shelf = PANEL_PRESETS.find((preset) => preset.id === 'shelf')!;
    const parts: CustomPart[] = [0, 1].map((index) => ({
      id: `s${index}`,
      label: shelf.label,
      w: shelf.w,
      h: shelf.h,
      d: shelf.d,
      shape: shelf.shape,
      category: shelf.category,
      thicknessAxis: shelf.thicknessAxis,
      grainAxis: shelf.grainAxis,
      edgeBanding: [...shelf.edgeBanding],
    }));
    const transforms: Transforms = {
      s0: { position: [0, 0.009, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
      s1: { position: [0.88, 0.009, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
    };
    expect(inferCabinetConfig(parts, transforms, ['s0', 's1'])).toBeNull();
  });
});

describe('restorableCabinetGroup', () => {
  it('finds a demoted cabinet from a single selected member', () => {
    const { parts, transforms, partIds } = fromLayout('base-600');
    const groups: Group[] = [{ id: 'g1', label: 'Base 600', partIds: [...partIds] }];
    expect(restorableCabinetGroup(groups, parts, transforms, [partIds[0]!])?.id).toBe('g1');
  });

  it('ignores a group that already has cabinet config', () => {
    const { parts, transforms, partIds } = fromLayout('base-600');
    const groups: Group[] = [{
      id: 'g1',
      label: 'Base 600',
      partIds: [...partIds],
      cabinet: { width: 600, height: 800, depth: 600, shelfCount: 1, presetId: 'base-600' },
    }];
    expect(restorableCabinetGroup(groups, parts, transforms, partIds)).toBeUndefined();
  });
});
