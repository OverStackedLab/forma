import type { CabinetLayoutPart } from './cabinets';
import type { DimensionAxis, DrawerPresetId, EdgeBandSide, Transform } from './types';

const SIDE_MM = 18;
const BOTTOM_MM = 8;
const BACK_MM = 8;
const IDENTITY: Transform['quaternion'] = [0, 0, 0, 1];

/**
 * Outer box sized to sit inside a METOD carcass of the matching front width:
 * 18 mm sides plus 1 mm clearance each side (front 400 → box 362).
 */
function boxWidthForFront(frontWidthMm: number): number {
  return frontWidthMm - SIDE_MM * 2 - 2;
}

/** 10 mm overlay at the top and bottom of a matching decorative front. */
function boxHeightForFront(frontHeightMm: number): number {
  return frontHeightMm - 20;
}

/**
 * Depth for a 600 mm base carcass: 8 mm back, 19 mm front, and a little
 * overlay/runner room. Wall units are resized in Properties.
 */
const BASE_DRAWER_DEPTH_MM = 550;

export type DrawerPreset = {
  id: DrawerPresetId;
  label: string;
  width: number;
  height: number;
  depth: number;
  icon: string;
  description: string;
};

export const DRAWER_MEMBER_COUNT = 4;

export const DRAWER_DIM_LIMITS = {
  width: { min: 80, max: 3000, step: 1 },
  height: { min: 40, max: 800, step: 1 },
  depth: { min: 80, max: 1500, step: 1 },
} as const;

export const DRAWER_PRESETS: readonly DrawerPreset[] = [
  drawerPreset('drawer-400-200', 'Drawer 40×20', 400, 200),
  drawerPreset('drawer-400-400', 'Drawer 40×40', 400, 400),
  drawerPreset('drawer-600-100', 'Drawer 60×10', 600, 100),
  drawerPreset('drawer-600-200', 'Drawer 60×20', 600, 200),
  drawerPreset('drawer-800-200', 'Drawer 80×20', 800, 200),
  drawerPreset('drawer-800-400', 'Drawer 80×40', 800, 400),
];

function drawerPreset(
  id: DrawerPresetId,
  label: string,
  frontWidth: number,
  frontHeight: number,
): DrawerPreset {
  const width = boxWidthForFront(frontWidth);
  const height = boxHeightForFront(frontHeight);
  return {
    id,
    label,
    width,
    height,
    depth: BASE_DRAWER_DEPTH_MM,
    icon: 'drawer',
    description: `${width}×${height}×${BASE_DRAWER_DEPTH_MM} mm · 18 mm sides · 8 mm bottom`,
  };
}

export function resolveDrawerPresetId(id: string | undefined): DrawerPresetId | undefined {
  return DRAWER_PRESETS.find((preset) => preset.id === id)?.id;
}

function part(
  label: string,
  bomLabel: string,
  w: number,
  h: number,
  d: number,
  thicknessAxis: DimensionAxis,
    grainAxis: DimensionAxis,
    edgeBanding: EdgeBandSide[],
    positionMm: [number, number, number],
  ): CabinetLayoutPart {
    return {
      label,
      bomLabel,
      w,
      h,
      d,
      shape: 'box',
      category: 'panel',
      thicknessAxis,
      grainAxis,
      edgeBanding,
      positionMm,
      quaternion: IDENTITY,
    };
  }

  /**
   * Four-piece drawer box around a bottom-centre origin: sides, 8 mm bottom,
   * 8 mm back. The decorative front stays a separate library insert.
   */
  export function buildDrawerLayout(config: {
    label: string;
    width: number;
    height: number;
    depth: number;
  }): CabinetLayoutPart[] {
    const { label, width, height, depth } = config;
    const innerWidth = Math.max(3, width - SIDE_MM * 2);
    const innerHeight = Math.max(3, height - BOTTOM_MM);
    const boxDepth = Math.max(3, depth - BACK_MM);
    const sideX = (width - SIDE_MM) / 2;
    const backZ = -depth / 2 + BACK_MM / 2;
    const bottomZ = BACK_MM / 2;

    return [
      part(
        `${label} Left Side`, `${label} Side`,
        SIDE_MM, height, depth, 'w', 'h', ['d-max'],
        [-sideX, height / 2, 0],
      ),
      part(
        `${label} Right Side`, `${label} Side`,
        SIDE_MM, height, depth, 'w', 'h', ['d-max'],
        [sideX, height / 2, 0],
      ),
      part(
        `${label} Bottom`, `${label} Bottom`,
        innerWidth, BOTTOM_MM, boxDepth, 'h', 'w', ['d-max'],
        [0, BOTTOM_MM / 2, bottomZ],
      ),
    part(
      `${label} Back`, `${label} Back`,
      innerWidth, innerHeight, BACK_MM, 'd', 'h', [],
      [0, BOTTOM_MM + innerHeight / 2, backZ],
    ),
  ];
}
