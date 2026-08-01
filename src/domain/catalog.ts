import type { Color, ColorId, Material, MaterialId, PanelPreset } from './types';

/** The wood species a part is milled from. Its own color/roughness shows through when the color is 'natural'. */
export const MATERIALS: readonly Material[] = [
  { id: 'walnut', label: 'Walnut', color: '#4b3327', roughness: 0.55, metalness: 0.04 },
  { id: 'oak', label: 'White Oak', color: '#c7a374', roughness: 0.6, metalness: 0.03 },
  { id: 'ash', label: 'Ash', color: '#d9cdb6', roughness: 0.62, metalness: 0.02 },
];

/** A stain or paint applied over a material. Natural leaves the material's own look untouched. */
export const COLORS: readonly Color[] = [
  { id: 'natural', label: 'Natural', tint: null },
  { id: 'ebony', label: 'Ebony Stain', tint: '#211c19', roughness: 0.5, metalness: 0.04 },
  { id: 'white', label: 'White Lacquer', tint: '#eef0ea', roughness: 0.28, metalness: 0.0 },
];

/**
 * Insertable library panels — the only way to add geometry to the scene.
 * `h` is always the vertical (Y) extent and `d` the front-to-back (Z) extent,
 * with no rotation applied at insert — so a Shelf, which should lie flat,
 * stores its 18mm thickness as `h` and its 300mm depth as `d`, while the
 * upright panels store a tall `h` and a thin `d`. A Knob is a cylinder: `w`
 * and `d` are its diameter (X and Z radii) and `h` is how far it projects.
 */
export const PANEL_PRESETS: readonly PanelPreset[] = [
  {
    id: 'shelf', label: 'Shelf', w: 800, h: 18, d: 300, icon: 'panel_shelf', shape: 'box',
    thicknessAxis: 'h', defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'flat', label: 'Side Panel', w: 600, h: 400, d: 18, icon: 'panel_flat', shape: 'box',
    thicknessAxis: 'd', defaultQuaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  },
  {
    id: 'back', label: 'Back Panel', w: 800, h: 700, d: 8, icon: 'panel_back', shape: 'box',
    thicknessAxis: 'd', defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'divider', label: 'Divider', w: 400, h: 700, d: 18, icon: 'panel_divider', shape: 'box',
    thicknessAxis: 'd', defaultQuaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  },
  {
    id: 'door', label: 'Door', w: 400, h: 700, d: 18, icon: 'panel_door', shape: 'box',
    thicknessAxis: 'd', defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'knob', label: 'Knob', w: 50, h: 45, d: 50, icon: 'panel_knob', shape: 'cylinder',
    thicknessAxis: null, defaultQuaternion: [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
  },
];

export const DEFAULT_MATERIAL_ID: MaterialId = 'oak';
export const DEFAULT_COLOR_ID: ColorId = 'natural';

/**
 * Slider range for a panel's own W/H/D. Unlike a hard domain rule, this isn't
 * enforced anywhere else — setCustomPartDim only rejects non-positive values.
 * `h` and `d` each span thin-to-large, since which one carries a panel's
 * thickness vs. its depth/height depends on the preset (see PANEL_PRESETS).
 */
export const CUSTOM_PANEL_LIMITS = {
  w: { min: 10, max: 3000, step: 5 },
  h: { min: 3, max: 3000, step: 1 },
  d: { min: 3, max: 3000, step: 1 },
} as const;

/** 2440 × 1220 ply, with a yield factor for offcuts and saw kerf. */
export const SHEET = { width: 2440, height: 1220, yield: 0.82 } as const;

export function findMaterial(id: string | undefined): Material {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0]!;
}

export function findColor(id: string | undefined): Color {
  return COLORS.find((c) => c.id === id) ?? COLORS[0]!;
}

export function isMaterialId(id: string): id is MaterialId {
  return MATERIALS.some((m) => m.id === id);
}

export function isColorId(id: string): id is ColorId {
  return COLORS.some((c) => c.id === id);
}

/** The final render appearance — a color's tint and finish override the material's own where set. */
export function resolveAppearance(
  materialId: string | undefined,
  colorId: string | undefined,
): { color: string; roughness: number; metalness: number } {
  const material = findMaterial(materialId);
  const color = findColor(colorId);
  return {
    color: color.tint ?? material.color,
    roughness: color.roughness ?? material.roughness,
    metalness: color.metalness ?? material.metalness,
  };
}
