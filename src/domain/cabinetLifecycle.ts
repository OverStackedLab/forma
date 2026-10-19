import type { CabinetLayoutPart } from './cabinets';
import {
  assignCabinetMemberIds,
  buildCabinetLayout,
  CABINET_CARCASS_COUNT,
  cabinetLayoutSlots,
  dividerPositions,
  interiorMemberPlacement,
  shelfPositions,
} from './cabinets';
import { CABINET_PRESETS } from './catalog';
import { inferCabinetConfig, restorableCabinetGroup } from './restoreCabinet';
import { anchorPlacement, applyGeneratedLayout, withGeneratedMemberFields, type AssemblyPlacement } from './generatedAssembly';
import { buildDrawerLayout, DRAWER_MEMBER_COUNT } from './drawers';
import { invertQuaternion } from './rotation';
import { rotateVectorByQuaternion } from './spatial';
import type {
  CabinetConfig,
  CustomPart,
  DrawerConfig,
  DocumentSnapshot,
  Group,
  Transform,
  Transforms,
} from './types';

const IDENTITY_TRANSFORM: Transform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

/**
 * Millimetre tolerance for "the same interior layout". Live centrelines are
 * read back as rounded integers while an even distribution is fractional
 * (High 600 spaces four shelves at 450.8, 883.6, 1316.4, 1749.2 mm), so exact
 * equality could never match and every edit froze the shelves into explicit
 * positions (BUG-032). `restoreCabinet.matchesEven` uses the same tolerance.
 */
const INTERIOR_TOLERANCE_MM = 2;

export type CabinetDocument = Pick<
  DocumentSnapshot,
  'customParts' | 'transforms' | 'groups' | 'overrides' | 'hiddenIds'
>;

/** Where a rebuild keeps the cabinet while the parts are generated again. */
export type CabinetPlacement = 'anchor' | 'pivot';

function cabinetPreset(group: Group, config: CabinetConfig) {
  return {
    id: config.presetId ?? CABINET_PRESETS[0]!.id,
    label: group.label,
    width: config.width,
    height: config.height,
    depth: config.depth,
    shelfCount: config.shelfCount,
    shelfPositionsMm: config.shelfPositionsMm,
    dividerPositionsMm: config.dividerPositionsMm,
    icon: 'cabinet',
  } as const;
}

/** The layout for a group that still has a cabinet configuration. */
export function buildGroupCabinetLayout(group: Group, config: CabinetConfig): CabinetLayoutPart[] {
  return buildCabinetLayout(cabinetPreset(group, config));
}

function uniqueSortedMm(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value)))].sort((a, b) => a - b);
}

function sameMm(
  left: readonly number[],
  right: readonly number[],
  toleranceMm: number = INTERIOR_TOLERANCE_MM,
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => Math.abs(value - (right[index] ?? 0)) <= toleranceMm)
  );
}

/**
 * A config the group's current members can actually render. Writing one whose
 * layout is a different length leaves the group describing more pieces than it
 * owns, which the next rebuild resolves by remapping ids onto the wrong roles
 * (BUG-029).
 */
function layoutMatchesMembers(group: Group, config: CabinetConfig): boolean {
  return buildGroupCabinetLayout(group, config).length === group.partIds.length;
}

/** Finds the cabinet's bottom-centre origin and shared assembly orientation. */
function cabinetPlacement(
  group: Group,
  config: CabinetConfig,
  transforms: Transforms,
): AssemblyPlacement {
  const layout = buildGroupCabinetLayout(group, config);
  return anchorPlacement(group.partIds, layout[0]?.positionMm, transforms);
}

