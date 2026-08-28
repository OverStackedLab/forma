export type Axis = 'x' | 'y' | 'z';
export type Vec3 = { x: number; y: number; z: number };
export type Aabb = { min: Vec3; max: Vec3 };

export type GapDimension = {
  axis: Axis;
  gapMm: number;
  /** True when the part that should move sits on the high side of the gap. */
  movableIsHigh: boolean;
  /** Overall size of one box; gaps are clearances; align is a flush face. */
  kind: 'gap' | 'overall' | 'align';
  line: [Vec3, Vec3];
  witnessA: [Vec3, Vec3];
  witnessB: [Vec3, Vec3];
  tickA: [Vec3, Vec3];
  tickB: [Vec3, Vec3];
};

const AXES: readonly Axis[] = ['x', 'y', 'z'];
/** Keep the dimension outside the panels so it reads in the default ¾ view. */
const OFFSET_M = 0.06;
/** Sit outside clearance witnesses so overall W/H/D do not stack on a gap. */
const OVERALL_OFFSET_M = 0.12;
const TICK_M = 0.014;
/** Ignore hairline separations from float error. */
const MIN_GAP_M = 0.0005;
/** Treat a tiny overlap as flush so a settled snap does not go quiet. */
const ALIGN_TOLERANCE_M = 0.002;

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

export type AxisRelation = {
  low: number;
  high: number;
  gapM: number;
  kind: 'gap' | 'align';
};

/**
 * Facing separation on one axis. A real clearance is a gap; faces within a
 * hairline (including a millimetre or two of float overlap) are flush
 * alignment. A deeper intersection is not a dimension.
 */
export function axisRelation(a: Aabb, b: Aabb, axis: Axis): AxisRelation | null {
  const sepAB = b.min[axis] - a.max[axis];
  const sepBA = a.min[axis] - b.max[axis];
  const aThenB = sepAB >= sepBA;
  const facingSep = aThenB ? sepAB : sepBA;
  const lowFace = aThenB ? a.max[axis] : b.max[axis];
  const highFace = aThenB ? b.min[axis] : a.min[axis];
  const low = Math.min(lowFace, highFace);
  const high = Math.max(lowFace, highFace);
  if (facingSep >= MIN_GAP_M) return { low, high, gapM: facingSep, kind: 'gap' };
  if (facingSep >= -ALIGN_TOLERANCE_M) return { low, high, gapM: 0, kind: 'align' };
  return null;
}

/**
 * Positive clearance between two AABBs on one axis, and the facing bounds.
 * Flush or overlapping faces return null — those are not a gap.
 */
