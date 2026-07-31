import type { Transform } from './types';

export type EulerDegrees = { x: number; y: number; z: number };

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Quaternion [x,y,z,w] to Euler angles (intrinsic XYZ order), in degrees.
 *
 * Implemented by hand rather than importing three.js — domain code never
 * imports three.js at runtime — but mirrors three.js's own Euler/Quaternion
 * conversion exactly, so a value here matches what the gizmo would show for
 * the same rotation.
 */
export function quaternionToEulerDegrees(q: Transform['quaternion']): EulerDegrees {
  const [x, y, z, w] = q;

  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - z * w);
  const m13 = 2 * (x * z + y * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m32 = 2 * (y * z + x * w);
  const m33 = 1 - 2 * (x * x + y * y);

  const ey = Math.asin(clamp(m13, -1, 1));
  let ex: number;
  let ez: number;
  // Near the gimbal-lock pole, x and z rotations become indistinguishable —
  // fold the ambiguity into x and report z as 0, as three.js does.
  if (Math.abs(m13) < 0.9999999) {
    ex = Math.atan2(-m23, m33);
    ez = Math.atan2(-m12, m11);
  } else {
    ex = Math.atan2(m32, m22);
    ez = 0;
  }

  return { x: ex * RAD_TO_DEG, y: ey * RAD_TO_DEG, z: ez * RAD_TO_DEG };
}

/** Euler angles (intrinsic XYZ order), in degrees, to a quaternion [x,y,z,w]. */
export function eulerDegreesToQuaternion(euler: EulerDegrees): Transform['quaternion'] {
  const ex = (euler.x * DEG_TO_RAD) / 2;
  const ey = (euler.y * DEG_TO_RAD) / 2;
  const ez = (euler.z * DEG_TO_RAD) / 2;

  const c1 = Math.cos(ex);
  const s1 = Math.sin(ex);
  const c2 = Math.cos(ey);
  const s2 = Math.sin(ey);
  const c3 = Math.cos(ez);
  const s3 = Math.sin(ez);

  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}
