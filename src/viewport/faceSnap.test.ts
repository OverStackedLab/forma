import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CustomPart, Transform } from '@/domain/types';
import { ModelBuilder } from './ModelBuilder';
import { snapSelectionToNearbyFaces } from './faceSnap';

describe('face snapping', () => {
  it('turns a 9 mm overlap into exact contact between an 18 mm side and a shelf', () => {
    const shelf: CustomPart = {
      id: 'shelf', label: 'Shelf', w: 800, h: 18, d: 300, shape: 'box',
      category: 'panel', thicknessAxis: 'h', grainAxis: 'w', edgeBanding: ['d-max'],
    };
    const side: CustomPart = {
      id: 'side', label: 'Side', w: 18, h: 400, d: 600, shape: 'box',
      category: 'panel', thicknessAxis: 'w', grainAxis: 'h', edgeBanding: ['d-max'],
    };
    const shelfTransform: Transform = {
      position: [0, 0.009, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1],
    };
    const sideTransform: Transform = {
      position: [0.4, 0.2, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    };
    const builder = new ModelBuilder(new THREE.Group());
    builder.sync({
      customParts: [shelf, side],
      transforms: { shelf: shelfTransform, side: sideTransform },
      overrides: {},
      hiddenIds: [],
      defaultMaterialId: 'oak',
      defaultColorId: 'natural',
      defaultHardwareFinishId: 'brushed-brass',
    });

    const snapped = snapSelectionToNearbyFaces(builder, ['side'], { side: sideTransform });
    expect(snapped.side?.position[0]).toBeCloseTo(0.409, 8);
    expect(snapped.side?.position[1]).toBeCloseTo(0.2, 8);
    builder.dispose();
  });
});
