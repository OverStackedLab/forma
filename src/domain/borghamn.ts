/**
 * IKEA BORGHAMN (203.160.46): 10×10 mm square-profile bar bent into a U,
 * 170 mm overall, 36 mm projection, 160 mm hole centres.
 *
 * Layout is in millimetres so geometry and tests share one source of truth.
 * The unit mesh is packed into a 1×1×1 box; part scale recovers these sizes.
 */

export const BORGHAMN_LENGTH_MM = 170;
export const BORGHAMN_BAR_MM = 10;
export const BORGHAMN_PROJECTION_MM = 36;
export const BORGHAMN_CENTRES_MM = 160;
/** Centerline radius at each 90° bend — tight, like the stamped steel pull. */
export const BORGHAMN_BEND_MM = 8;
export const BORGHAMN_FOOT_MM = 2.4;

export type Point3 = { x: number; y: number; z: number };

/**
 * Centerline of the square bar. Door face is z = 0; the outer face of the
 * grip sits at {@link BORGHAMN_PROJECTION_MM}. Feet sit on the hole centres.
 */
export function borghamnCenterline(): Point3[] {
  const half = BORGHAMN_CENTRES_MM / 2;
  const barHalf = BORGHAMN_BAR_MM / 2;
  const zFoot = barHalf;
  const zGrip = BORGHAMN_PROJECTION_MM - barHalf;
  const r = BORGHAMN_BEND_MM;
  return [
    { x: -half, y: 0, z: zFoot },
    { x: -half, y: 0, z: zGrip - r },
    { x: -half + r, y: 0, z: zGrip },
    { x: half - r, y: 0, z: zGrip },
    { x: half, y: 0, z: zGrip - r },
    { x: half, y: 0, z: zFoot },
  ];
}
