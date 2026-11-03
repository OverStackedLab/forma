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
  { id: 'ash', label: 'Ash', materialId: 'ash', colorId: 'natural' },
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
 *
 * Cleared for a catalog rebuild — add new presets here.
 *
 * Countertops use IKEA US 74×25⅝" run sizes, stored as the matching metric
 * slabs (1860×635 mm). Thickness follows each product: 1½" → 38 mm, 1⅛" → 28 mm.
 */
function countertopPreset(
  id: PanelPreset['id'],
  label: string,
  thicknessMm: number,
  description: string,
  finishId: FinishId,
): PanelPreset {
  return {
    id,
    label,
    w: 1860,
    h: thicknessMm,
    d: 635,
    icon: 'panel_countertop',
    shape: 'box',
    category: 'panel',
    description,
    thicknessAxis: 'h',
    grainAxis: 'w',
    edgeBanding: ['w-min', 'w-max', 'd-min', 'd-max'],
    defaultQuaternion: [0, 0, 0, 1],
    finishId,
  };
}

export const PANEL_PRESETS: readonly PanelPreset[] = [
  countertopPreset(
    'countertop-karlby-walnut-1860',
    'KARLBY walnut veneer',
    38,
    '1860×38×635 mm · walnut veneer',
    'walnut',
  ),
  countertopPreset(
    'countertop-saljan-oak-1860',
    'SÄLJAN oak effect laminate',
    38,
    '1860×38×635 mm · oak effect laminate',
    'oak',
  ),
  countertopPreset(
    'countertop-jarstorp-white-1860',
    'JÄRSTORP white laminate',
    28,
    '1860×28×635 mm · white laminate',
    'white',
  ),
  countertopPreset(
    'countertop-ekbacken-ash-1860',
    'EKBACKEN ash effect laminate',
    28,
    '1860×28×635 mm · ash effect laminate',
    'ash',
  ),
  {
    // IKEA MATMÄSSIG 104.670.93: 59 cm induction hob, 56×49 cm worktop cutout.
    id: 'matmassig-590',
    label: 'MATMÄSSIG hob 59 cm',
    w: 590,
    h: 49,
    d: 520,
    icon: 'appliance_hob',
    shape: 'hob',
    category: 'hardware',
    description: '590×49×520 mm · 4 zones · 560×490 mm cutout',
    thicknessAxis: null,
    grainAxis: null,
    edgeBanding: [],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    // IKEA LAGAN 306.273.64: integrated dishwasher for a 60 cm niche.
    id: 'lagan-dishwasher-600',
    label: 'LAGAN dishwasher 60 cm',
    w: 598,
    h: 820,
    d: 555,
    icon: 'appliance_dishwasher',
    shape: 'dishwasher',
    category: 'hardware',
    description: '598×820×555 mm · integrated · door sold separately',
    thicknessAxis: null,
    grainAxis: null,
    edgeBanding: [],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    // IKEA LAGAN 106.000.54: built-in oven, white, 60 cm niche.
    id: 'lagan-oven-white-600',
    label: 'LAGAN oven white',
    w: 594,
    h: 595,
    d: 567,
    icon: 'appliance_oven',
    shape: 'oven',
    category: 'hardware',
    description: '594×595×567 mm · built-in · 74 L',
    thicknessAxis: null,
    grainAxis: null,
    edgeBanding: [],
    defaultQuaternion: [0, 0, 0, 1],
    finishId: 'matte-white',
  },
];

/**
 * IKEA METOD frame sizes (HU range). Heights exclude legs, worktops and the
 * 1 cm wall gap. Corner frames are omitted — they are not rectangular boxes.
 * Wall units hang so their top lines up with a 2200 mm tall cabinet.
 */
function metodCabinet(
  id: CabinetPresetId,
  label: string,
  width: number,
  height: number,
  depth: number,
  shelfCount: number,
  bottomMm?: number,
): CabinetPreset {
  return {
    id,
    label,
    width,
    height,
    depth,
    shelfCount,
    icon: 'cabinet',
    ...(bottomMm !== undefined ? { bottomMm } : {}),
  };
}

const HIGH_TOP_MM = 2200;

