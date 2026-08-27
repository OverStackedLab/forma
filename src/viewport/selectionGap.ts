export type Axis = 'x' | 'y' | 'z';
export type Vec3 = { x: number; y: number; z: number };
export type Aabb = { min: Vec3; max: Vec3 };

export type GapDimension = {
  axis: Axis;
  gapMm: number;
  line: [Vec3, Vec3];
  witnessA: [Vec3, Vec3];
  witnessB: [Vec3, Vec3];
  tickA: [Vec3, Vec3];
  tickB: [Vec3, Vec3];
};

const AXES: readonly Axis[] = ['x', 'y', 'z'];
/** Keep the dimension outside the panels so it reads in the default ¾ view. */
const OFFSET_M = 0.06;
const TICK_M = 0.014;
/** Ignore hairline separations from float error. */
const MIN_GAP_M = 0.0005;

function setAxis(base: Vec3, axis: Axis, value: number): Vec3 {
  return { ...base, [axis]: value };
}

/** Midpoint of the overlapping span, or the average of the two centres. */
export function sharedOnAxis(a: Aabb, b: Aabb, axis: Axis): number {
  const lo = Math.max(a.min[axis], b.min[axis]);
  const hi = Math.min(a.max[axis], b.max[axis]);
  if (lo <= hi) return (lo + hi) / 2;
  return ((a.min[axis] + a.max[axis]) / 2 + (b.min[axis] + b.max[axis]) / 2) / 2;
}

/**
 * Positive clearance between two AABBs on one axis, and the facing bounds.
 * Overlap returns null — those faces are not a gap.
 */
export function axisGap(
  a: Aabb,
  b: Aabb,
  axis: Axis,
): { low: number; high: number; gapM: number } | null {
  if (a.max[axis] + MIN_GAP_M <= b.min[axis]) {
    return { low: a.max[axis], high: b.min[axis], gapM: b.min[axis] - a.max[axis] };
  }
  if (b.max[axis] + MIN_GAP_M <= a.min[axis]) {
    return { low: b.max[axis], high: a.min[axis], gapM: a.min[axis] - b.max[axis] };
  }
  return null;
}

/** Offset X and Y gaps toward +Z (front); Z gaps toward +X (right). */
function offsetAxis(gapAxis: Axis): Axis {
  return gapAxis === 'z' ? 'x' : 'z';
}

function tickAxis(gapAxis: Axis, along: Axis): Axis {
  return AXES.find((axis) => axis !== gapAxis && axis !== along) ?? 'y';
}

function overlapsOnAxis(a: Aabb, b: Aabb, axis: Axis): boolean {
  return Math.max(a.min[axis], b.min[axis]) <= Math.min(a.max[axis], b.max[axis]);
}

/** True when the boxes share a facing span on the other two axes. */
export function facesOnAxis(a: Aabb, b: Aabb, gapAxis: Axis): boolean {
  return AXES.every((axis) => axis === gapAxis || overlapsOnAxis(a, b, axis));
}

function dimensionOnAxis(a: Aabb, b: Aabb, axis: Axis): GapDimension | null {
  const gap = axisGap(a, b, axis);
  if (!gap) return null;
  const along = offsetAxis(axis);
  const tick = tickAxis(axis, along);
  const mid: Vec3 = { x: 0, y: 0, z: 0 };
  for (const tangent of AXES) {
    if (tangent === axis) continue;
    mid[tangent] = sharedOnAxis(a, b, tangent);
  }
  const outer = Math.max(a.max[along], b.max[along]) + OFFSET_M;
  const face: Vec3 = setAxis(mid, along, mid[along]);
  const dim: Vec3 = setAxis(mid, along, outer);
  const start = setAxis(dim, axis, gap.low);
  const end = setAxis(dim, axis, gap.high);
  const faceA = setAxis(face, axis, gap.low);
  const faceB = setAxis(face, axis, gap.high);
  return {
    axis,
    gapMm: gap.gapM * 1000,
    line: [start, end],
    witnessA: [faceA, start],
    witnessB: [faceB, end],
    tickA: [setAxis(start, tick, start[tick] - TICK_M / 2), setAxis(start, tick, start[tick] + TICK_M / 2)],
    tickB: [setAxis(end, tick, end[tick] - TICK_M / 2), setAxis(end, tick, end[tick] + TICK_M / 2)],
  };
}

/** SketchUp-style witnesses for every axis where the two boxes are separated. */
export function gapsBetweenBoxes(a: Aabb, b: Aabb): GapDimension[] {
  const out: GapDimension[] = [];
  for (const axis of AXES) {
    const dimension = dimensionOnAxis(a, b, axis);
    if (dimension) out.push(dimension);
  }
  return out;
}

/**
 * Nearest clearance from `selected` in each direction. Neighbours that share
 * a facing span on the other two axes win; if none face, the closest on that
 * axis is used so a lifted panel still reads the one beside it.
 */
export function nearestFacingGaps(selected: Aabb, others: readonly Aabb[]): GapDimension[] {
  const out: GapDimension[] = [];
  for (const axis of AXES) {
    const below = nearestOnSide(selected, others, axis, 'below');
    const above = nearestOnSide(selected, others, axis, 'above');
    if (below) {
      const dimension = dimensionOnAxis(selected, below, axis);
      if (dimension) out.push(dimension);
    }
    if (above) {
      const dimension = dimensionOnAxis(selected, above, axis);
      if (dimension) out.push(dimension);
    }
  }
  return out;
}

function nearestOnSide(
  selected: Aabb,
  others: readonly Aabb[],
  axis: Axis,
  side: 'below' | 'above',
): Aabb | null {
  let facing: Aabb | null = null;
  let facingGap = Infinity;
  let closest: Aabb | null = null;
  let closestGap = Infinity;
  for (const other of others) {
    const gap = axisGap(selected, other, axis);
    if (!gap) continue;
    const isBelow = other.max[axis] <= selected.min[axis];
    if (side === 'below' ? !isBelow : isBelow) continue;
    if (gap.gapM < closestGap) {
      closest = other;
      closestGap = gap.gapM;
    }
    if (facesOnAxis(selected, other, axis) && gap.gapM < facingGap) {
      facing = other;
      facingGap = gap.gapM;
    }
  }
  return facing ?? closest;
}
