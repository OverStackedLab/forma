/**
 * Placeholder appliance geometry for an integrated dishwasher: a slab body
 * with one full-height front face, so it reads as a dishwasher in a layout
 * without modelling the racks. Layout is in millimetres and independent of
 * three.js; the door face thickness is clamped on resize.
 */

/** Thickness of the front face, so the body setback catches a shadow. */
export const DISHWASHER_FACE_MM = 20;
const MIN_PIECE_MM = 2;

export type DishwasherPieceRole = 'body' | 'door';

export type DishwasherPiece = {
  role: DishwasherPieceRole;
  size: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

/**
 * Body and one door for a placeholder dishwasher centred on the origin. The
 * body is set back by one face thickness so the door edge reads as a seam.
 */
export function dishwasherPieces(w: number, h: number, d: number): DishwasherPiece[] {
  const face = Math.max(MIN_PIECE_MM, Math.min(DISHWASHER_FACE_MM, d / 4));
  const faceZ = d / 2 - face / 2;
  return [
    {
      role: 'body',
      size: { x: w, y: h, z: d - face },
      position: { x: 0, y: 0, z: -face / 2 },
    },
    {
      role: 'door',
      size: { x: w, y: h, z: face },
      position: { x: 0, y: 0, z: faceZ },
    },
  ];
}
