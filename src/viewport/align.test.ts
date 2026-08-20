import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CustomPart, Transform } from '@/domain/types';
import { computeAlignTransforms } from './align';
import { ModelBuilder } from './ModelBuilder';

const cube = (id: string, sizeMm = 100): CustomPart => ({
  id,
  label: id,
  w: sizeMm,
  h: sizeMm,
  d: sizeMm,
  shape: 'box',
  category: 'panel',
  thicknessAxis: 'h',
  grainAxis: 'w',
  edgeBanding: [],
});

const at = (x: number, y: number, z: number): Transform => ({
  position: [x, y, z],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

function builderWith(parts: readonly CustomPart[], transforms: Record<string, Transform>): ModelBuilder {
  const builder = new ModelBuilder(new THREE.Group());
  builder.sync({
    customParts: [...parts],
    transforms,
    overrides: {},
    hiddenIds: [],
    defaultMaterialId: 'ash',
    defaultColorId: 'white',
    defaultHardwareFinishId: 'matte-black',
  });
  return builder;
}

describe('align', () => {
  it('matches left edges on X and leaves hang height and depth unchanged', () => {
    const builder = builderWith(
      [cube('target'), cube('moving')],
      { target: at(0, 0.05, 0), moving: at(1, 0.5, 0.2) },
    );

    const aligned = computeAlignTransforms(builder, ['target'], ['moving'], 'left');
    expect(aligned?.moving?.position[0]).toBeCloseTo(0, 8);
    expect(aligned?.moving?.position[1]).toBeCloseTo(0.5, 8);
    expect(aligned?.moving?.position[2]).toBeCloseTo(0.2, 8);
    builder.dispose();
  });

  it('matches right edges of different widths without moving Y', () => {
    const builder = builderWith(
      [cube('target', 100), cube('moving', 200)],
      { target: at(0, 0.05, 0), moving: at(1, 0.5, 0.2) },
    );

    const aligned = computeAlignTransforms(builder, ['target'], ['moving'], 'right');
    expect(aligned?.moving?.position[0]).toBeCloseTo(-0.05, 8);
    expect(aligned?.moving?.position[1]).toBeCloseTo(0.5, 8);
    expect(aligned?.moving?.position[2]).toBeCloseTo(0.2, 8);
    builder.dispose();
  });

  it('matches fronts on Z without changing X or hang height', () => {
    const builder = builderWith(
      [cube('target'), cube('moving')],
      { target: at(0, 0.05, 0), moving: at(1, 0.5, 0.2) },
    );

    const aligned = computeAlignTransforms(builder, ['target'], ['moving'], 'front');
    expect(aligned?.moving?.position[0]).toBeCloseTo(1, 8);
    expect(aligned?.moving?.position[1]).toBeCloseTo(0.5, 8);
    expect(aligned?.moving?.position[2]).toBeCloseTo(0, 8);
    builder.dispose();
  });

  it('matches X centres without changing hang height', () => {
    const builder = builderWith(
      [cube('target', 100), cube('moving', 200)],
      { target: at(0, 0.05, 0), moving: at(1, 0.5, 0.2) },
    );

    const aligned = computeAlignTransforms(builder, ['target'], ['moving'], 'center-x');
    expect(aligned?.moving?.position[0]).toBeCloseTo(0, 8);
    expect(aligned?.moving?.position[1]).toBeCloseTo(0.5, 8);
    builder.dispose();
  });

  it('moves a whole rigid group by one shared translation', () => {
    const builder = builderWith(
      [cube('target'), cube('moving-a'), cube('moving-b')],
      { target: at(0, 0.05, 0), 'moving-a': at(1, 0.5, 0), 'moving-b': at(1.3, 0.5, 0) },
    );

    const aligned = computeAlignTransforms(builder, ['target'], ['moving-a', 'moving-b'], 'left');
    expect(aligned?.['moving-a']?.position[0]).toBeCloseTo(0, 8);
    expect(aligned?.['moving-b']?.position[0]).toBeCloseTo(0.3, 8);
    expect(aligned?.['moving-a']?.position[1]).toBeCloseTo(0.5, 8);
    builder.dispose();
  });

  it('returns null when the chosen bound already matches', () => {
    const builder = builderWith(
      [cube('target'), cube('moving')],
      { target: at(0, 0.05, 0), moving: at(0, 0.5, 0) },
    );
    expect(computeAlignTransforms(builder, ['target'], ['moving'], 'left')).toBeNull();
    builder.dispose();
  });
});
