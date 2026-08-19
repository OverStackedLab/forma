import type {
  CabinetPreset,
  CustomPart,
  DimensionAxis,
  EdgeBandSide,
  Transform,
} from './types';

const PANEL_THICKNESS = 18;
const BACK_THICKNESS = 8;
const SHELF_CLEARANCE = 2;
const IDENTITY: Transform['quaternion'] = [0, 0, 0, 1];

export const MAX_SHELF_COUNT = 20;

export type CabinetLayoutPart = Omit<CustomPart, 'id'> & {
  positionMm: [number, number, number];
  quaternion: Transform['quaternion'];
};

/** The heights a shelf centreline may occupy — the shelf stays inside the carcass interior. */
export function shelfPositionRange(heightMm: number): { min: number; max: number } {
  return { min: PANEL_THICKNESS * 1.5, max: heightMm - PANEL_THICKNESS * 1.5 };
}

type ShelfSpec = {
  height: number;
  shelfCount: number;
  shelfPositionsMm?: readonly number[];
};

/**
 * Effective shelf centrelines for a config — the explicit positions when
 * present (clamped into the interior and sorted), else `shelfCount` shelves
 * evenly spaced through the interior.
 */
export function shelfPositions(config: ShelfSpec): number[] {
  const range = shelfPositionRange(config.height);
  if (config.shelfPositionsMm?.length) {
    return [...config.shelfPositionsMm]
      .map((y) => Math.min(range.max, Math.max(range.min, Math.round(y))))
      .sort((a, b) => a - b)
      .slice(0, MAX_SHELF_COUNT);
  }
  const innerHeight = config.height - PANEL_THICKNESS * 2;
  return Array.from(
    { length: config.shelfCount },
    (_, index) => PANEL_THICKNESS + (innerHeight * (index + 1)) / (config.shelfCount + 1),
  );
}

/**
 * Shelf centrelines for "count shelves every spacing mm", measured centre to
 * centre starting one spacing above the cabinet floor. Shelves that would
 * leave the interior are dropped rather than bunched at the top.
 */
export function distributedShelfPositions(
  config: { height: number },
  count: number,
  spacingMm: number,
): number[] {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) return [];
  const range = shelfPositionRange(config.height);
  const positions: number[] = [];
  for (let index = 1; index <= Math.min(count, MAX_SHELF_COUNT); index++) {
    const y = PANEL_THICKNESS + spacingMm * index;
    if (y < range.min || y > range.max) break;
    positions.push(y);
  }
  return positions;
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
  quaternion: Transform['quaternion'] = IDENTITY,
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
    quaternion,
  };
}

/** Builds an open-front frameless cabinet carcass around a bottom-centre origin. */
export function buildCabinetLayout(
  preset: CabinetPreset & { shelfPositionsMm?: readonly number[] },
): CabinetLayoutPart[] {
  const { label, width, height, depth, shelfCount } = preset;
  const innerWidth = width - PANEL_THICKNESS * 2;
  const innerHeight = height - PANEL_THICKNESS * 2;
  const panelDepth = depth - BACK_THICKNESS;
  const panelZ = BACK_THICKNESS / 2;
  const sideX = (width - PANEL_THICKNESS) / 2;

  const parts: CabinetLayoutPart[] = [
    part(`${label} Left Side`, `${label} Side`, PANEL_THICKNESS, height, depth, 'w', 'h', ['d-max'], [-sideX, height / 2, 0]),
    part(`${label} Right Side`, `${label} Side`, PANEL_THICKNESS, height, depth, 'w', 'h', ['d-max'], [sideX, height / 2, 0]),
    part(`${label} Bottom`, `${label} Bottom`, innerWidth, PANEL_THICKNESS, panelDepth, 'h', 'w', ['d-max'], [0, PANEL_THICKNESS / 2, panelZ]),
    part(`${label} Top`, `${label} Top`, innerWidth, PANEL_THICKNESS, panelDepth, 'h', 'w', ['d-max'], [0, height - PANEL_THICKNESS / 2, panelZ]),
    part(
      `${label} Back`,
      `${label} Back`,
      innerWidth,
      innerHeight,
      BACK_THICKNESS,
      'd',
      'h',
      [],
      [0, height / 2, -depth / 2 + BACK_THICKNESS / 2],
    ),
  ];

  const shelfYs = shelfPositions({
    height,
    shelfCount,
    shelfPositionsMm: preset.shelfPositionsMm,
  });
  for (const [index, y] of shelfYs.entries()) {
    parts.push(
      part(
        `${label} Shelf ${index + 1}`,
        `${label} Shelf`,
        innerWidth - SHELF_CLEARANCE,
        PANEL_THICKNESS,
        panelDepth,
        'h',
        'w',
        ['d-max'],
        [0, y, panelZ],
      ),
    );
  }

  return parts;
}