export const CABINET_PRESETS: readonly CabinetPreset[] = [
  // Base — 80 cm high. Widths × depths sold on the HU site (no 20×37).
  metodCabinet('base-200-600', 'Base cabinet 20×60 cm', 200, 800, 600, 1),
  metodCabinet('base-300-370', 'Base cabinet 30×37 cm', 300, 800, 370, 1),
  metodCabinet('base-300-600', 'Base cabinet 30×60 cm', 300, 800, 600, 1),
  metodCabinet('base-400-370', 'Base cabinet 40×37 cm', 400, 800, 370, 1),
  metodCabinet('base-400-600', 'Base cabinet 40×60 cm', 400, 800, 600, 1),
  metodCabinet('base-600-370', 'Base cabinet 60×37 cm', 600, 800, 370, 1),
  metodCabinet('base-600-600', 'Base cabinet 60×60 cm', 600, 800, 600, 1),
  metodCabinet('base-800-370', 'Base cabinet 80×37 cm', 800, 800, 370, 1),
  metodCabinet('base-800-600', 'Base cabinet 80×60 cm', 800, 800, 600, 1),

  // Wall — 37 cm deep. Underside chosen so top aligns with HIGH_TOP_MM.
  metodCabinet('wall-300-400', 'Wall cabinet 30×40 cm', 300, 400, 370, 0, HIGH_TOP_MM - 400),
  metodCabinet('wall-400-400', 'Wall cabinet 40×40 cm', 400, 400, 370, 0, HIGH_TOP_MM - 400),
  metodCabinet('wall-600-400', 'Wall cabinet 60×40 cm', 600, 400, 370, 0, HIGH_TOP_MM - 400),
  metodCabinet('wall-800-400', 'Wall cabinet 80×40 cm', 800, 400, 370, 0, HIGH_TOP_MM - 400),
  metodCabinet('wall-400-600', 'Wall cabinet 40×60 cm', 400, 600, 370, 1, HIGH_TOP_MM - 600),
  metodCabinet('wall-600-600', 'Wall cabinet 60×60 cm', 600, 600, 370, 1, HIGH_TOP_MM - 600),
  metodCabinet('wall-800-600', 'Wall cabinet 80×60 cm', 800, 600, 370, 1, HIGH_TOP_MM - 600),
  metodCabinet('wall-200-800', 'Wall cabinet 20×80 cm', 200, 800, 370, 1, HIGH_TOP_MM - 800),
  metodCabinet('wall-300-800', 'Wall cabinet 30×80 cm', 300, 800, 370, 1, HIGH_TOP_MM - 800),
  metodCabinet('wall-400-800', 'Wall cabinet 40×80 cm', 400, 800, 370, 1, HIGH_TOP_MM - 800),
  metodCabinet('wall-600-800', 'Wall cabinet 60×80 cm', 600, 800, 370, 1, HIGH_TOP_MM - 800),
  metodCabinet('wall-800-800', 'Wall cabinet 80×80 cm', 800, 800, 370, 1, HIGH_TOP_MM - 800),
  metodCabinet('wall-400-1000', 'Wall cabinet 40×100 cm', 400, 1000, 370, 2, HIGH_TOP_MM - 1000),
  metodCabinet('wall-600-1000', 'Wall cabinet 60×100 cm', 600, 1000, 370, 2, HIGH_TOP_MM - 1000),
  metodCabinet('wall-800-1000', 'Wall cabinet 80×100 cm', 800, 1000, 370, 2, HIGH_TOP_MM - 1000),
];

/** Older library ids, kept so saved cabinets still resolve to a catalog preset. */
export const CABINET_PRESET_ALIASES: Readonly<Record<string, CabinetPresetId>> = {
  'base-400': 'base-400-600',
  'base-450': 'base-400-600',
  'base-600': 'base-600-600',
  'base-800': 'base-800-600',
  'base-900': 'base-800-600',
  'wall-600': 'wall-600-800',
  'wall-800': 'wall-800-800',
  'wall-900': 'wall-800-800',
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

/** Appliance placeholders get their own library section — bought whole, not made. */
export function isAppliancePreset(preset: PanelPreset): boolean {
  return (
    preset.shape === 'fridge'
    || preset.shape === 'hob'
    || preset.shape === 'dishwasher'
    || preset.shape === 'oven'
  );
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
