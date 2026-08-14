import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CustomPart, Transform } from '@/domain/types';
import { ModelBuilder } from './ModelBuilder';
import { computeSnapTogetherTransforms } from './snapTogether';

const part = (id: string): CustomPart => ({
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

describe('snap together', () => {
  it('moves the second rigid unit to contact while preserving its internal spacing', () => {
    const builder = new ModelBuilder(new THREE.Group());
    builder.sync({
      customParts: [part('target'), part('moving-a'), part('moving-b')],
      transforms: { target: at(0), 'moving-a': at(1), 'moving-b': at(1.3) },
      overrides: {},
      hiddenIds: [],
      defaultMaterialId: 'ash',
      defaultColorId: 'white',
      defaultHardwareFinishId: 'matte-black',
    });

    const snapped = computeSnapTogetherTransforms(builder, ['target'], ['moving-a', 'moving-b']);
    expect(snapped?.['moving-a']?.position[0]).toBeCloseTo(0.1, 8);
    expect(snapped?.['moving-b']?.position[0]).toBeCloseTo(0.4, 8);
    expect(snapped!['moving-b']!.position[0] - snapped!['moving-a']!.position[0]).toBeCloseTo(0.3, 8);
    expect(snapped?.['moving-a']?.position[1]).toBeCloseTo(0.05, 8);
    builder.dispose();
  });
});
