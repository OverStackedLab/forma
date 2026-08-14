import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CustomPart, Transform } from '@/domain/types';
import { combinedWorldBounds } from './bounds';
import { computeGroupResizeTransforms } from './groupResize';
import { ModelBuilder } from './ModelBuilder';

const panel = (id: string): CustomPart => ({
  id,
  label: id,
  w: 100,
  h: 100,
  d: 100,
  shape: 'box',
  category: 'panel',
  thicknessAxis: 'h',
  grainAxis: 'w',
  edgeBanding: [],
});

const at = (x: number): Transform => ({
  position: [x, 0.05, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

describe('group resizing', () => {
  it('scales every member and its spacing around one shared pivot', () => {
    const builder = new ModelBuilder(new THREE.Group());
    builder.sync({
      customParts: [panel('left'), panel('right')],
      transforms: { left: at(0), right: at(0.3) },
      overrides: {},
      hiddenIds: [],
      defaultMaterialId: 'ash',
      defaultColorId: 'white',
      defaultHardwareFinishId: 'matte-black',
    });

    const resized = computeGroupResizeTransforms(builder, ['left', 'right'], 'x', 800);
    const bounds = combinedWorldBounds([builder.getRoot('left'), builder.getRoot('right')]);

    expect(bounds).not.toBeNull();
    expect(bounds!.getSize(new THREE.Vector3()).x * 1000).toBeCloseTo(800, 6);
    expect(resized?.left?.position[0]).toBeCloseTo(-0.15, 8);
    expect(resized?.right?.position[0]).toBeCloseTo(0.45, 8);
    expect(resized?.left?.scale[0]).toBeCloseTo(2, 8);
    expect(resized?.right?.scale[0]).toBeCloseTo(2, 8);
    expect(resized!.right!.position[0] - resized!.left!.position[0]).toBeCloseTo(0.6, 8);
    expect(resized?.left?.position[1]).toBeCloseTo(0.05, 8);
    expect(resized?.left?.scale[1]).toBeCloseTo(1, 8);
    builder.dispose();
  });

  it('does not partially resize a group while one member is unavailable', () => {
    const builder = new ModelBuilder(new THREE.Group());
    builder.sync({
      customParts: [panel('available')],
      transforms: { available: at(0) },
      overrides: {},
      hiddenIds: [],
      defaultMaterialId: 'ash',
      defaultColorId: 'white',
      defaultHardwareFinishId: 'matte-black',
    });

    expect(computeGroupResizeTransforms(builder, ['available', 'missing'], 'x', 200)).toBeNull();
    expect(builder.getRoot('available')?.scale.x).toBe(1);
    builder.dispose();
  });
});