/** Keeps the shared member-centroid fixed while a cabinet is rebuilt. */
function cabinetPivotPlacement(
  group: Group,
  config: CabinetConfig,
  transforms: Transforms,
): AssemblyPlacement {
  const memberTransforms = group.partIds.map((id) => transforms[id] ?? IDENTITY_TRANSFORM);
  const pivot = [0, 1, 2].map(
    (index) =>
      memberTransforms.reduce((sum, transform) => sum + transform.position[index]!, 0) /
      memberTransforms.length,
  ) as [number, number, number];
  const quaternion = [...memberTransforms[0]!.quaternion] as Transform['quaternion'];
  const layout = buildGroupCabinetLayout(group, config);
  const localPivot = [0, 1, 2].map(
    (index) => layout.reduce((sum, item) => sum + item.positionMm[index]!, 0) / layout.length / 1000,
  );
  const offset = rotateVectorByQuaternion(
    { x: localPivot[0]!, y: localPivot[1]!, z: localPivot[2]! },
    quaternion,
  );
  return {
    origin: [pivot[0] - offset.x, pivot[1] - offset.y, pivot[2] - offset.z],
    quaternion,
  };
}

/**
 * Shelf rows and panel centrelines from live transforms, so a move is not
 * discarded the next time Add Shelf or Add Panel rebuilds.
 *
 * Shelves are collapsed by layout row, not by distinct height. A cabinet with
 * an interior panel carries one shelf board per bay on a shared centreline, so
 * reading every board as its own row turned a single moved shelf into a whole
 * extra row of shelves (BUG-029). Returns null when the pieces can no longer
 * be described parametrically at all.
 */
function liveInteriorCentrelines(
  group: Group,
  cabinet: CabinetConfig,
  transforms: Transforms,
): { shelves: number[]; panels: number[] } | null {
  const layout = buildGroupCabinetLayout(group, cabinet);
  if (layout.length !== group.partIds.length) return null;
  const slots = cabinetLayoutSlots(cabinet, group.partIds.length);
  const placement = cabinetPlacement(group, cabinet, transforms);
  const inverse = invertQuaternion(placement.quaternion);
  const shelfRows = new Map<number, number[]>();
  const panelsByIndex = new Map<number, number>();

  for (const [index, partId] of group.partIds.entries()) {
    const slot = slots[index];
    if (!slot || slot.kind === 'carcass') continue;
    const world = transforms[partId]?.position;
    if (!world) continue;
    const local = rotateVectorByQuaternion(
      {
        x: world[0] - placement.origin[0],
        y: world[1] - placement.origin[1],
        z: world[2] - placement.origin[2],
      },
      inverse,
    );
    if (slot.kind === 'shelf') {
      const row = shelfRows.get(slot.row) ?? [];
      row.push(local.y * 1000);
      shelfRows.set(slot.row, row);
    } else {
      panelsByIndex.set(slot.index, local.x * 1000 + cabinet.width / 2);
    }
  }

  const shelves: number[] = [];
  for (const heights of shelfRows.values()) {
    const lowest = Math.min(...heights);
    const highest = Math.max(...heights);
    if (highest - lowest > INTERIOR_TOLERANCE_MM) return null;
    shelves.push((lowest + highest) / 2);
  }
  return {
    shelves: uniqueSortedMm(shelves),
    panels: uniqueSortedMm([...panelsByIndex.values()]),
  };
}

/** Stored configuration, with shelf and panel centrelines read from the parts. */
export function cabinetWithLiveInterior(
  group: Group,
  cabinet: CabinetConfig,
  transforms: Transforms,
): CabinetConfig {
  const live = liveInteriorCentrelines(group, cabinet, transforms);
  if (!live) return cabinet;
  const shelves = live.shelves.length ? live.shelves : shelfPositions(cabinet);
  const panels = live.panels.length ? live.panels : dividerPositions(cabinet);
  const evenShelves = shelfPositions({ height: cabinet.height, shelfCount: shelves.length });
  return {
    ...cabinet,
    shelfCount: shelves.length,
    shelfPositionsMm: shelves.length && !sameMm(shelves, evenShelves) ? shelves : undefined,
    dividerPositionsMm: panels.length ? panels : undefined,
  };
}

/**
 * Clears a cabinet or drawer configuration when a size edit hits some but not
 * all members. Translate, rotate and rename do not demote.
 */
