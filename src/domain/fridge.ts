/**
 * Placeholder appliance geometry: a slab body with two front doors and a
 * shadow gap between them, so a fridge reads as a fridge in a layout without
 * anyone modelling one. Layout is in millimetres and independent of three.js,
 * and the door faces are clamped rather than scaled — resizing a 60×184×66
 * placeholder keeps its 20 mm fronts instead of stretching them.
 */

/** Thickness of each door slab, so the seam between them catches a shadow. */
export const FRIDGE_FACE_MM = 20;
/** Gap between the fridge and freezer doors. */
export const FRIDGE_GAP_MM = 4;
/** Freezer share of the overall height — a bottom-freezer 60 cm unit. */
const FREEZER_FRACTION = 0.35;
const MIN_PIECE_MM = 2;

export type FridgePieceRole = 'body' | 'door';

export type FridgePiece = {
  role: FridgePieceRole;
  size: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

/**
 * Body and two doors for a placeholder fridge centred on the origin. The body
 * is set back by one face thickness, so the gap between the doors shows body
 * behind it rather than a hole.
 */
export function fridgePieces(w: number, h: number, d: number): FridgePiece[] {
  const face = Math.max(MIN_PIECE_MM, Math.min(FRIDGE_FACE_MM, d / 4));
  const gap = Math.max(0, Math.min(FRIDGE_GAP_MM, h / 50));
  const lower = Math.max(MIN_PIECE_MM, Math.min(h - gap - MIN_PIECE_MM, (h - gap) * FREEZER_FRACTION));
  const upper = Math.max(MIN_PIECE_MM, h - gap - lower);
  const faceZ = d / 2 - face / 2;
  return [
    {
      role: 'body',
      size: { x: w, y: h, z: d - face },
      position: { x: 0, y: 0, z: -face / 2 },
    },
    {
      role: 'door',
      size: { x: w, y: upper, z: face },
      position: { x: 0, y: h / 2 - upper / 2, z: faceZ },
    },
    {
      role: 'door',
      size: { x: w, y: lower, z: face },
      position: { x: 0, y: -h / 2 + lower / 2, z: faceZ },
    },
  ];
}
