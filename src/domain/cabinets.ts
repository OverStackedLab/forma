import type {
  CabinetConfig,
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
export const MAX_DIVIDER_COUNT = 20;
/** Left, right, bottom, top, back — always first in `buildCabinetLayout`. */
export const CABINET_CARCASS_COUNT = 5;

export type CabinetLayoutPart = Omit<CustomPart, 'id'> & {
  positionMm: [number, number, number];
  quaternion: Transform['quaternion'];
};

/** The heights a shelf centreline may occupy — the shelf stays inside the carcass interior. */
export function shelfPositionRange(heightMm: number): { min: number; max: number } {
  return { min: PANEL_THICKNESS * 1.5, max: heightMm - PANEL_THICKNESS * 1.5 };
}

/** Step used when Add Shelf / Add Panel needs the next free centreline. */
const INTERIOR_POSITION_STEP = 100;

/**
 * A centreline that does not overlap an existing shelf or interior panel.
 * Occupied requests walk 100 mm toward the far interior, then back, then
 * millimetre-by-millimetre so a second Add Panel click is never a no-op.
 */
export function nextFreeInteriorPosition(
  existing: readonly number[],
  requested: number,
  range: { min: number; max: number },
): number | null {
  if (!Number.isFinite(requested)) return null;
  const occupied = (value: number) =>
    existing.some((candidate) => Math.abs(candidate - value) < PANEL_THICKNESS);

  const start = Math.min(range.max, Math.max(range.min, Math.round(requested)));
  if (!occupied(start)) return start;

  for (let value = start + INTERIOR_POSITION_STEP; value <= range.max + INTERIOR_POSITION_STEP; value += INTERIOR_POSITION_STEP) {
    const clamped = Math.min(range.max, value);
    if (!occupied(clamped)) return clamped;
    if (clamped === range.max) break;
  }
  for (let value = start - INTERIOR_POSITION_STEP; value >= range.min - INTERIOR_POSITION_STEP; value -= INTERIOR_POSITION_STEP) {
    const clamped = Math.max(range.min, value);
    if (!occupied(clamped)) return clamped;
    if (clamped === range.min) break;
  }
  for (let value = range.min; value <= range.max; value++) {
    if (!occupied(value)) return value;
  }
  return null;
}

/**
 * Explicit centrelines, clamped into `range`, sorted, and thinned so no two
 * boards occupy the same space. Two centrelines closer than one panel
 * thickness cannot both hold an 18 mm board, and typing the same position into
 * several position fields used to generate stacked, z-fighting shelves that
 * each got their own cut-list row (BUG-034). Add Shelf / Add Panel already
 * refuse an occupied centreline via `nextFreeInteriorPosition`; this applies
 * the same rule to typed and loaded positions.
 */
function distinctInteriorPositions(
  positionsMm: readonly number[],
  range: { min: number; max: number },
  limit: number,
): number[] {
  const sorted = [...positionsMm]
    .map((value) => Math.min(range.max, Math.max(range.min, Math.round(value))))
    .sort((a, b) => a - b);
  const distinct: number[] = [];
  for (const value of sorted) {
    const previous = distinct[distinct.length - 1];
    if (previous !== undefined && value - previous < PANEL_THICKNESS) continue;
    distinct.push(value);
    if (distinct.length === limit) break;
  }
  return distinct;
}

export type InteriorMember = { kind: 'shelf' | 'divider'; positionMm: number };

/**
 * The parametric centreline a generated shelf or interior panel occupies.
 * Carcass pieces (sides, top, bottom, back) return null.
 */
export function interiorMemberPlacement(
  cabinet: CabinetConfig,
  partIds: readonly string[],
  partId: string,
): InteriorMember | null {
  const layout = buildCabinetLayout({
    id: cabinet.presetId ?? 'base-600',
    label: 'Cabinet',
    icon: 'cabinet',
    width: cabinet.width,
    height: cabinet.height,
    depth: cabinet.depth,
    shelfCount: cabinet.shelfCount,
    shelfPositionsMm: cabinet.shelfPositionsMm,
    dividerPositionsMm: cabinet.dividerPositionsMm,
  });
  if (layout.length !== partIds.length) return null;
  const index = partIds.indexOf(partId);
  if (index < CABINET_CARCASS_COUNT) return null;

  const panelXs = dividerPositions(cabinet);
  const shelfYs = shelfPositions(cabinet);
  const shelfPartCount = layout.length - CABINET_CARCASS_COUNT - panelXs.length;
  if (index < CABINET_CARCASS_COUNT + shelfPartCount) {
    const bayCount = shelfYs.length === 0 ? 1 : shelfPartCount / shelfYs.length;
    if (bayCount < 1 || !Number.isInteger(bayCount)) return null;
    const positionMm = shelfYs[Math.floor((index - CABINET_CARCASS_COUNT) / bayCount)];
    return positionMm === undefined ? null : { kind: 'shelf', positionMm };
  }
  const positionMm = panelXs[index - CABINET_CARCASS_COUNT - shelfPartCount];
  return positionMm === undefined ? null : { kind: 'divider', positionMm };
}

export type CabinetLayoutSlot =
  | { kind: 'carcass'; index: number }
  | { kind: 'shelf'; row: number; bay: number }
  | { kind: 'divider'; index: number };

/**
 * Role of each generated member. Shelves sit after the carcass and grow when
 * a panel splits bays, so index-stable id reuse would turn a panel into a
 * shelf on the next Add Panel / Add Shelf.
 */
export function cabinetLayoutSlots(
  cabinet: CabinetConfig,
  layoutLength: number,
): CabinetLayoutSlot[] {
  const panelCount = dividerPositions(cabinet).length;
  const shelfPartCount = Math.max(0, layoutLength - CABINET_CARCASS_COUNT - panelCount);
  const shelfYs = shelfPositions(cabinet);
  const bayCount = shelfYs.length === 0 ? 1 : shelfPartCount / Math.max(shelfYs.length, 1);
  const slots: CabinetLayoutSlot[] = [];
  for (let index = 0; index < layoutLength; index++) {
    if (index < CABINET_CARCASS_COUNT) {
      slots.push({ kind: 'carcass', index });
      continue;
    }
    if (index < CABINET_CARCASS_COUNT + shelfPartCount && Number.isInteger(bayCount) && bayCount >= 1) {
      const shelfIndex = index - CABINET_CARCASS_COUNT;
      slots.push({
        kind: 'shelf',
        row: Math.floor(shelfIndex / bayCount),
        bay: shelfIndex % bayCount,
      });
      continue;
    }
    if (index < CABINET_CARCASS_COUNT + shelfPartCount) {
      slots.push({ kind: 'shelf', row: index - CABINET_CARCASS_COUNT, bay: 0 });
      continue;
    }
    slots.push({
      kind: 'divider',
      index: index - CABINET_CARCASS_COUNT - shelfPartCount,
    });
  }
  return slots;
}

/**
 * Reuses carcass / shelf / panel ids by role so adding a bay does not remap a
 * panel id onto a new shelf slot. Unmatched slots mint ids; leftover ids drop.
 */
export function assignCabinetMemberIds(
  previousPartIds: readonly string[],
  previousCabinet: CabinetConfig,
  nextLayoutLength: number,
  nextCabinet: CabinetConfig,
  mintId: () => string,
): string[] {
  const previousLayoutLength = buildCabinetLayout({
    id: previousCabinet.presetId ?? 'base-600',
    label: 'Cabinet',
    icon: 'cabinet',
    width: previousCabinet.width,
    height: previousCabinet.height,
    depth: previousCabinet.depth,
    shelfCount: previousCabinet.shelfCount,
    shelfPositionsMm: previousCabinet.shelfPositionsMm,
    dividerPositionsMm: previousCabinet.dividerPositionsMm,
  }).length;
  if (previousLayoutLength !== previousPartIds.length) {
    return Array.from({ length: nextLayoutLength }, (_, index) => previousPartIds[index] ?? mintId());
  }

  const previousSlots = cabinetLayoutSlots(previousCabinet, previousPartIds.length);
  const nextSlots = cabinetLayoutSlots(nextCabinet, nextLayoutLength);
  const carcass = new Map<number, string>();
  const shelves: { id: string; row: number; bay: number }[] = [];
  const panels: { id: string; index: number }[] = [];
  for (const [index, id] of previousPartIds.entries()) {
    const slot = previousSlots[index];
    if (!slot) continue;
    if (slot.kind === 'carcass') carcass.set(slot.index, id);
    else if (slot.kind === 'shelf') shelves.push({ id, row: slot.row, bay: slot.bay });
    else panels.push({ id, index: slot.index });
  }

  const used = new Set<string>();
  function take(id: string | undefined): string | undefined {
    if (!id || used.has(id)) return undefined;
    used.add(id);
    return id;
  }

  return nextSlots.map((slot) => {
    if (slot.kind === 'carcass') return take(carcass.get(slot.index)) ?? mintId();
    if (slot.kind === 'shelf') {
      const exact = shelves.find((item) => item.row === slot.row && item.bay === slot.bay);
      const reused =
        take(exact?.id) ??
        take(shelves.find((item) => item.row === slot.row && !used.has(item.id))?.id);
      return reused ?? mintId();
    }
    return take(panels.find((item) => item.index === slot.index)?.id) ?? mintId();
  });
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
    return distinctInteriorPositions(config.shelfPositionsMm, range, MAX_SHELF_COUNT);
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

/** The widths a vertical panel centreline may occupy — inside the carcass sides. */
export function dividerPositionRange(widthMm: number): { min: number; max: number } {
  return { min: PANEL_THICKNESS * 1.5, max: widthMm - PANEL_THICKNESS * 1.5 };
}

type DividerSpec = {
  width: number;
  dividerPositionsMm?: readonly number[];
};

/**
 * Explicit vertical-panel centrelines — millimetres from the cabinet left,
 * clamped into the interior and sorted. Absent or empty means no extra panels.
 */
export function dividerPositions(config: DividerSpec): number[] {
  if (!config.dividerPositionsMm?.length) return [];
  return distinctInteriorPositions(
    config.dividerPositionsMm,
    dividerPositionRange(config.width),
    MAX_DIVIDER_COUNT,
  );
}

/**
 * Panel centrelines for "count panels every spacing mm", measured centre to
 * centre starting one spacing in from the left inner face. Panels that would
 * leave the interior are dropped rather than bunched at the right.
 */
export function distributedDividerPositions(
  config: { width: number },
  count: number,
  spacingMm: number,
): number[] {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) return [];
  const range = dividerPositionRange(config.width);
  const positions: number[] = [];
  for (let index = 1; index <= Math.min(count, MAX_DIVIDER_COUNT); index++) {
    const x = PANEL_THICKNESS + spacingMm * index;
    if (x < range.min || x > range.max) break;
    positions.push(x);
  }
  return positions;
}

/** Interior bays between the sides and any vertical panels, in millimetres. */
function shelfBays(
  width: number,
  dividerCentresFromLeft: readonly number[],
): { centerX: number; innerWidth: number }[] {
  const leftInterior = -width / 2 + PANEL_THICKNESS;
  const rightInterior = width / 2 - PANEL_THICKNESS;
  const half = PANEL_THICKNESS / 2;
  const edges = [leftInterior];
  for (const fromLeft of dividerCentresFromLeft) {
    const worldX = -width / 2 + fromLeft;
    edges.push(worldX - half, worldX + half);
  }
  edges.push(rightInterior);

  const bays: { centerX: number; innerWidth: number }[] = [];
  for (let index = 0; index < edges.length; index += 2) {
    const left = edges[index];
    const right = edges[index + 1];
    if (left === undefined || right === undefined) break;
    const innerWidth = right - left;
    if (innerWidth <= SHELF_CLEARANCE) continue;
    bays.push({ centerX: (left + right) / 2, innerWidth });
  }
  return bays;
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
  preset: CabinetPreset & {
    shelfPositionsMm?: readonly number[];
    dividerPositionsMm?: readonly number[];
  },
): CabinetLayoutPart[] {
  const { label, width, height, depth, shelfCount } = preset;
  const innerWidth = width - PANEL_THICKNESS * 2;
  const innerHeight = height - PANEL_THICKNESS * 2;
  const panelDepth = depth - BACK_THICKNESS;
  const panelZ = BACK_THICKNESS / 2;
  const sideX = (width - PANEL_THICKNESS) / 2;
  const panelXs = dividerPositions({
    width,
    dividerPositionsMm: preset.dividerPositionsMm,
  });
  const bays = shelfBays(width, panelXs);

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
  let shelfNumber = 1;
  for (const y of shelfYs) {
    for (const bay of bays) {
      parts.push(
        part(
          `${label} Shelf ${shelfNumber}`,
          `${label} Shelf`,
          bay.innerWidth - SHELF_CLEARANCE,
          PANEL_THICKNESS,
          panelDepth,
          'h',
          'w',
          ['d-max'],
          [bay.centerX, y, panelZ],
        ),
      );
      shelfNumber += 1;
    }
  }

  for (const [index, fromLeft] of panelXs.entries()) {
    parts.push(
      part(
        `${label} Panel ${index + 1}`,
        `${label} Panel`,
        PANEL_THICKNESS,
        innerHeight,
        panelDepth,
        'w',
        'h',
        ['d-max'],
        [-width / 2 + fromLeft, height / 2, panelZ],
      ),
    );
  }

  return parts;
}
