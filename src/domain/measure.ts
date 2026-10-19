/**
 * Measure-tool geometry in millimetres. The viewport converts to and from the
 * three.js metre points stored on `uiStore.measurePoints`.
 */

export type MeasureAxis = 'x' | 'y' | 'z';

export type MeasureVec3 = { x: number; y: number; z: number };

export type MeasureSegment = { a: MeasureVec3; b: MeasureVec3 };

/** Vertex / edge catch radius — tight enough that a face hit is not stolen. */
export const MEASURE_SNAP_MM = 20;

const AXES: readonly MeasureAxis[] = ['x', 'y', 'z'];

function distance(a: MeasureVec3, b: MeasureVec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function copyComponent(from: MeasureVec3, to: MeasureVec3, axis: MeasureAxis): MeasureVec3 {
  return { ...to, [axis]: from[axis] };
}

/**
 * The world axis the camera looks along. Front locks Z, Side locks X, Top
 * locks Y, so a second click in those views stays in the picture plane.
 */
export function viewLockAxisFromLook(look: MeasureVec3): MeasureAxis {
  const ax = Math.abs(look.x);
  const ay = Math.abs(look.y);
  const az = Math.abs(look.z);
  if (ax >= ay && ax >= az) return 'x';
  if (ay >= ax && ay >= az) return 'y';
  return 'z';
}

export function dominantAxis(from: MeasureVec3, to: MeasureVec3): MeasureAxis {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dz = Math.abs(to.z - from.z);
  if (dx >= dy && dx >= dz) return 'x';
  if (dy >= dx && dy >= dz) return 'y';
  return 'z';
}

/** Keeps the two non-dominant axes on `from` so the span is a world-axis line. */
export function lockToAxis(from: MeasureVec3, to: MeasureVec3, axis: MeasureAxis): MeasureVec3 {
  return {
    x: axis === 'x' ? to.x : from.x,
    y: axis === 'y' ? to.y : from.y,
    z: axis === 'z' ? to.z : from.z,
  };
}

/**
 * Second-point constraint. Ortho views copy the look-axis first so depth does
 * not leak into the length; Shift then locks onto the remaining dominant axis.
 */
export function constrainMeasurePoint(
  from: MeasureVec3,
  to: MeasureVec3,
  options: { viewLockAxis?: MeasureAxis | null; axisLock?: boolean },
): MeasureVec3 {
  let next = to;
  if (options.viewLockAxis) next = copyComponent(from, next, options.viewLockAxis);
  if (options.axisLock) next = lockToAxis(from, next, dominantAxis(from, next));
  return next;
}

export function closestPointOnSegment(
  point: MeasureVec3,
  a: MeasureVec3,
  b: MeasureVec3,
): MeasureVec3 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  if (lengthSq < 1e-12) return { ...a };
  const t = Math.min(
    1,
    Math.max(0, ((point.x - a.x) * abx + (point.y - a.y) * aby + (point.z - a.z) * abz) / lengthSq),
  );
  return { x: a.x + abx * t, y: a.y + aby * t, z: a.z + abz * t };
}

/**
 * Prefer a nearby vertex, then a nearby edge. Equal distances keep the vertex
 * because vertices are tested first.
 */
export function snapMeasurePoint(
  point: MeasureVec3,
  vertices: readonly MeasureVec3[],
  edges: readonly MeasureSegment[],
  radiusMm: number,
): MeasureVec3 {
  let best = point;
  let bestDistance = radiusMm;
  for (const vertex of vertices) {
    const next = distance(point, vertex);
    if (next < bestDistance) {
      best = vertex;
      bestDistance = next;
    }
  }
  for (const edge of edges) {
    const candidate = closestPointOnSegment(point, edge.a, edge.b);
    const next = distance(point, candidate);
    if (next < bestDistance) {
      best = candidate;
      bestDistance = next;
    }
  }
  return best;
}

export function measureDeltas(a: MeasureVec3, b: MeasureVec3): {
  dx: number;
  dy: number;
  dz: number;
  distance: number;
} {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return { dx, dy, dz, distance: Math.hypot(dx, dy, dz) };
}

export function isAxisAligned(a: MeasureVec3, b: MeasureVec3, epsilonMm = 0.5): boolean {
  const { dx, dy, dz } = measureDeltas(a, b);
  const nonzero = AXES.filter((axis) => Math.abs(axis === 'x' ? dx : axis === 'y' ? dy : dz) > epsilonMm);
  return nonzero.length <= 1;
}
