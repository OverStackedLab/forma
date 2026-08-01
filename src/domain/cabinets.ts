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

export type CabinetLayoutPart = Omit<CustomPart, 'id'> & {
  positionMm: [number, number, number];
  quaternion: Transform['quaternion'];
};

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
export function buildCabinetLayout(preset: CabinetPreset): CabinetLayoutPart[] {
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

  for (let index = 0; index < shelfCount; index++) {
    const y = PANEL_THICKNESS + innerHeight * (index + 1) / (shelfCount + 1);
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
