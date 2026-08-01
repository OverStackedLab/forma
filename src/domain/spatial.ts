import type { Transform } from './types';

export type Size3 = { w: number; h: number; d: number };
export type Vector3 = { x: number; y: number; z: number };

/** Rotates a vector by a [x,y,z,w] quaternion without importing three.js. */
export function rotateVectorByQuaternion(v: Vector3, q: Transform['quaternion']): Vector3 {
  const [qx, qy, qz, qw] = q;
  const ix = qw * v.x + qy * v.z - qz * v.y;
  const iy = qw * v.y + qz * v.x - qx * v.z;
  const iz = qw * v.z + qx * v.y - qy * v.x;
  const iw = -qx * v.x - qy * v.y - qz * v.z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

/** World-axis AABB half-extents of a locally sized and rotated part, in millimetres. */
export function orientedHalfExtentsMm(
  size: Size3,
  quaternion: Transform['quaternion'],
  scale: Transform['scale'] = [1, 1, 1],
): Vector3 {
  const hx = Math.abs(size.w * scale[0]) / 2;
  const hy = Math.abs(size.h * scale[1]) / 2;
  const hz = Math.abs(size.d * scale[2]) / 2;
  const xAxis = rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, quaternion);
  const yAxis = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
  const zAxis = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, quaternion);
  return {
    x: Math.abs(xAxis.x) * hx + Math.abs(yAxis.x) * hy + Math.abs(zAxis.x) * hz,
    y: Math.abs(xAxis.y) * hx + Math.abs(yAxis.y) * hy + Math.abs(zAxis.y) * hz,
    z: Math.abs(xAxis.z) * hx + Math.abs(yAxis.z) * hy + Math.abs(zAxis.z) * hz,
  };
}

/** Support distance from a part centre to its oriented box along a world-space normal. */
export function halfExtentAlongNormalMm(
  size: Size3,
  quaternion: Transform['quaternion'],
  normal: Vector3,
): number {
  const xAxis = rotateVectorByQuaternion({ x: 1, y: 0, z: 0 }, quaternion);
  const yAxis = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, quaternion);
  const zAxis = rotateVectorByQuaternion({ x: 0, y: 0, z: 1 }, quaternion);
  const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
  return (
    Math.abs(dot(normal, xAxis)) * size.w / 2 +
    Math.abs(dot(normal, yAxis)) * size.h / 2 +
    Math.abs(dot(normal, zAxis)) * size.d / 2
  );
}
