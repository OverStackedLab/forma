import type {
  CabinetPreset,
  CabinetPresetId,
  Color,
  ColorId,
  Finish,
  FinishId,
  HardwareFinishId,
  Material,
  MaterialId,
  PanelPreset,
  PanelPresetId,
  PanelShape,
} from './types';

/** The wood species a part is milled from. Its own color/roughness shows through when the color is 'natural'. */
export const MATERIALS: readonly Material[] = [
  { id: 'walnut', label: 'Walnut', color: '#6b4f3b', roughness: 0.42, metalness: 0 },
  { id: 'oak', label: 'Oak', color: '#d4b78f', roughness: 0.58, metalness: 0.03 },
  { id: 'ash', label: 'Ash', color: '#d9cdb6', roughness: 0.45, metalness: 0.02 },
  { id: 'metal', label: 'Metal', color: '#9a9a9a', roughness: 0.28, metalness: 0.82 },
];

/** A stain or paint applied over a material. Natural leaves the material's own look untouched. */
export const COLORS: readonly Color[] = [
  { id: 'natural', label: 'Natural', tint: null },
  { id: 'ebony', label: 'Ebony Stain', tint: '#211c19', roughness: 0.5, metalness: 0.04 },
  { id: 'dark-gray', label: 'Dark Gray', tint: '#4a4a4c', roughness: 0.42, metalness: 0.02 },
  // ASPUDDEN dark gray-green — muted sage charcoal foil.
  { id: 'dark-gray-green', label: 'Dark Gray-Green', tint: '#3f4a42', roughness: 0.4, metalness: 0.02 },
  { id: 'white', label: 'White', tint: '#f2f2f0', roughness: 0.32, metalness: 0.0 },
  { id: 'brass', label: 'Brushed Brass', tint: '#b6884b', roughness: 0.3, metalness: 0.84 },
  { id: 'matte-black', label: 'Matte Black', tint: '#232323', roughness: 0.52, metalness: 0.55 },
  { id: 'steel', label: 'Brushed Steel', tint: '#9a9a9a', roughness: 0.27, metalness: 0.9 },
];

/** Panel colors. Each resolves to one internal material/color pair. */
export const FINISHES: readonly Finish[] = [
  { id: 'oak', label: 'Oak', materialId: 'oak', colorId: 'natural' },
  { id: 'walnut', label: 'Walnut', materialId: 'walnut', colorId: 'natural' },
  { id: 'dark-gray', label: 'Dark Gray', materialId: 'ash', colorId: 'dark-gray' },
  { id: 'dark-gray-green', label: 'Dark Gray-Green', materialId: 'ash', colorId: 'dark-gray-green' },
  { id: 'white', label: 'White', materialId: 'ash', colorId: 'white' },
];

export const HARDWARE_FINISHES: readonly Finish[] = [
  { id: 'brushed-brass', label: 'Brushed Brass', materialId: 'metal', colorId: 'brass' },
  { id: 'matte-black', label: 'Matte Black', materialId: 'metal', colorId: 'matte-black' },
  { id: 'brushed-steel', label: 'Brushed Steel', materialId: 'metal', colorId: 'steel' },
  { id: 'matte-white', label: 'White', materialId: 'metal', colorId: 'white' },
];

export const ALL_FINISHES: readonly Finish[] = [...FINISHES, ...HARDWARE_FINISHES];

/**
 * Insertable individual parts for the empty-canvas scene.
 * W/H/D always match the visible world axes at insertion. That keeps the
 * Properties labels literal: changing Depth always changes front-to-back
 * depth, even for side panels and hardware.
 */
const FRONT_EDGE: PanelPreset['edgeBanding'] = ['w-min', 'w-max', 'h-min', 'h-max'];

function bodbynFront(
  id: PanelPresetId,
  label: string,
  w: number,
  h: number,
  shape: Extract<PanelShape, 'bodbyn-door' | 'bodbyn-muntin-glass'>,
  description: string,
  icon: string,
): PanelPreset {
  return {
    id, label, w, h, d: 19, icon, shape, category: 'front', description,
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: FRONT_EDGE,
    defaultQuaternion: [0, 0, 0, 1],
  };
}

