import type { Box3 } from 'three';
import type { Transform } from '@/domain/types';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';

const AXES = ['x', 'y', 'z'] as const;
type Axis = (typeof AXES)[number];

/** Smallest translation that makes two one-dimensional ranges overlap. */
function overlapShift(target: Box3, moving: Box3, axis: Axis): number {
  if (moving.max[axis] < target.min[axis]) return target.min[axis] - moving.max[axis];
  if (moving.min[axis] > target.max[axis]) return target.max[axis] - moving.min[axis];
  return 0;
}

/**
 * Moves one piece or rigid group to the nearest contacting face of another.
 * Tangential axes move only when needed to establish overlap, so grounded
 * furniture stays grounded and a group's internal offsets never change.
 */
export function computeSnapTogetherTransforms(
  builder: ModelBuilder,
  targetIds: readonly string[],
  movingIds: readonly string[],
): Record<string, Transform> | null {
  const targetSet = new Set(targetIds);
  const targetRoots = targetIds.map((id) => builder.getRoot(id));
  const movingRoots = movingIds
    .filter((id) => !targetSet.has(id))
    .map((id) => ({ id, root: builder.getRoot(id) }))
    .filter(
      (entry): entry is { id: string; root: NonNullable<typeof entry.root> } =>
        Boolean(entry.root),
    );
  const targetBox = combinedWorldBounds(targetRoots);
  const movingBox = combinedWorldBounds(movingRoots.map(({ root }) => root));
  if (!targetBox || !movingBox || !movingRoots.length) return null;

  const separatedAxes = AXES.filter(
    (axis) => movingBox.max[axis] < targetBox.min[axis] || movingBox.min[axis] > targetBox.max[axis],
  );
  // Prefer closing an existing gap. Only choose a face that requires pushing
  // one object out of an overlap when the bounding boxes overlap on all axes.
  const normalAxes = separatedAxes.length ? separatedAxes : AXES;
  let best: { x: number; y: number; z: number; score: number } | null = null;
  for (const normalAxis of normalAxes) {
    const tangents = AXES.filter((axis) => axis !== normalAxis);
    const faceDeltas = [
      targetBox.min[normalAxis] - movingBox.max[normalAxis],
      targetBox.max[normalAxis] - movingBox.min[normalAxis],
    ];
    for (const normalDelta of faceDeltas) {
      const delta = { x: 0, y: 0, z: 0 };
      delta[normalAxis] = normalDelta;
      for (const tangent of tangents) delta[tangent] = overlapShift(targetBox, movingBox, tangent);
      const score = delta.x ** 2 + delta.y ** 2 + delta.z ** 2;
      if (!best || score < best.score) best = { ...delta, score };
    }
  }

  if (!best || best.score < 1e-12) return null;
  const next: Record<string, Transform> = {};
  for (const { id, root } of movingRoots) {
    root.position.x += best.x;
    root.position.y += best.y;
    root.position.z += best.z;
    next[id] = {
      position: root.position.toArray() as Transform['position'],
      quaternion: root.quaternion.toArray() as Transform['quaternion'],
      scale: root.scale.toArray() as Transform['scale'],
    };
  }
  return next;
}