function groupsAfterPartialSizeEdit(groups: readonly Group[], resizedIds: readonly string[]): Group[] {
  const changed = new Set(resizedIds);
  return groups.map((group) => {
    if (!group.partIds.some((id) => changed.has(id))) return group;
    if (group.partIds.every((id) => changed.has(id))) return group;
    return { ...group, cabinet: undefined, drawer: undefined };
  });
}

/**
 * Writes moves back onto `cabinet` so the next Add Shelf or Add Panel keeps
 * the placed centrelines. Only runs when an interior member actually moved.
 */
function groupsWithSyncedInteriors(
  groups: readonly Group[],
  transforms: Transforms,
  changedIds: readonly string[],
): Group[] {
  const changed = new Set(changedIds);
  return groups.map((group) => {
    const cabinet = group.cabinet;
    if (!cabinet) return group;
    const interiorMoved = group.partIds.some((id) => {
      if (!changed.has(id)) return false;
      return Boolean(interiorMemberPlacement(cabinet, group.partIds, id));
    });
    if (!interiorMoved) return group;
    if (!liveInteriorCentrelines(group, cabinet, transforms)) {
      return { ...group, cabinet: undefined };
    }
    const next = cabinetWithLiveInterior(group, cabinet, transforms);
    if (!layoutMatchesMembers(group, next)) return { ...group, cabinet: undefined };
    const sameShelves = sameMm(shelfPositions(next), shelfPositions(cabinet));
    const samePanels = sameMm(dividerPositions(next), dividerPositions(cabinet));
    return sameShelves && samePanels ? group : { ...group, cabinet: next };
  });
}

/**
 * Demotes a partial size edit, then writes moved shelves and panels back onto
 * the cabinet configuration. A size edit of some members removes the
 * configuration before the write-back runs.
 */
export function cabinetGroupsAfterMemberEdit(
  groups: readonly Group[],
  transforms: Transforms,
  changedIds: readonly string[],
  resizedIds: readonly string[],
): Group[] {
  return groupsWithSyncedInteriors(
    groupsAfterPartialSizeEdit(groups, resizedIds),
    transforms,
    changedIds,
  );
}

/**
 * If every deleted member is a generated shelf or interior panel, returns a
 * configuration that drops those members. Deleting a side, top, bottom or back
 * returns null so the caller removes the configuration.
 */
export function cabinetConfigAfterInteriorDelete(
  group: Group,
  deletedIds: ReadonlySet<string>,
): CabinetConfig | null {
  const cabinet = group.cabinet;
  if (!cabinet) return null;
  const layout = buildGroupCabinetLayout(group, cabinet);
  if (layout.length !== group.partIds.length) return null;

  const shelfYs = shelfPositions(cabinet);
  const slots = cabinetLayoutSlots(cabinet, group.partIds.length);

  const baysInRow = new Map<number, number>();
  for (const slot of slots) {
    if (slot.kind === 'shelf') baysInRow.set(slot.row, (baysInRow.get(slot.row) ?? 0) + 1);
  }

  const removedBaysInRow = new Map<number, number>();
  const removedPanelIndices = new Set<number>();
  for (const [index, id] of group.partIds.entries()) {
    if (!deletedIds.has(id)) continue;
    const slot = slots[index];
    if (!slot || slot.kind === 'carcass') return null;
    if (slot.kind === 'shelf') {
      removedBaysInRow.set(slot.row, (removedBaysInRow.get(slot.row) ?? 0) + 1);
    } else {
      removedPanelIndices.add(slot.index);
    }
  }

  for (const [row, removed] of removedBaysInRow) {
    if (removed !== (baysInRow.get(row) ?? 0)) return null;
  }

  const removedShelfRows = new Set(removedBaysInRow.keys());
  if (!removedShelfRows.size && !removedPanelIndices.size) return cabinet;

  const nextShelves = shelfYs.filter((_, index) => !removedShelfRows.has(index));
  const nextPanels = dividerPositions(cabinet).filter((_, index) => !removedPanelIndices.has(index));
  return {
    ...cabinet,
    shelfCount: removedShelfRows.size ? nextShelves.length : cabinet.shelfCount,
    shelfPositionsMm: removedShelfRows.size ? (nextShelves.length ? nextShelves : undefined) : cabinet.shelfPositionsMm,
    dividerPositionsMm: removedPanelIndices.size
      ? nextPanels.length
        ? nextPanels
        : undefined
      : cabinet.dividerPositionsMm,
  };
}

