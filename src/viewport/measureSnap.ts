import * as THREE from 'three';
import type { MeasureSegment, MeasureVec3 } from '@/domain/measure';
import { SelectionOverlay } from './SelectionOverlay';
import type { ModelBuilder } from './ModelBuilder';

const LOCAL_CORNERS: readonly [number, number, number][] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [-0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5],
];

const LOCAL_EDGES: readonly [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function toMm(point: THREE.Vector3): MeasureVec3 {
  return { x: point.x * 1000, y: point.y * 1000, z: point.z * 1000 };
}

/**
 * World-space millimetre corners and edges of every visible part, excluding
 * selection halos so a 4.5% inflate cannot steal the snap.
 */
export function visibleMeasureFeatures(builder: ModelBuilder): {
  vertices: MeasureVec3[];
  edges: MeasureSegment[];
} {
  const vertices: MeasureVec3[] = [];
  const edges: MeasureSegment[] = [];
  const corner = new THREE.Vector3();
  const corners = LOCAL_CORNERS.map(() => new THREE.Vector3());

  for (const id of builder.visibleIds()) {
    const root = builder.getRoot(id);
    if (!root) continue;
    root.updateMatrixWorld(true);
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || SelectionOverlay.isHalo(mesh)) return;
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box) return;
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      for (const [index, local] of LOCAL_CORNERS.entries()) {
        corner.set(
          centre.x + local[0] * size.x,
          centre.y + local[1] * size.y,
          centre.z + local[2] * size.z,
        ).applyMatrix4(mesh.matrixWorld);
        corners[index]!.copy(corner);
        vertices.push(toMm(corner));
      }
      for (const [from, to] of LOCAL_EDGES) {
        const a = corners[from];
        const b = corners[to];
        if (!a || !b) continue;
        edges.push({ a: toMm(a), b: toMm(b) });
      }
    });
  }

  return { vertices, edges };
}