export const PANEL_PRESETS: readonly PanelPreset[] = [
  {
    id: 'shelf', label: 'Shelf', w: 800, h: 18, d: 300, icon: 'panel_shelf', shape: 'box',
    category: 'panel', description: '800×18×300 mm', thicknessAxis: 'h', grainAxis: 'w',
    edgeBanding: ['d-max'], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'flat', label: 'Side Panel', w: 18, h: 800, d: 600, icon: 'panel_flat', shape: 'box',
    category: 'panel', description: '18×800×600 mm', thicknessAxis: 'w', grainAxis: 'h',
    edgeBanding: ['d-max'], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'back', label: 'Back Panel', w: 600, h: 800, d: 8, icon: 'panel_back', shape: 'box',
    category: 'panel', description: '600×800×8 mm', thicknessAxis: 'd', grainAxis: 'h',
    edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'divider', label: 'Divider', w: 18, h: 800, d: 600, icon: 'panel_divider', shape: 'box',
    category: 'panel', description: '18×800×600 mm', thicknessAxis: 'w', grainAxis: 'h',
    edgeBanding: ['d-max'], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'door', label: 'Door', w: 400, h: 800, d: 18, icon: 'panel_door', shape: 'box',
    category: 'front', description: '400×800×18 mm', thicknessAxis: 'd', grainAxis: 'h',
    edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-400', label: 'AXSTAD glass front 40×80 cm', w: 400, h: 800, d: 19, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '400×800×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-600', label: 'AXSTAD glass front 60×80 cm', w: 600, h: 800, d: 19, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '600×800×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-400-1000', label: 'AXSTAD glass front 40×100 cm', w: 400, h: 1000, d: 19, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '400×1000×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-600-1000', label: 'AXSTAD glass front 60×100 cm', w: 600, h: 1000, d: 19, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '600×1000×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  bodbynFront(
    'bodbyn-250', 'BODBYN panel front 25×80 cm', 250, 800, 'bodbyn-door',
    '250×800×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-300', 'BODBYN panel front 30×80 cm', 300, 800, 'bodbyn-door',
    '300×800×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-400', 'BODBYN panel front 40×80 cm', 400, 800, 'bodbyn-door',
    '400×800×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-400-1000', 'BODBYN panel front 40×100 cm', 400, 1000, 'bodbyn-door',
    '400×1000×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-450', 'BODBYN panel front 45×80 cm', 450, 800, 'bodbyn-door',
    '450×800×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-600-400', 'BODBYN panel front 60×40 cm', 600, 400, 'bodbyn-door',
    '600×400×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-600-600', 'BODBYN panel front 60×60 cm', 600, 600, 'bodbyn-door',
    '600×600×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-600', 'BODBYN panel front 60×80 cm', 600, 800, 'bodbyn-door',
    '600×800×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-600-1400', 'BODBYN panel front 60×140 cm', 600, 1400, 'bodbyn-door',
    '600×1400×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-drawer-400-200', 'BODBYN drawer front 40×20 cm', 400, 200, 'bodbyn-door',
    '400×200×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-drawer-400-400', 'BODBYN drawer front 40×40 cm', 400, 400, 'bodbyn-door',
    '400×400×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-drawer-600-100', 'BODBYN drawer front 60×10 cm', 600, 100, 'bodbyn-door',
    '600×100×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-drawer-600-200', 'BODBYN drawer front 60×20 cm', 600, 200, 'bodbyn-door',
    '600×200×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-drawer-800-200', 'BODBYN drawer front 80×20 cm', 800, 200, 'bodbyn-door',
    '800×200×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-drawer-800-400', 'BODBYN drawer front 80×40 cm', 800, 400, 'bodbyn-door',
    '800×400×19 mm · 70 mm frame · bevelled panel', 'panel_framed_door',
  ),
  bodbynFront(
    'bodbyn-glass-400-400', 'BODBYN glass front 40×40 cm', 400, 400, 'bodbyn-muntin-glass',
    '400×400×19 mm · 70 mm frame · glass · cross-rail', 'panel_glass_door',
  ),
  {
    id: 'knob', label: 'Knob', w: 32, h: 32, d: 25, icon: 'panel_knob', shape: 'cylinder',
    category: 'hardware', description: 'Ø32 × 25 mm projection', thicknessAxis: null,
    grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'bagganas', label: 'BAGGANÄS knob', w: 21, h: 21, d: 24, icon: 'panel_knob', shape: 'bagganas',
    category: 'hardware', description: 'Ø21 × 24 mm projection', thicknessAxis: null,
    grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'eneryda', label: 'ENERYDA handle', w: 112, h: 17, d: 30, icon: 'panel_handle', shape: 'eneryda',
    category: 'hardware', description: '112 mm · 96 mm centres', thicknessAxis: null,
    grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'borghamn', label: 'BORGHAMN handle', w: 170, h: 10, d: 36, icon: 'panel_handle', shape: 'borghamn',
    category: 'hardware', description: '170 mm · 160 mm centres', thicknessAxis: null,
    grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'enhet-leg', label: 'ENHET leg', w: 50, h: 125, d: 50, icon: 'panel_leg', shape: 'enhet-leg',
    category: 'hardware', description: '125 mm high', thicknessAxis: null,
    grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
];

/** IKEA METOD frame sizes. Heights exclude legs, worktops and the 1 cm wall gap. */
export const CABINET_PRESETS: readonly CabinetPreset[] = [
  { id: 'base-400', label: 'Base cabinet 40 cm', width: 400, height: 800, depth: 600, shelfCount: 1, icon: 'cabinet' },
  { id: 'base-600', label: 'Base cabinet 60 cm', width: 600, height: 800, depth: 600, shelfCount: 1, icon: 'cabinet' },
  { id: 'base-800', label: 'Base cabinet 80 cm', width: 800, height: 800, depth: 600, shelfCount: 1, icon: 'cabinet' },
  // 1400 mm underside so an 800 mm wall unit’s top lines up with High 2200.
  { id: 'wall-600', label: 'Wall cabinet 60 cm', width: 600, height: 800, depth: 370, shelfCount: 1, icon: 'cabinet', bottomMm: 1400 },
  { id: 'wall-800', label: 'Wall cabinet 80 cm', width: 800, height: 800, depth: 370, shelfCount: 1, icon: 'cabinet', bottomMm: 1400 },
  { id: 'high-600', label: 'Tall cabinet 60 cm', width: 600, height: 2200, depth: 600, shelfCount: 4, icon: 'cabinet' },
];

/** Older library ids, kept so saved cabinets still resolve to a catalog preset. */
export const CABINET_PRESET_ALIASES: Readonly<Record<string, CabinetPresetId>> = {
  'base-450': 'base-400',
  'base-900': 'base-800',
  'wall-900': 'wall-800',
  'tall-600': 'high-600',
};

export function resolveCabinetPresetId(id: string | undefined): CabinetPresetId | undefined {
  if (!id) return undefined;
  const aliased = CABINET_PRESET_ALIASES[id];
  if (aliased) return aliased;
  return CABINET_PRESETS.find((preset) => preset.id === id)?.id;
}

export const DEFAULT_MATERIAL_ID: MaterialId = 'ash';
export const DEFAULT_COLOR_ID: ColorId = 'white';
export const DEFAULT_HARDWARE_FINISH_ID: HardwareFinishId = 'matte-black';

/**
 * Slider range for a panel's own W/H/D. `setCustomPartDim`, `setHardwareDiameter`
 * and `persistence.normalizePart` all clamp to these, so they are a real domain
 * rule and not only a slider hint.
 *
 * All three axes span thin-to-large on a 1 mm step: which axis carries a
 * panel's thickness rather than its height or depth depends on the preset (see
 * PANEL_PRESETS), and the catalog itself needs 8 mm backs, 18 mm sides and
 * 32 mm knobs. A 10 mm floor on a 5 mm grid put none of those on a reachable
 * value and had persistence rewriting them on load (BUG-012).
 */
export const CUSTOM_PANEL_LIMITS = {
  w: { min: 3, max: 3000, step: 1 },
  h: { min: 3, max: 3000, step: 1 },
  d: { min: 3, max: 3000, step: 1 },
} as const;

export const CABINET_DIM_LIMITS = {
  width: { min: 100, max: 3000, step: 10 },
  height: { min: 100, max: 3000, step: 10 },
  depth: { min: 100, max: 1500, step: 10 },
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

export function findFinish(id: FinishId | HardwareFinishId | string | undefined): Finish {
  return ALL_FINISHES.find((finish) => finish.id === id) ?? FINISHES[0]!;
}

export function isHardwareFinishId(id: string): id is HardwareFinishId {
  return HARDWARE_FINISHES.some((finish) => finish.id === id);
}

/** Round purchased knobs share diameter + projection controls. */
export function isRoundHardwareShape(shape: string | undefined): boolean {
  return shape === 'cylinder' || shape === 'bagganas';
}

/** Floor-standing round legs share diameter (X/Z) + height (Y) controls. */
export function isLegHardwareShape(shape: string | undefined): boolean {
  return shape === 'enhet-leg';
}

/** Maps saved material/color combinations into the closest single finish. */
export function finishForAppearance(
  materialId: MaterialId | string | undefined,
  colorId: ColorId | string | undefined,
): Finish {
  const exact = ALL_FINISHES.find(
    (finish) => finish.materialId === materialId && finish.colorId === colorId,
  );
  if (exact) return exact;
  if (colorId === 'brass') return findFinish('brushed-brass');
  if (colorId === 'matte-black') return findFinish('matte-black');
  if (colorId === 'steel') return findFinish('brushed-steel');
  if (colorId === 'dark-gray' || colorId === 'ebony') return findFinish('dark-gray');
  if (colorId === 'white') return findFinish('white');
  return findFinish('oak');
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
