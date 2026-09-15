/**
 * IKEA MATMÄSSIG induction hob (104.670.93): a 590×520 mm glass top, 49 mm
 * deep overall, dropping into a 560×490 mm worktop cutout, with four zones of
 * 210 / 180 / 180 / 145 mm. Layout is in millimetres and independent of
 * three.js. The glass and the zone relief are clamped on resize while the zone
 * diameters stay proportional, so a wider hob reads as a wider hob rather than
 * a stretched one.
 */

/** Glass top proud of the worktop. */
export const HOB_GLASS_MM = 6;
/** How far a cooking zone stands above the glass, so the ring catches light. */
export const HOB_ZONE_RELIEF_MM = 1;
/** Rim of glass around the cutout — 15 mm each side on the 59 cm top. */
const HOB_RIM_MM = 15;
const MIN_PIECE_MM = 2;

/** Zone diameters as a fraction of the 590 mm top, front-left round to front-right. */
const ZONES = [
  { fx: -0.25, fz: 0.25, diameter: 210 / 590 },
  { fx: -0.25, fz: -0.25, diameter: 180 / 590 },
  { fx: 0.25, fz: -0.25, diameter: 180 / 590 },
  { fx: 0.25, fz: 0.25, diameter: 145 / 590 },
] as const;

export type HobPieceRole = 'body' | 'glass' | 'zone';

export type HobPiece = {
  role: HobPieceRole;
  size: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

/**
 * Cutout body, glass top and four zone discs for a hob centred on the origin,
 * lying flat with its thickness on Y. Zones sit on top of the glass and the
 * body hangs below it, all within the nominal height.
 */
export function hobPieces(w: number, h: number, d: number): HobPiece[] {
  const relief = Math.max(0, Math.min(HOB_ZONE_RELIEF_MM, h / 8));
  const glass = Math.max(MIN_PIECE_MM, Math.min(HOB_GLASS_MM, (h - relief) / 2));
  const bodyH = Math.max(MIN_PIECE_MM, h - relief - glass);
  const rim = Math.min(HOB_RIM_MM, w / 8, d / 8);
  const glassTop = h / 2 - relief;

  const pieces: HobPiece[] = [
    {
      role: 'body',
      size: { x: w - 2 * rim, y: bodyH, z: d - 2 * rim },
      position: { x: 0, y: -h / 2 + bodyH / 2, z: 0 },
    },
    {
      role: 'glass',
      size: { x: w, y: glass, z: d },
      position: { x: 0, y: glassTop - glass / 2, z: 0 },
    },
  ];

  // Keep a zone inside its own quarter of the top, whatever the hob is resized to.
  const widest = Math.min(w / 2, d / 2) * 0.94;
  for (const zone of ZONES) {
    const diameter = Math.max(MIN_PIECE_MM, Math.min(zone.diameter * w, widest));
    pieces.push({
      role: 'zone',
      size: { x: diameter, y: relief, z: diameter },
      position: { x: zone.fx * w, y: glassTop + relief / 2, z: zone.fz * d },
    });
  }
  return pieces;
}
