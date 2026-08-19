import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CustomPart, Transform } from '@/domain/types';
import { ModelBuilder } from './ModelBuilder';
import { computeFloorSnapTransforms } from './floorSnap';

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

const transform = (y: number): Transform => ({
  position: [0, y, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

describe('floor snapping', () => {
  it('moves every selected part by one shared offset instead of collapsing the structure', () => {
    const builder = new ModelBuilder(new THREE.Group());
    builder.sync({
      customParts: [panel('lower'), panel('upper')],
      transforms: { lower: transform(0.25), upper: transform(1) },
      overrides: {},
      hiddenIds: [],
      defaultMaterialId: 'ash',
      defaultColorId: 'white',
      defaultHardwareFinishId: 'matte-black',
    });

    const beforeGap = builder.getRoot('upper')!.position.y - builder.getRoot('lower')!.position.y;
    const snapped = computeFloorSnapTransforms(builder, ['lower', 'upper']);

    expect(snapped?.lower?.position[1]).toBeCloseTo(0.05, 8);
    expect(snapped?.upper?.position[1]).toBeCloseTo(0.8, 8);
    expect(snapped!.upper!.position[1] - snapped!.lower!.position[1]).toBeCloseTo(beforeGap, 8);
    expect(computeFloorSnapTransforms(builder, ['lower', 'upper'])).toBeNull();
    builder.dispose();
  });
});
