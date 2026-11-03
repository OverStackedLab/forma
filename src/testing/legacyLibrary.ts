/**
 * Snapshot of the pre-rebuild library, used only by unit tests so domain and
 * store coverage keep working while the production catalog is empty.
 */
import { FRAMED_FRONT_THICKNESS_MM } from '@/domain/glassDoor';
import type { CabinetPreset, CabinetPresetId, DrawerPresetId, PanelPreset } from '@/domain/types';

type DrawerPreset = {
  id: DrawerPresetId;
  label: string;
  width: number;
  height: number;
  depth: number;
  icon: string;
  description: string;
};

/** Matching decorative-front size → inner drawer box (18 mm sides, 20 mm height overlay). */
function drawerPreset(
  id: DrawerPresetId,
  label: string,
  frontWidth: number,
  frontHeight: number,
): DrawerPreset {
  const width = frontWidth - 18 * 2 - 2;
  const height = frontHeight - 20;
  const depth = 550;
  return {
    id,
    label,
    width,
    height,
    depth,
    icon: 'drawer',
    description: `${width}×${height}×${depth} mm · 18 mm sides · 8 mm bottom`,
  };
}

const FRONT_EDGE: PanelPreset['edgeBanding'] = ['w-min', 'w-max', 'h-min', 'h-max'];

function bodbynFront(
  id: PanelPreset['id'],
  label: string,
  w: number,
  h: number,
  shape: Extract<PanelPreset['shape'], 'bodbyn-door' | 'bodbyn-muntin-glass'>,
  description: string,
  icon: string,
): PanelPreset {
  return {
    id, label, w, h, d: FRAMED_FRONT_THICKNESS_MM, icon, shape, category: 'front', description,
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: FRONT_EDGE,
    defaultQuaternion: [0, 0, 0, 1],
  };
}

export const LEGACY_PANEL_PRESETS: readonly PanelPreset[] = [
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
    id: 'axstad-glass-400', label: 'AXSTAD glass front 40×80 cm', w: 400, h: 800, d: FRAMED_FRONT_THICKNESS_MM, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '400×800×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-600', label: 'AXSTAD glass front 60×80 cm', w: 600, h: 800, d: FRAMED_FRONT_THICKNESS_MM, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '600×800×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-400-1000', label: 'AXSTAD glass front 40×100 cm', w: 400, h: 1000, d: FRAMED_FRONT_THICKNESS_MM, icon: 'panel_glass_door',
    shape: 'glass-door', category: 'front', description: '400×1000×19 mm · 78 mm frame · inset glass',
    thicknessAxis: 'd', grainAxis: 'h', edgeBanding: ['w-min', 'w-max', 'h-min', 'h-max'],
    defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'axstad-glass-600-1000', label: 'AXSTAD glass front 60×100 cm', w: 600, h: 1000, d: FRAMED_FRONT_THICKNESS_MM, icon: 'panel_glass_door',
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
    id: 'fridge-600', label: 'Fridge 60×184 cm', w: 600, h: 1840, d: 660, icon: 'appliance_fridge',
    shape: 'fridge', category: 'hardware', description: '600×1840×660 mm · placeholder',
    thicknessAxis: null, grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'matmassig-590', label: 'MATMÄSSIG hob 59 cm', w: 590, h: 49, d: 520, icon: 'appliance_hob',
    shape: 'hob', category: 'hardware', description: '590×49×520 mm · 4 zones · 560×490 mm cutout',
    thicknessAxis: null, grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
  {
    id: 'enhet-leg', label: 'ENHET leg', w: 50, h: 125, d: 50, icon: 'panel_leg', shape: 'enhet-leg',
    category: 'hardware', description: '125 mm high', thicknessAxis: null,
    grainAxis: null, edgeBanding: [], defaultQuaternion: [0, 0, 0, 1],
  },
];

export const LEGACY_CABINET_PRESETS: readonly CabinetPreset[] = [
  { id: 'base-400', label: 'Base cabinet 40 cm', width: 400, height: 800, depth: 600, shelfCount: 1, icon: 'cabinet' },
  { id: 'base-600', label: 'Base cabinet 60 cm', width: 600, height: 800, depth: 600, shelfCount: 1, icon: 'cabinet' },
  { id: 'base-800', label: 'Base cabinet 80 cm', width: 800, height: 800, depth: 600, shelfCount: 1, icon: 'cabinet' },
  { id: 'wall-600', label: 'Wall cabinet 60 cm', width: 600, height: 800, depth: 370, shelfCount: 1, icon: 'cabinet', bottomMm: 1400 },
  { id: 'wall-800', label: 'Wall cabinet 80 cm', width: 800, height: 800, depth: 370, shelfCount: 1, icon: 'cabinet', bottomMm: 1400 },
  { id: 'high-600', label: 'Tall cabinet 60 cm', width: 600, height: 2200, depth: 600, shelfCount: 4, icon: 'cabinet' },
];

export const LEGACY_CABINET_PRESET_ALIASES: Readonly<Record<string, CabinetPresetId>> = {
  'base-450': 'base-400',
  'base-900': 'base-800',
  'wall-900': 'wall-800',
  'tall-600': 'high-600',
};

export const LEGACY_DRAWER_PRESETS: readonly DrawerPreset[] = [
  drawerPreset('drawer-400-200', 'Drawer box 40×20 cm', 400, 200),
  drawerPreset('drawer-400-400', 'Drawer box 40×40 cm', 400, 400),
  drawerPreset('drawer-600-100', 'Drawer box 60×10 cm', 600, 100),
  drawerPreset('drawer-600-200', 'Drawer box 60×20 cm', 600, 200),
  drawerPreset('drawer-800-200', 'Drawer box 80×20 cm', 800, 200),
  drawerPreset('drawer-800-400', 'Drawer box 80×40 cm', 800, 400),
];
