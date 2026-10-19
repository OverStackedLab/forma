import { describe, expect, it } from 'vitest';
import {
  closestPointOnSegment,
  constrainMeasurePoint,
  dominantAxis,
  isAxisAligned,
  lockToAxis,
  measureDeltas,
  snapMeasurePoint,
  viewLockAxisFromLook,
} from './measure';

describe('viewLockAxisFromLook', () => {
  it('locks Z in a Front camera', () => {
    expect(viewLockAxisFromLook({ x: 0, y: 0, z: -1 })).toBe('z');
  });

  it('locks X in a Side camera', () => {
    expect(viewLockAxisFromLook({ x: -1, y: 0, z: 0 })).toBe('x');
  });

  it('locks Y in a Top camera', () => {
    expect(viewLockAxisFromLook({ x: 0, y: -1, z: 0 })).toBe('y');
  });
});

describe('constrainMeasurePoint', () => {
  it('copies the view-lock axis so an elevation click stays in plane', () => {
    const from = { x: 0, y: 0, z: 100 };
    const to = { x: 400, y: 20, z: 340 };
    expect(constrainMeasurePoint(from, to, { viewLockAxis: 'z' })).toEqual({
      x: 400, y: 20, z: 100,
    });
  });

  it('Shift-locks onto the dominant remaining axis after the view-plane copy', () => {
    const from = { x: 0, y: 0, z: 100 };
    const to = { x: 400, y: 30, z: 340 };
    expect(constrainMeasurePoint(from, to, { viewLockAxis: 'z', axisLock: true })).toEqual({
      x: 400, y: 0, z: 100,
    });
  });

  it('Shift-locks a 3D click onto a world axis', () => {
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 10, y: 400, z: 8 };
    expect(constrainMeasurePoint(from, to, { axisLock: true })).toEqual({
      x: 0, y: 400, z: 0,
    });
  });
});

describe('dominantAxis', () => {
  it('picks the largest world delta', () => {
    expect(dominantAxis({ x: 0, y: 0, z: 0 }, { x: 3, y: 9, z: 1 })).toBe('y');
  });
});

describe('lockToAxis', () => {
  it('keeps only the requested component from the second point', () => {
    expect(lockToAxis({ x: 1, y: 2, z: 3 }, { x: 9, y: 8, z: 7 }, 'x')).toEqual({
      x: 9, y: 2, z: 3,
    });
  });
});

describe('snapMeasurePoint', () => {
  it('prefers a nearby vertex over a face hit', () => {
    const point = { x: 2, y: 1, z: 0 };
    const snapped = snapMeasurePoint(
      point,
      [{ x: 2, y: 0.5, z: 0 }],
      [{ a: { x: 0, y: 0, z: 0 }, b: { x: 100, y: 0, z: 0 } }],
      20,
    );
    expect(snapped).toEqual({ x: 2, y: 0.5, z: 0 });
  });

  it('falls back to the closest point on an edge', () => {
    const snapped = snapMeasurePoint(
      { x: 50, y: 4, z: 0 },
      [],
      [{ a: { x: 0, y: 0, z: 0 }, b: { x: 100, y: 0, z: 0 } }],
      20,
    );
    expect(snapped).toEqual({ x: 50, y: 0, z: 0 });
  });

  it('leaves the hit alone when nothing is within radius', () => {
    const point = { x: 80, y: 80, z: 80 };
    expect(snapMeasurePoint(point, [{ x: 0, y: 0, z: 0 }], [], 20)).toEqual(point);
  });
});

describe('closestPointOnSegment', () => {
  it('clamps past the ends', () => {
    expect(closestPointOnSegment({ x: -10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }))
      .toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('measureDeltas', () => {
  it('reports signed components and the 3D length', () => {
    expect(measureDeltas({ x: 0, y: 0, z: 0 }, { x: 30, y: 40, z: 0 })).toEqual({
      dx: 30, dy: 40, dz: 0, distance: 50,
    });
  });
});

describe('isAxisAligned', () => {
  it('treats a near-horizontal span as aligned', () => {
    expect(isAxisAligned({ x: 0, y: 0, z: 0 }, { x: 400, y: 0.2, z: 0 })).toBe(true);
  });

  it('rejects a diagonal', () => {
    expect(isAxisAligned({ x: 0, y: 0, z: 0 }, { x: 400, y: 20, z: 0 })).toBe(false);
  });
});
