import type { Box3, Object3D } from 'three';
import type { Transform } from '@/domain/types';
import { combinedWorldBounds, worldBoundsExcludingHalos } from './bounds';
import type { ModelBuilder } from './ModelBuilder';

export const FACE_SNAP_TOLERANCE_M = 0.06;
const GUIDE_MIN_M = 0.04;
const AXES = ['x', 'y', 'z'] as const;
export type FaceSnapAxis = (typeof AXES)[number];

export type FaceSnapGuide = {
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
};

export type FaceSnapPlan = {
  delta: { x: number; y: number; z: number };
  guides: FaceSnapGuide[];
};

function tangentAxes(axis: FaceSnapAxis): [FaceSnapAxis, FaceSnapAxis] {
  if (axis === 'x') return ['y', 'z'];
  if (axis === 'y') return ['x', 'z'];
  return ['x', 'y'];
}

function overlapsOnOtherAxes(a: Box3, b: Box3, axis: FaceSnapAxis): boolean {
  return tangentAxes(axis).every(
    (other) =>
      a.max[other] >= b.min[other] - FACE_SNAP_TOLERANCE_M &&
      b.max[other] >= a.min[other] - FACE_SNAP_TOLERANCE_M,
  );
}

function overlapSpan(aMin: number, aMax: number, bMin: number, bMax: number): { min: number; max: number } {
  let min = Math.max(aMin, bMin);
  let max = Math.min(aMax, bMax);
  if (max - min < GUIDE_MIN_M) {
    const mid = (Math.min(aMax, bMax) + Math.max(aMin, bMin)) / 2;
    min = mid - GUIDE_MIN_M / 2;
    max = mid + GUIDE_MIN_M / 2;
  }
  return { min, max };
}

function guideCorners(
  axis: FaceSnapAxis,
  plane: number,
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): FaceSnapGuide['corners'] {
  const [u, v] = tangentAxes(axis);
  function point(a: number, b: number): [number, number, number] {
    const next = { x: 0, y: 0, z: 0 };
    next[axis] = plane;
    next[u] = a;
    next[v] = b;
    return [next.x, next.y, next.z];
  }
  return [point(aMin, bMin), point(aMax, bMin), point(aMax, bMax), point(aMin, bMax)];
}

function isZeroDelta(delta: FaceSnapPlan['delta']): boolean {
  return delta.x === 0 && delta.y === 0 && delta.z === 0;
}

/**
 * Magnetically finishes a near-miss from the move gizmo. The 100 mm layout
 * grid remains available via Shift; this catch radius is wide enough for
 * 18 mm panels and 450 mm modules that never land on that grid.
 */
export function computeFaceSnap(
  builder: ModelBuilder,
  ids: readonly string[],
  axes: readonly FaceSnapAxis[] = AXES,
): FaceSnapPlan | null {
  const selected = new Set(ids);
  const roots = ids.map((id) => builder.getRoot(id));
  const selectionBox = combinedWorldBounds(roots);
  if (!selectionBox) return null;

  const targets: Object3D[] = builder
    .visibleIds()
    .filter((id) => !selected.has(id))
    .map((id) => builder.getRoot(id))
    .filter((root): root is Object3D => Boolean(root));

  const delta = { x: 0, y: 0, z: 0 };
  const guides: FaceSnapGuide[] = [];

  for (const axis of axes) {
    let best: { shift: number; plane: number; targetBox: Box3 } | null = null;
    for (const target of targets) {
      const targetBox = worldBoundsExcludingHalos(target);
      if (!targetBox || !overlapsOnOtherAxes(selectionBox, targetBox, axis)) continue;
      const candidates = [
        { shift: targetBox.min[axis] - selectionBox.max[axis], plane: targetBox.min[axis] },
        { shift: targetBox.max[axis] - selectionBox.min[axis], plane: targetBox.max[axis] },
        { shift: targetBox.min[axis] - selectionBox.min[axis], plane: targetBox.min[axis] },
        { shift: targetBox.max[axis] - selectionBox.max[axis], plane: targetBox.max[axis] },
      ];
      for (const candidate of candidates) {
        // An already-flush/contacting face on this axis wins over a different
        // nearby face; otherwise a grounded shelf could be pulled below the floor.
        if (Math.abs(candidate.shift) <= 1e-6) {
          best = { shift: 0, plane: candidate.plane, targetBox };
          break;
        }
        if (
          Math.abs(candidate.shift) <= FACE_SNAP_TOLERANCE_M &&
          (best === null || Math.abs(candidate.shift) < Math.abs(best.shift))
        ) {
          best = { shift: candidate.shift, plane: candidate.plane, targetBox };
        }
      }
      if (best?.shift === 0) break;
    }
    if (!best) continue;
    delta[axis] = best.shift;
    const [u, v] = tangentAxes(axis);
    const spanU = overlapSpan(
      selectionBox.min[u],
      selectionBox.max[u],
      best.targetBox.min[u],
      best.targetBox.max[u],
    );
    const spanV = overlapSpan(
      selectionBox.min[v],
      selectionBox.max[v],
      best.targetBox.min[v],
      best.targetBox.max[v],
    );
    guides.push({
      corners: guideCorners(axis, best.plane, spanU.min, spanU.max, spanV.min, spanV.max),
    });
  }

  if (!guides.length) return null;
  return { delta, guides };
}

export function applyFaceSnapPlan(
  builder: ModelBuilder,
  ids: readonly string[],
  plan: FaceSnapPlan,
): Record<string, Transform> {
  const snapped: Record<string, Transform> = {};
  if (isZeroDelta(plan.delta)) return snapped;
  for (const id of ids) {
    const root = builder.getRoot(id);
    if (!root) continue;
    root.position.x += plan.delta.x;
    root.position.y += plan.delta.y;
    root.position.z += plan.delta.z;
    snapped[id] = {
      position: root.position.toArray() as [number, number, number],
      quaternion: root.quaternion.toArray() as [number, number, number, number],
      scale: root.scale.toArray() as [number, number, number],
    };
  }
  return snapped;
}

export function snapSelectionToNearbyFaces(
  builder: ModelBuilder,
  ids: readonly string[],
  changed: Record<string, Transform>,
  axes?: readonly FaceSnapAxis[],
): Record<string, Transform> {
  const plan = computeFaceSnap(builder, ids, axes);
  if (!plan || isZeroDelta(plan.delta)) return changed;
  return applyFaceSnapPlan(builder, ids, plan);
}
