import type { Box3, Object3D } from 'three';
import type { Transform } from '@/domain/types';
import { combinedWorldBounds, worldBoundsExcludingHalos } from './bounds';
import type { ModelBuilder } from './ModelBuilder';

const FACE_SNAP_TOLERANCE_M = 0.02;

function overlapsOnOtherAxes(a: Box3, b: Box3, axis: 'x' | 'y' | 'z'): boolean {
  const axes = (['x', 'y', 'z'] as const).filter((candidate) => candidate !== axis);
  return axes.every(
    (other) =>
      a.max[other] >= b.min[other] - FACE_SNAP_TOLERANCE_M &&
      b.max[other] >= a.min[other] - FACE_SNAP_TOLERANCE_M,
  );
}

/**
 * Magnetically finishes a near-miss from the move gizmo. The 100 mm layout
 * grid remains useful for broad placement, while common 18 mm panels can still
 * land on the exact 9/18 mm centre offsets required for flush faces.
 */
export function snapSelectionToNearbyFaces(
  builder: ModelBuilder,
  ids: readonly string[],
  changed: Record<string, Transform>,
): Record<string, Transform> {
  const selected = new Set(ids);
  const roots = ids.map((id) => builder.getRoot(id));
  const selectionBox = combinedWorldBounds(roots);
  if (!selectionBox) return changed;

  const targets: Object3D[] = builder
    .visibleIds()
    .filter((id) => !selected.has(id))
    .map((id) => builder.getRoot(id))
    .filter((root): root is Object3D => Boolean(root));

  const delta = { x: 0, y: 0, z: 0 };
  for (const axis of ['x', 'y', 'z'] as const) {
    let best: number | null = null;
    for (const target of targets) {
      const targetBox = worldBoundsExcludingHalos(target);
      if (!targetBox || !overlapsOnOtherAxes(selectionBox, targetBox, axis)) continue;
      const candidates = [
        targetBox.min[axis] - selectionBox.max[axis],
        targetBox.max[axis] - selectionBox.min[axis],
        targetBox.min[axis] - selectionBox.min[axis],
        targetBox.max[axis] - selectionBox.max[axis],
      ];
      for (const candidate of candidates) {
        // An already-flush/contacting face on this axis wins over a different
        // nearby face; otherwise a grounded shelf could be pulled below the floor.
        if (Math.abs(candidate) <= 1e-6) {
          best = 0;
          break;
        }
        if (
          Math.abs(candidate) <= FACE_SNAP_TOLERANCE_M &&
          (best === null || Math.abs(candidate) < Math.abs(best))
        ) {
          best = candidate;
        }
      }
      if (best === 0) break;
    }
    if (best !== null) delta[axis] = best;
  }

  if (delta.x === 0 && delta.y === 0 && delta.z === 0) return changed;
  const snapped: Record<string, Transform> = {};
  for (const id of ids) {
    const root = builder.getRoot(id);
    if (!root) continue;
    root.position.x += delta.x;
    root.position.y += delta.y;
    root.position.z += delta.z;
    snapped[id] = {
      position: root.position.toArray() as [number, number, number],
      quaternion: root.quaternion.toArray() as [number, number, number, number],
      scale: root.scale.toArray() as [number, number, number],
    };
  }
  return snapped;
}
