/**
 * IKEA AXSTAD glass-door profile: a 19 mm shaker frame with ~78 mm stiles
 * (3 1/16") and an inset glass pane. Layout is in millimetres and independent
 * of three.js so a resize keeps the frame width instead of stretching it.
 */

export const AXSTAD_FRAME_MM = 78;
export const AXSTAD_GLASS_MM = 4;
/** How far the glass sits behind the front face, so the inner stile reads as a rebate. */
export const AXSTAD_GLASS_INSET_MM = 5;
const MIN_OPENING_MM = 40;

export type DoorPieceRole = 'frame' | 'glass' | 'muntin';

export type DoorPiece = {
  role: DoorPieceRole;
  size: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

function frameWidth(w: number, h: number, frameMm: number): number {
  const budget = (Math.min(w, h) - MIN_OPENING_MM) / 2;
  return Math.max(12, Math.min(frameMm, budget));
}

/**
 * Stiles, rails and inset glass for a framed glass door centred on the origin.
 * Rails sit between the stiles so the corners are a single thickness.
 */
export function framedGlassPieces(
  w: number,
  h: number,
  d: number,
  frameMm: number,
): DoorPiece[] {
  const frame = frameWidth(w, h, frameMm);
  const innerW = Math.max(MIN_OPENING_MM, w - 2 * frame);
  const innerH = Math.max(MIN_OPENING_MM, h - 2 * frame);
  const front = d / 2;
  const glassZ = front - AXSTAD_GLASS_INSET_MM - AXSTAD_GLASS_MM / 2;
  return [
    {
      role: 'frame',
      size: { x: frame, y: h, z: d },
      position: { x: -w / 2 + frame / 2, y: 0, z: 0 },
    },
    {
      role: 'frame',
      size: { x: frame, y: h, z: d },
      position: { x: w / 2 - frame / 2, y: 0, z: 0 },
    },
    {
      role: 'frame',
      size: { x: innerW, y: frame, z: d },
      position: { x: 0, y: h / 2 - frame / 2, z: 0 },
    },
    {
      role: 'frame',
      size: { x: innerW, y: frame, z: d },
      position: { x: 0, y: -h / 2 + frame / 2, z: 0 },
    },
    {
      role: 'glass',
      size: { x: innerW, y: innerH, z: AXSTAD_GLASS_MM },
      position: { x: 0, y: 0, z: glassZ },
    },
  ];
}

/**
 * Stiles, rails and inset glass for an AXSTAD-style door centred on the origin.
 */
export function axstadGlassPieces(w: number, h: number, d: number): DoorPiece[] {
  return framedGlassPieces(w, h, d, AXSTAD_FRAME_MM);
}
