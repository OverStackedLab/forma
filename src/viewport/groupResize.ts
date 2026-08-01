import * as THREE from 'three';
import type { Transform } from '@/domain/types';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;
type Axis = keyof typeof AXIS_INDEX;

/**
 * Resizes a rigid group around the same shared centroid used by the scale
 * gizmo. A world-axis scale is applied to every member's full transform, so
 * both the pieces and the gaps between them change by one common factor.
 */
export function computeGroupResizeTransforms(
  builder: ModelBuilder,
  ids: readonly string[],
  axis: Axis,
  targetMillimetres: number,
): Record<string, Transform> | null {
  if (!ids.length || !Number.isFinite(targetMillimetres) || targetMillimetres <= 0) return null;

  const roots = ids
    .map((id) => ({ id, root: builder.getRoot(id) }))
    .filter(
      (entry): entry is { id: string; root: NonNullable<typeof entry.root> } =>
        Boolean(entry.root),
    );
  // A partial resize would break the saved group, so wait until the complete
  // scene representation is available rather than scaling only found roots.
  if (roots.length !== ids.length) return null;

  const bounds = combinedWorldBounds(roots.map(({ root }) => root));
  if (!bounds) return null;
  const index = AXIS_INDEX[axis];
  const size = bounds.getSize(new THREE.Vector3()).getComponent(index);
  if (size < 1e-9) return null;

  const factor = targetMillimetres / 1000 / size;
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return null;

  const pivot = new THREE.Vector3();
  for (const { root } of roots) {
    root.updateMatrixWorld(true);
    pivot.add(root.getWorldPosition(new THREE.Vector3()));
  }
  pivot.divideScalar(roots.length);

  const scale = new THREE.Vector3(1, 1, 1).setComponent(index, factor);
  const aroundPivot = new THREE.Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));

  const next: Record<string, Transform> = {};
  for (const { id, root } of roots) {
    root.updateMatrixWorld(true);
    const world = new THREE.Matrix4().multiplyMatrices(aroundPivot, root.matrixWorld);
    const local = root.parent
      ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert().multiply(world)
      : world;
    local.decompose(root.position, root.quaternion, root.scale);
    root.updateMatrixWorld(true);
    next[id] = {
      position: root.position.toArray() as Transform['position'],
      quaternion: root.quaternion.toArray() as Transform['quaternion'],
      scale: root.scale.toArray() as Transform['scale'],
    };
  }
  return next;
}