function cabinetResizeMetadata(group: Group, requested: CabinetConfig): {
  config: CabinetConfig;
  label: string;
} {
  const config = { ...requested };
  const currentPreset = CABINET_PRESETS.find((preset) => preset.id === group.cabinet?.presetId);
  const matchingPreset =
    config.shelfPositionsMm?.length || config.dividerPositionsMm?.length
      ? undefined
      : CABINET_PRESETS.find(
          (preset) =>
            preset.width === config.width &&
            preset.height === config.height &&
            preset.depth === config.depth &&
            preset.shelfCount === config.shelfCount,
        );
  config.presetId = matchingPreset?.id;
  const generatedLabel =
    currentPreset?.label === group.label ||
    /^(Base|Wall|Tall|High)( cabinet)? \d+(?:\.\d+)?(?:×\d+(?:\.\d+)?){0,2}( cm)?$/.test(group.label);
  const family = currentPreset?.label.split(' ')[0] ?? group.label.split(' ')[0] ?? 'Cabinet';
  const label = generatedLabel
    ? (matchingPreset?.label ??
      `${family === 'High' ? 'Tall' : family} cabinet ${config.width / 10}×${config.height / 10}×${config.depth / 10} cm`)
    : group.label;
  return { config, label };
}

/**
 * Rebuilds a cabinet from its configuration. Carcass, shelf, and panel ids
 * stay bound to those roles. New members mint ids; removed roles drop theirs.
 * `anchor` keeps the bottom-centre of the current cabinet. `pivot` keeps the
 * shared centre of the members, which is what a scale gesture uses.
 */
export function rebuildCabinet(
  document: CabinetDocument,
  group: Group,
  requested: CabinetConfig,
  mintId: () => string,
  placementMode: CabinetPlacement = 'anchor',
): CabinetDocument {
  const { config, label } = cabinetResizeMetadata(group, requested);
  const nextGroup = { ...group, label };
  const layout = buildGroupCabinetLayout(nextGroup, config);
  const placement =
    placementMode === 'pivot'
      ? cabinetPivotPlacement(group, requested, document.transforms)
      : cabinetPlacement(group, group.cabinet ?? requested, document.transforms);
  const nextIds = assignCabinetMemberIds(
    group.partIds,
    group.cabinet ?? config,
    layout.length,
    config,
    mintId,
  );
  return applyGeneratedLayout(document, group, layout, nextIds, placement, { label, cabinet: config });
}

/** Puts every member back on the cabinet layout and clears rotation and scale. */
export function resetCabinetTransforms(group: Group, transforms: Transforms): Transforms {
  if (!group.cabinet) return transforms;
  const placement = cabinetPlacement(group, group.cabinet, transforms);
  const layout = buildGroupCabinetLayout(group, group.cabinet);
  const next = { ...transforms };
  group.partIds.forEach((id, index) => {
    const item = layout[index];
    if (!item) return;
    next[id] = {
      position: [
        placement.origin[0] + item.positionMm[0] / 1000,
        placement.origin[1] + item.positionMm[1] / 1000,
        placement.origin[2] + item.positionMm[2] / 1000,
      ],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    };
  });
  return next;
}

/** The cabinet configuration for a rigid group the user asked to restore. */
export function restoredCabinet(
  groups: readonly Group[],
  parts: readonly CustomPart[],
  transforms: Transforms,
  selectedIds: readonly string[],
): { group: Group; cabinet: CabinetConfig } | null {
  const group = restorableCabinetGroup(groups, parts, transforms, selectedIds);
  if (!group) return null;
  const cabinet = inferCabinetConfig(parts, transforms, group.partIds);
  if (!cabinet) return null;
  return { group, cabinet };
}

