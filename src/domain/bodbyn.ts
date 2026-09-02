/**
 * IKEA BODBYN off-white fronts: a 19 mm door with ~70 mm stiles. Solid fronts
 * use a bevelled inner rebate and recessed centre panel; glass fronts keep the
 * same frame with an inset pane (and an optional + muntin). Layout is in
 * millimetres so a resize keeps the frame instead of stretching it.
 */

import { framedGlassPieces, type DoorPiece } from './glassDoor';

export const BODBYN_FRAME_MM = 70;
export const BODBYN_BEVEL_WIDTH_MM = 14;
export const BODBYN_BEVEL_THICKNESS_MM = 12;
/** How far the bevel step sits behind the front face. */
export const BODBYN_BEVEL_INSET_MM = 3;
export const BODBYN_PANEL_MM = 8;
/** How far the recessed panel sits behind the front face. */
export const BODBYN_PANEL_INSET_MM = 7;
/** Cross-rail on the 40×40 glass door (üvegajtó keresztléccel). */
export const BODBYN_MUNTIN_MM = 18;
const MIN_OPENING_MM = 40;

export type BodbynPieceRole = 'frame' | 'bevel' | 'panel';

export type BodbynPiece = {
  role: BodbynPieceRole;
  size: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

function frameWidth(w: number, h: number): number {
  const budget = (Math.min(w, h) - MIN_OPENING_MM) / 2;
  return Math.max(12, Math.min(BODBYN_FRAME_MM, budget));
}

function bevelWidth(w: number, h: number, frame: number): number {
  const remaining = (Math.min(w, h) - 2 * frame - MIN_OPENING_MM) / 2;
  return Math.max(0, Math.min(BODBYN_BEVEL_WIDTH_MM, remaining));
}

/**
 * Stiles, rails, bevel rebate and recessed panel for a BODBYN-style door
 * centred on the origin. Rails sit between the stiles so the corners are a
 * single thickness. The four bevel pieces are always present; on a tiny door
 * their width collapses to 0 and the renderer hides them.
 */
export function bodbynPieces(w: number, h: number, d: number): BodbynPiece[] {
  const frame = frameWidth(w, h);
  const bevel = bevelWidth(w, h, frame);
  const innerW = Math.max(MIN_OPENING_MM, w - 2 * frame);
  const innerH = Math.max(MIN_OPENING_MM, h - 2 * frame);
  const panelW = Math.max(MIN_OPENING_MM, innerW - 2 * bevel);
  const panelH = Math.max(MIN_OPENING_MM, innerH - 2 * bevel);
  const front = d / 2;
  const bevelZ = front - BODBYN_BEVEL_INSET_MM - BODBYN_BEVEL_THICKNESS_MM / 2;
  const panelZ = front - BODBYN_PANEL_INSET_MM - BODBYN_PANEL_MM / 2;
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
      role: 'bevel',
      size: { x: bevel, y: innerH, z: BODBYN_BEVEL_THICKNESS_MM },
      position: { x: -w / 2 + frame + bevel / 2, y: 0, z: bevelZ },
    },
    {
      role: 'bevel',
      size: { x: bevel, y: innerH, z: BODBYN_BEVEL_THICKNESS_MM },
      position: { x: w / 2 - frame - bevel / 2, y: 0, z: bevelZ },
    },
    {
      role: 'bevel',
      size: { x: panelW, y: bevel, z: BODBYN_BEVEL_THICKNESS_MM },
      position: { x: 0, y: innerH / 2 - bevel / 2, z: bevelZ },
    },
    {
      role: 'bevel',
      size: { x: panelW, y: bevel, z: BODBYN_BEVEL_THICKNESS_MM },
      position: { x: 0, y: -innerH / 2 + bevel / 2, z: bevelZ },
    },
    {
      role: 'panel',
      size: { x: panelW, y: panelH, z: BODBYN_PANEL_MM },
      position: { x: 0, y: 0, z: panelZ },
    },
  ];
}

/**
 * BODBYN glass door: the same 70 mm frame as the solid front, with an inset
 * pane. `muntin` adds a + cross-rail in the opening, as on the 40×40
 * keresztléces glass door.
 */
export function bodbynGlassPieces(w: number, h: number, d: number, muntin = false): DoorPiece[] {
  const pieces = framedGlassPieces(w, h, d, BODBYN_FRAME_MM);
  if (!muntin) return pieces;
  const glass = pieces.find((piece) => piece.role === 'glass');
  if (!glass) return pieces;
  return [
    ...pieces,
    {
      role: 'muntin',
      size: { x: BODBYN_MUNTIN_MM, y: glass.size.y, z: d },
      position: { x: 0, y: glass.position.y, z: 0 },
    },
    {
      role: 'muntin',
      size: { x: glass.size.x, y: BODBYN_MUNTIN_MM, z: d },
      position: { x: glass.position.x, y: 0, z: 0 },
    },
  ];
}
