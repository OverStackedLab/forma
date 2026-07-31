import { describe, expect, it } from 'vitest';
import { eulerDegreesToQuaternion, quaternionToEulerDegrees } from './rotation';

const IDENTITY = { x: 0, y: 0, z: 0 };

function expectCloseEuler(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  expect(a.x).toBeCloseTo(b.x, 4);
  expect(a.y).toBeCloseTo(b.y, 4);
  expect(a.z).toBeCloseTo(b.z, 4);
}

describe('eulerDegreesToQuaternion', () => {
  it('maps identity to the identity quaternion', () => {
    expect(eulerDegreesToQuaternion(IDENTITY)).toEqual([0, 0, 0, 1]);
  });

  it('matches the known quaternion for a 90° Z rotation', () => {
    const [x, y, z, w] = eulerDegreesToQuaternion({ x: 0, y: 0, z: 90 });
    const s = Math.SQRT1_2;
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(s, 6);
    expect(w).toBeCloseTo(s, 6);
  });
});

describe('quaternionToEulerDegrees', () => {
  it('maps the identity quaternion back to zero', () => {
    expectCloseEuler(quaternionToEulerDegrees([0, 0, 0, 1]), IDENTITY);
  });
});

describe('round-trip', () => {
  const cases: { x: number; y: number; z: number }[] = [
    { x: 0, y: 0, z: 0 },
    { x: 90, y: 0, z: 0 },
    { x: 0, y: 45, z: 0 },
    { x: 0, y: 0, z: -90 },
    { x: 30, y: 20, z: 10 },
    { x: -45, y: 60, z: 15 },
    { x: 120, y: 8, z: -35 },
  ];

  it.each(cases)('recovers the original angles for %j', (euler) => {
    const q = eulerDegreesToQuaternion(euler);
    expectCloseEuler(quaternionToEulerDegrees(q), euler);
  });

  it('produces a unit quaternion for an arbitrary rotation', () => {
    const [x, y, z, w] = eulerDegreesToQuaternion({ x: 37, y: -52, z: 81 });
    expect(x * x + y * y + z * z + w * w).toBeCloseTo(1, 10);
  });
});
