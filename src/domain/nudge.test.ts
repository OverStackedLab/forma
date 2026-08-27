import { describe, expect, it } from 'vitest';
import { arrowNudgeDeltaMm, type NudgeFrame } from './nudge';

const FRONT: NudgeFrame = {
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  look: { x: 0, y: 0, z: -1 },
  plane: 'view',
};

const SIDE: NudgeFrame = {
  right: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
  look: { x: -1, y: 0, z: 0 },
  plane: 'view',
};

const TOP: NudgeFrame = {
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 0, z: -1 },
  look: { x: 0, y: -1, z: 0 },
  plane: 'floor',
};

const ANGLE: NudgeFrame = {
  right: { x: 0.73, y: 0, z: -0.68 },
  up: { x: 0, y: 1, z: 0 },
  look: { x: -0.64, y: -0.28, z: -0.71 },
  plane: 'floor',
};

describe('arrowNudgeDeltaMm', () => {
  it('moves in the Front view plane so Up raises a wall cabinet', () => {
    expect(arrowNudgeDeltaMm('ArrowRight', FRONT, 10)).toEqual({ x: 10, y: 0, z: 0 });
    expect(arrowNudgeDeltaMm('ArrowLeft', FRONT, 10)).toEqual({ x: -10, y: 0, z: 0 });
    expect(arrowNudgeDeltaMm('ArrowUp', FRONT, 10)).toEqual({ x: 0, y: 10, z: 0 });
    expect(arrowNudgeDeltaMm('ArrowDown', FRONT, 10)).toEqual({ x: 0, y: -10, z: 0 });
  });

  it('moves along depth in Side elevation', () => {
    expect(arrowNudgeDeltaMm('ArrowRight', SIDE, 10)).toEqual({ x: 0, y: 0, z: -10 });
    expect(arrowNudgeDeltaMm('ArrowUp', SIDE, 10)).toEqual({ x: 0, y: 10, z: 0 });
  });

  it('stays on the floor in Top and 3D so a nudge does not lift the piece', () => {
    expect(arrowNudgeDeltaMm('ArrowRight', TOP, 10)).toEqual({ x: 10, y: 0, z: 0 });
    expect(arrowNudgeDeltaMm('ArrowUp', TOP, 10)).toEqual({ x: 0, y: 0, z: -10 });
    expect(arrowNudgeDeltaMm('ArrowRight', ANGLE, 10).y).toBe(0);
    expect(arrowNudgeDeltaMm('ArrowUp', ANGLE, 10)).toEqual({ x: 0, y: 0, z: -10 });
  });
});
