import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { CustomPart, Transform } from '@/domain/types';
import { ModelBuilder } from './ModelBuilder';
import { computeFaceSnap, snapSelectionToNearbyFaces } from './faceSnap';

const identity: Transform = { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };

const shelf: CustomPart = {
  id: 'shelf', label: 'Shelf', w: 800, h: 18, d: 300, shape: 'box',
  category: 'panel', thicknessAxis: 'h', grainAxis: 'w', edgeBanding: ['d-max'],
};
const side: CustomPart = {
  id: 'side', label: 'Side', w: 18, h: 400, d: 600, shape: 'box',
  category: 'panel', thicknessAxis: 'w', grainAxis: 'h', edgeBanding: ['d-max'],
};

function syncParts(
  transforms: Record<string, Transform>,
): ModelBuilder {
  const builder = new ModelBuilder(new THREE.Group());
  builder.sync({
    customParts: [shelf, side],
    transforms,
    overrides: {},
    hiddenIds: [],
    defaultMaterialId: 'ash',
    defaultColorId: 'white',
    defaultHardwareFinishId: 'matte-black',
  });
  return builder;
}

describe('face snapping', () => {
  let builder: ModelBuilder | null = null;
  afterEach(() => {
    builder?.dispose();
    builder = null;
  });

  it('turns a 9 mm overlap into exact contact between an 18 mm side and a shelf', () => {
    builder = syncParts({
      shelf: { ...identity, position: [0, 0.009, 0] },
      side: { ...identity, position: [0.4, 0.2, 0] },
    });
    const sideTransform = builder.getRoot('side')!;
    const snapped = snapSelectionToNearbyFaces(
      builder,
      ['side'],
      { side: { ...identity, position: sideTransform.position.toArray() as Transform['position'] } },
    );
    expect(snapped.side?.position[0]).toBeCloseTo(0.409, 8);
    expect(snapped.side?.position[1]).toBeCloseTo(0.2, 8);
  });

  it('pulls a 50 mm gap closed, which the old 20 mm window would miss', () => {
    builder = syncParts({
      shelf: { ...identity, position: [0, 0.009, 0] },
      side: { ...identity, position: [0.459, 0.2, 0] },
    });
    const snapped = snapSelectionToNearbyFaces(builder, ['side'], {
      side: { ...identity, position: [0.459, 0.2, 0] },
    });
    expect(snapped.side?.position[0]).toBeCloseTo(0.409, 8);
  });

  it('leaves an 80 mm gap alone', () => {
    builder = syncParts({
      shelf: { ...identity, position: [0, 0.009, 0] },
      side: { ...identity, position: [0.489, 0.2, 0] },
    });
    const original = { side: { ...identity, position: [0.489, 0.2, 0] as Transform['position'] } };
    const snapped = snapSelectionToNearbyFaces(builder, ['side'], original);
    expect(snapped).toBe(original);
  });

  it('snaps only the requested axis so a sideways drag does not drop onto a nearby top', () => {
    builder = syncParts({
      shelf: { ...identity, position: [0, 0.009, 0] },
      side: { ...identity, position: [0.459, 0.268, 0] },
    });
    const snapped = snapSelectionToNearbyFaces(
      builder,
      ['side'],
      { side: { ...identity, position: [0.459, 0.268, 0] } },
      ['x'],
    );
    expect(snapped.side?.position[0]).toBeCloseTo(0.409, 8);
    expect(snapped.side?.position[1]).toBeCloseTo(0.268, 8);
  });

  it('returns a face guide on the contacting plane', () => {
    builder = syncParts({
      shelf: { ...identity, position: [0, 0.009, 0] },
      side: { ...identity, position: [0.459, 0.2, 0] },
    });
    const plan = computeFaceSnap(builder, ['side'], ['x']);
    expect(plan?.delta.x).toBeCloseTo(-0.05, 8);
    expect(plan?.guides).toHaveLength(1);
    for (const corner of plan!.guides[0]!.corners) {
      expect(corner[0]).toBeCloseTo(0.4, 8);
    }
  });
});
