import type { Finish, FinishId, PanelPreset } from './types';

export const FINISHES: readonly Finish[] = [
  { id: 'walnut', label: 'Walnut', color: '#4b3327', roughness: 0.55, metalness: 0.04 },
  { id: 'oak', label: 'White Oak', color: '#c7a374', roughness: 0.6, metalness: 0.03 },
  { id: 'ash', label: 'Ash', color: '#d9cdb6', roughness: 0.62, metalness: 0.02 },
  { id: 'ebony', label: 'Ebony Stain', color: '#211c19', roughness: 0.5, metalness: 0.04 },
  { id: 'lacquer', label: 'White Lacquer', color: '#eef0ea', roughness: 0.28, metalness: 0.0 },
];

/**
 * Insertable library panels — the only way to add geometry to the scene.
 * `h` is always the vertical (Y) extent and `d` the front-to-back (Z) extent,
 * with no rotation applied at insert — so a Shelf, which should lie flat,
 * stores its 18mm thickness as `h` and its 300mm depth as `d`, while the
 * upright panels store a tall `h` and a thin `d`.
 */
export const PANEL_PRESETS: readonly PanelPreset[] = [
  { id: 'shelf', label: 'Shelf', w: 800, h: 18, d: 300, icon: 'panel_shelf' },
  { id: 'flat', label: 'Side Panel', w: 600, h: 400, d: 18, icon: 'panel_flat' },
  { id: 'back', label: 'Back Panel', w: 800, h: 700, d: 8, icon: 'panel_back' },
  { id: 'divider', label: 'Divider', w: 400, h: 700, d: 18, icon: 'panel_divider' },
];

export const DEFAULT_FINISH_ID: FinishId = 'oak';

/**
 * Slider range for a panel's own W/H/D. Unlike a hard domain rule, this isn't
 * enforced anywhere else — setCustomPartDim only rejects non-positive values.
 * `h` and `d` each span thin-to-large, since which one carries a panel's
 * thickness vs. its depth/height depends on the preset (see PANEL_PRESETS).
 */
export const CUSTOM_PANEL_LIMITS = {
  w: { min: 50, max: 3000, step: 5 },
  h: { min: 3, max: 3000, step: 1 },
  d: { min: 3, max: 3000, step: 1 },
} as const;

/** 2440 × 1220 ply, with a yield factor for offcuts and saw kerf. */
export const SHEET = { width: 2440, height: 1220, yield: 0.82 } as const;

export function findFinish(id: string | undefined): Finish {
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0]!;
}

export function isFinishId(id: string): id is FinishId {
  return FINISHES.some((f) => f.id === id);
}