export function axisGap(
  a: Aabb,
  b: Aabb,
  axis: Axis,
): { low: number; high: number; gapM: number } | null {
  const relation = axisRelation(a, b, axis);
  if (!relation || relation.kind !== 'gap') return null;
  return { low: relation.low, high: relation.high, gapM: relation.gapM };
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

function dimensionOnAxis(a: Aabb, b: Aabb, axis: Axis, movable: 'a' | 'b'): GapDimension | null {
  const relation = axisRelation(a, b, axis);
  if (!relation) return null;
  if (relation.kind === 'align') {
    return alignmentFromPlane(a, b, axis, (relation.low + relation.high) / 2, movable);
  }
  return dimensionFromRelation(a, b, axis, relation, movable);
}

function dimensionFromRelation(
  a: Aabb,
  b: Aabb,
  axis: Axis,
  relation: AxisRelation,
  movable: 'a' | 'b',
): GapDimension {
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
  const start = setAxis(dim, axis, relation.low);
  const end = setAxis(dim, axis, relation.high);
  const faceA = setAxis(face, axis, relation.low);
  const faceB = setAxis(face, axis, relation.high);
  const movableBox = movable === 'a' ? a : b;
  const fixedBox = movable === 'a' ? b : a;
  const movableMid = (movableBox.min[axis] + movableBox.max[axis]) / 2;
  const fixedMid = (fixedBox.min[axis] + fixedBox.max[axis]) / 2;
  return {
    axis,
    gapMm: relation.gapM * 1000,
    movableIsHigh: movableMid > fixedMid,
    kind: relation.kind,
    line: [start, end],
    witnessA: [faceA, start],
    witnessB: [faceB, end],
    tickA: [setAxis(start, tick, start[tick] - TICK_M / 2), setAxis(start, tick, start[tick] + TICK_M / 2)],
    tickB: [setAxis(end, tick, end[tick] - TICK_M / 2), setAxis(end, tick, end[tick] + TICK_M / 2)],
  };
}

/**
 * Brass alignment line at a shared plane. Spans the gap between the boxes, or
 * the overlapping seam when they touch, so the mark stays visible instead of
 * collapsing to a point the moment faces meet.
 */
function alignmentFromPlane(
  a: Aabb,
  b: Aabb,
  axis: Axis,
  plane: number,
  movable: 'a' | 'b',
): GapDimension {
  const along = offsetAxis(axis);
  let span = tickAxis(axis, along);
  let spanLo = Math.max(a.min[span], b.min[span]);
  let spanHi = Math.min(a.max[span], b.max[span]);
  for (const candidate of AXES) {
    if (candidate === axis) continue;
    const relation = axisRelation(a, b, candidate);
    if (relation?.kind !== 'gap') continue;
    span = candidate;
    spanLo = relation.low;
    spanHi = relation.high;
    break;
  }
  if (spanHi - spanLo < TICK_M) {
    const mid = (spanLo + spanHi) / 2;
    spanLo = mid - TICK_M / 2;
    spanHi = mid + TICK_M / 2;
  }
  const outer = Math.max(a.max[along], b.max[along]) + OFFSET_M;
  const inner = sharedOnAxis(a, b, along);
  const origin = setAxis(setAxis({ x: 0, y: 0, z: 0 }, axis, plane), along, outer);
  const start = setAxis(origin, span, spanLo);
  const end = setAxis(origin, span, spanHi);
  const faceA = setAxis(start, along, inner);
  const faceB = setAxis(end, along, inner);
  const movableBox = movable === 'a' ? a : b;
  const fixedBox = movable === 'a' ? b : a;
  const movableMid = (movableBox.min[axis] + movableBox.max[axis]) / 2;
  const fixedMid = (fixedBox.min[axis] + fixedBox.max[axis]) / 2;
  return {
    axis,
    gapMm: 0,
    movableIsHigh: movableMid > fixedMid,
    kind: 'align',
    line: [start, end],
    witnessA: [faceA, start],
    witnessB: [faceB, end],
    tickA: [setAxis(start, axis, start[axis] - TICK_M / 2), setAxis(start, axis, start[axis] + TICK_M / 2)],
    tickB: [setAxis(end, axis, end[axis] - TICK_M / 2), setAxis(end, axis, end[axis] + TICK_M / 2)],
  };
}

/**
 * World millimetres to translate the movable box so the gap becomes `targetGapMm`.
 * Negative targets are rejected; overlapping boxes have no gap to edit.
 */
export function gapDeltaMm(
  movableIsHigh: boolean,
  currentGapMm: number,
  targetGapMm: number,
): number | null {
  if (!Number.isFinite(targetGapMm) || targetGapMm < 0) return null;
  if (!Number.isFinite(currentGapMm)) return null;
  const delta = targetGapMm - currentGapMm;
  return movableIsHigh ? delta : -delta;
}

/**
 * Overall width, height, and depth of one AABB. Lines sit on the
 * bottom-front / right-front / bottom-right so they read in the default ¾ view.
 */
export function overallDimensions(box: Aabb): GapDimension[] {
  return AXES.map((axis) => overallOnAxis(box, axis));
}

function overallOnAxis(box: Aabb, axis: Axis): GapDimension {
  const along = offsetAxis(axis);
  const tick = tickAxis(axis, along);
  const remaining = AXES.find((candidate) => candidate !== axis && candidate !== along) ?? 'y';
  const remainingValue = remaining === 'y' ? box.min[remaining] : box.max[remaining];
  const outer = box.max[along] + OVERALL_OFFSET_M;
  const origin = setAxis(setAxis({ x: 0, y: 0, z: 0 }, remaining, remainingValue), along, outer);
  const start = setAxis(origin, axis, box.min[axis]);
  const end = setAxis(origin, axis, box.max[axis]);
  const faceA = setAxis(start, along, box.max[along]);
  const faceB = setAxis(end, along, box.max[along]);
  return {
    axis,
    gapMm: (box.max[axis] - box.min[axis]) * 1000,
    movableIsHigh: true,
    kind: 'overall',
    line: [start, end],
    witnessA: [faceA, start],
    witnessB: [faceB, end],
    tickA: [setAxis(start, tick, start[tick] - TICK_M / 2), setAxis(start, tick, start[tick] + TICK_M / 2)],
    tickB: [setAxis(end, tick, end[tick] - TICK_M / 2), setAxis(end, tick, end[tick] + TICK_M / 2)],
  };
}

/** SketchUp-style witnesses for every axis where the two boxes face or flush. */
export function gapsBetweenBoxes(a: Aabb, b: Aabb): GapDimension[] {
  const out: GapDimension[] = [];
  for (const axis of AXES) {
    const dimension = dimensionOnAxis(a, b, axis, 'b');
    if (dimension) out.push(dimension);
  }
  return out;
}

/**
 * Nearest clearance or flush alignment from `selected` in each direction.
 * Neighbours that share a facing span on the other two axes win; if none
 * face, the closest on that axis is used so a lifted panel still reads the
 * one beside it.
 */
export function nearestFacingGaps(selected: Aabb, others: readonly Aabb[]): GapDimension[] {
  const out: GapDimension[] = [];
  for (const axis of AXES) {
    const below = nearestOnSide(selected, others, axis, 'below');
    const above = nearestOnSide(selected, others, axis, 'above');
    if (below) {
      const dimension = dimensionOnAxis(selected, below, axis, 'a');
      if (dimension) out.push(dimension);
    }
    if (above) {
      const dimension = dimensionOnAxis(selected, above, axis, 'a');
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
    const relation = axisRelation(selected, other, axis);
    if (!relation) continue;
    const isBelow = other.max[axis] <= selected.min[axis] + ALIGN_TOLERANCE_M;
    if (side === 'below' ? !isBelow : isBelow) continue;
    if (relation.gapM < closestGap) {
      closest = other;
      closestGap = relation.gapM;
    }
    if (facesOnAxis(selected, other, axis) && relation.gapM < facingGap) {
      facing = other;
      facingGap = relation.gapM;
    }
  }
  return facing ?? closest;
}

function sharesFootprint(a: Aabb, b: Aabb, alignAxis: Axis): boolean {
  return AXES.some((axis) => axis !== alignAxis && overlapsOnAxis(a, b, axis));
}

function centreDistanceSq(a: Aabb, b: Aabb): number {
  let sum = 0;
  for (const axis of AXES) {
    const delta = (a.min[axis] + a.max[axis] - (b.min[axis] + b.max[axis])) / 2;
    sum += delta * delta;
  }
  return sum;
}

function coplanarOnBound(
  a: Aabb,
  b: Aabb,
  axis: Axis,
  bound: 'min' | 'max',
  movable: 'a' | 'b',
): GapDimension | null {
  if (axisRelation(a, b, axis)) return null;
  if (!sharesFootprint(a, b, axis)) return null;
  if (Math.abs(a[bound][axis] - b[bound][axis]) > ALIGN_TOLERANCE_M) return null;
  const plane = (a[bound][axis] + b[bound][axis]) / 2;
  return alignmentFromPlane(a, b, axis, plane, movable);
}

/**
 * Matching min or max on an axis while the boxes still share a footprint —
 * Align Left / Tops style, not a facing clearance.
 */
export function coplanarAlignments(a: Aabb, b: Aabb, movable: 'a' | 'b' = 'b'): GapDimension[] {
  const out: GapDimension[] = [];
  for (const axis of AXES) {
    const lo = coplanarOnBound(a, b, axis, 'min', movable);
    const hi = coplanarOnBound(a, b, axis, 'max', movable);
    if (lo) out.push(lo);
    if (hi) out.push(hi);
  }
  return out;
}

/**
 * Nearest coplanar neighbour per axis and bound, so a moving group reads the
 * cabinet it is lining up with rather than every matching group in the scene.
 */
export function nearestCoplanarAlignments(selected: Aabb, others: readonly Aabb[]): GapDimension[] {
  const out: GapDimension[] = [];
  for (const axis of AXES) {
    for (const bound of ['min', 'max'] as const) {
      let best: Aabb | null = null;
      let bestDist = Infinity;
      for (const other of others) {
        if (!coplanarOnBound(selected, other, axis, bound, 'a')) continue;
        const dist = centreDistanceSq(selected, other);
        if (dist < bestDist) {
          best = other;
          bestDist = dist;
        }
      }
      if (!best) continue;
      const dimension = coplanarOnBound(selected, best, axis, bound, 'a');
      if (dimension) out.push(dimension);
    }
  }
  return out;
}
