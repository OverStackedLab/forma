export type NudgePlane = 'view' | 'floor';
export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export type NudgeVec3 = { x: number; y: number; z: number };

export type NudgeFrame = {
  right: NudgeVec3;
  up: NudgeVec3;
  look: NudgeVec3;
  plane: NudgePlane;
};

/** Same 100 mm step as Shift-held gizmo translation. */
export const NUDGE_GRID_MM = 100;

const ZERO: NudgeVec3 = { x: 0, y: 0, z: 0 };

export function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
}

function hypot3(v: NudgeVec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function flattenHorizontal(v: NudgeVec3): NudgeVec3 | null {
  const length = Math.hypot(v.x, v.z);
  if (length < 1e-6) return null;
  return { x: v.x / length, y: 0, z: v.z / length };
}

function axisUnit(v: NudgeVec3): NudgeVec3 {
  const length = hypot3(v);
  if (length < 1e-6) return ZERO;
  const x = Math.abs(v.x);
  const y = Math.abs(v.y);
  const z = Math.abs(v.z);
  if (x >= y && x >= z) return { x: v.x >= 0 ? 1 : -1, y: 0, z: 0 };
  if (y >= z) return { x: 0, y: v.y >= 0 ? 1 : -1, z: 0 };
  return { x: 0, y: 0, z: v.z >= 0 ? 1 : -1 };
}

function scale(v: NudgeVec3, stepMm: number): NudgeVec3 {
  return { x: v.x * stepMm || 0, y: v.y * stepMm || 0, z: v.z * stepMm || 0 };
}

/**
 * One world-axis millimetre step for an arrow key. Elevations follow the
 * view plane (Front Up is +Y). 3D and Top stay on the floor so a nudge does
 * not lift a cabinet off the grid.
 */
export function arrowNudgeDeltaMm(key: ArrowKey, frame: NudgeFrame, stepMm: number): NudgeVec3 {
  if (!Number.isFinite(stepMm) || stepMm === 0) return ZERO;

  const right =
    frame.plane === 'floor'
      ? axisUnit(flattenHorizontal(frame.right) ?? { x: 1, y: 0, z: 0 })
      : axisUnit(frame.right);
  const up =
    frame.plane === 'floor'
      ? axisUnit(flattenHorizontal(frame.look) ?? flattenHorizontal(frame.up) ?? { x: 0, y: 0, z: -1 })
      : axisUnit(frame.up);

  if (key === 'ArrowRight') return scale(right, stepMm);
  if (key === 'ArrowLeft') return scale(right, -stepMm);
  if (key === 'ArrowUp') return scale(up, stepMm);
  return scale(up, -stepMm);
}