/**
 * A schema-3 group has no cabinet configuration. Match a catalog preset from
 * the group label or the member names. A current file with no configuration
 * stays a plain group.
 */
export function cabinetFromLegacyGroup(
  label: string,
  partIds: readonly string[],
  parts: readonly CustomPart[],
): CabinetConfig | undefined {
  const memberLabels = partIds.map((id) => parts.find((part) => part.id === id)?.label ?? '').join(' ');
  const inferred = CABINET_PRESETS.find((preset) => {
    const family = preset.id.split('-')[0]!;
    const legacyLabel = `${family[0]!.toUpperCase()}${family.slice(1)} ${preset.width}`;
    return [preset.label, legacyLabel].some(
      (name) => name === label || memberLabels.includes(`${name} Left Side`),
    );
  });
  if (!inferred || partIds.length !== CABINET_CARCASS_COUNT + inferred.shelfCount) return undefined;
  return {
    presetId: inferred.id,
    width: inferred.width,
    height: inferred.height,
    depth: inferred.depth,
    shelfCount: inferred.shelfCount,
  };
}

/** Copies generated category, cut-list label and thickness onto the stored members. */
export function withCabinetMemberFields(
  parts: readonly CustomPart[],
  partIds: readonly string[],
  label: string,
  cabinet: CabinetConfig,
  legacyAxes: boolean,
): CustomPart[] {
  const layout = buildGroupCabinetLayout({ id: '', label, partIds: [...partIds], cabinet }, cabinet);
  return withGeneratedMemberFields(parts, partIds, layout, legacyAxes);
}

/**
 * Repairs member fields from the cabinet layout. A missing configuration is
 * inferred only for a legacy file. A current file keeps the group plain.
 */
export function cabinetLoadedFromGroup(input: {
  label: string;
  partIds: readonly string[];
  parts: readonly CustomPart[];
  cabinet: CabinetConfig | undefined;
  legacyAxes: boolean;
}): { cabinet: CabinetConfig | undefined; parts: readonly CustomPart[] } {
  const cabinet =
    input.cabinet ?? (input.legacyAxes ? cabinetFromLegacyGroup(input.label, input.partIds, input.parts) : undefined);
  if (!cabinet) return { cabinet: undefined, parts: input.parts };
  return {
    cabinet,
    parts: withCabinetMemberFields(input.parts, input.partIds, input.label, cabinet, input.legacyAxes),
  };
}

/**
 * Repairs one saved group. A cabinet configuration wins over a drawer
 * configuration. A missing cabinet configuration is inferred only for a legacy
 * file. A drawer needs four parts. A current file with neither stays plain.
 */
export function loadedGeneratedGroup(input: {
  label: string;
  partIds: readonly string[];
  parts: readonly CustomPart[];
  cabinet: CabinetConfig | undefined;
  drawer: DrawerConfig | undefined;
  legacyAxes: boolean;
}): {
  cabinet: CabinetConfig | undefined;
  drawer: DrawerConfig | undefined;
  parts: readonly CustomPart[];
} {
  const loadedCabinet = cabinetLoadedFromGroup({
    label: input.label,
    partIds: input.partIds,
    parts: input.parts,
    cabinet: input.cabinet,
    legacyAxes: input.legacyAxes,
  });
  if (loadedCabinet.cabinet) {
    return { cabinet: loadedCabinet.cabinet, drawer: undefined, parts: loadedCabinet.parts };
  }
  if (!input.drawer || input.partIds.length !== DRAWER_MEMBER_COUNT) {
    return { cabinet: undefined, drawer: undefined, parts: input.parts };
  }
  const layout = buildDrawerLayout({ ...input.drawer, label: input.label });
  return {
    cabinet: undefined,
    drawer: input.drawer,
    parts: withGeneratedMemberFields(input.parts, input.partIds, layout, false),
  };
}
