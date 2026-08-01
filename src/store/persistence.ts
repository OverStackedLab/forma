import { DISPLAY_UNITS, type DisplayUnit } from '@/domain/units';
import { isGridSizeM, type GridSizeM } from '@/domain/workspace';
import { buildCabinetLayout } from '@/domain/cabinets';
import {
  CABINET_PRESETS,
  CUSTOM_PANEL_LIMITS,
  isColorId,
  isHardwareFinishId,
  isMaterialId,
  PANEL_PRESETS,
} from '@/domain/catalog';
import type {
  CabinetConfig,
  CustomPart,
  DimensionAxis,
  DocumentSnapshot,
  EdgeBandSide,
  FormaDocument,
  Group,
  PartOverride,
  SavedVersion,
  Transform,
} from '@/domain/types';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';

const STORAGE_KEY = 'forma:doc';
/** A display preference, not document data — its own key, no schema versioning. */
const DISPLAY_UNIT_KEY = 'forma:displayUnit';
/** Likewise a view setting: which grid the viewport draws, not part of the design. */
const GRID_SIZE_KEY = 'forma:gridSize';
/**
 * Schema 4 gives parts explicit manufacturing metadata and world-aligned
 * dimensions. Schema 3 saves are migrated, including their rotated side
 * panels and Y-axis cylinders. Older parametric formats still have no safe
 * mapping onto the empty-canvas designer.
 */
const SCHEMA_VERSION = 4;
const DEBOUNCE_MS = 600;

type Envelope = { schemaVersion: number; doc: FormaDocument };

function migrate(raw: unknown): FormaDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as Partial<Envelope>;
  if (typeof envelope.schemaVersion !== 'number' || !envelope.doc) return null;

  switch (envelope.schemaVersion) {
    case SCHEMA_VERSION:
      return normalize(envelope.doc);
    case 3:
      return normalize(envelope.doc, true);
    default:
      // Older sideboard-shaped saves, or a version we no longer understand.
      return null;
  }
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function validTuple(value: unknown, length: number): number[] | null {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite)
    ? value as number[]
    : null;
}

const EDGE_BAND_SIDES: readonly EdgeBandSide[] = [
  'w-min', 'w-max', 'h-min', 'h-max', 'd-min', 'd-max',
];

function inferredPreset(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('knob')) return PANEL_PRESETS.find((preset) => preset.id === 'knob');
  if (normalized.includes('door')) return PANEL_PRESETS.find((preset) => preset.id === 'door');
  if (normalized.includes('back')) return PANEL_PRESETS.find((preset) => preset.id === 'back');
  if (normalized.includes('divider')) return PANEL_PRESETS.find((preset) => preset.id === 'divider');
  if (normalized.includes('side')) return PANEL_PRESETS.find((preset) => preset.id === 'flat');
  if (normalized.includes('shelf')) return PANEL_PRESETS.find((preset) => preset.id === 'shelf');
  return undefined;
}

function normalizePart(value: unknown): CustomPart | null {
  const part = asRecord(value);
  if (!part || typeof part.id !== 'string' || !part.id || typeof part.label !== 'string') return null;
  if (part.shape !== 'box' && part.shape !== 'cylinder') return null;
  const clampDimension = (axis: 'w' | 'h' | 'd') => {
    const raw = part[axis];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
    const limits = CUSTOM_PANEL_LIMITS[axis];
    return Math.min(limits.max, Math.max(limits.min, raw));
  };
  const w = clampDimension('w');
  const h = clampDimension('h');
  const d = clampDimension('d');
  if (w === null || h === null || d === null) return null;
  const thicknessAxis = part.thicknessAxis;
  const validAxis = thicknessAxis === 'w' || thicknessAxis === 'h' || thicknessAxis === 'd';
  const label = part.label.trim() || 'Untitled Part';
  const explicitPreset =
    typeof part.presetId === 'string'
      ? PANEL_PRESETS.find((preset) => preset.id === part.presetId)
      : undefined;
  const preset = explicitPreset ?? inferredPreset(label);
  const category =
    part.category === 'panel' || part.category === 'front' || part.category === 'hardware'
      ? part.category
      : preset?.category ?? (part.shape === 'cylinder' ? 'hardware' : 'panel');
  const grainAxis =
    part.grainAxis === 'w' || part.grainAxis === 'h' || part.grainAxis === 'd'
      ? part.grainAxis
      : category === 'hardware'
        ? null
        : preset?.grainAxis ?? 'w';
  const edgeBanding = Array.isArray(part.edgeBanding)
    ? [...new Set(part.edgeBanding.filter((edge): edge is EdgeBandSide =>
        typeof edge === 'string' && (EDGE_BAND_SIDES as readonly string[]).includes(edge),
      ))]
    : [...(preset?.edgeBanding ?? [])];
  return {
    id: part.id,
    label,
    category,
    presetId: explicitPreset?.id,
    bomLabel: typeof part.bomLabel === 'string' && part.bomLabel.trim() ? part.bomLabel : undefined,
    w,
    h,
    d,
    shape: part.shape,
    thicknessAxis: part.shape === 'cylinder' ? null : validAxis ? thicknessAxis as DimensionAxis : undefined,
    grainAxis,
    edgeBanding,
  };
}

function multiplyQuaternion(
  a: Transform['quaternion'],
  b: Transform['quaternion'],
): Transform['quaternion'] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Converts schema-3 local-axis parts to the world-axis convention. */
function normalizeLegacyAxes(part: CustomPart, transform: Transform): void {
  if (part.shape === 'cylinder') {
    [part.h, part.d] = [part.d, part.h];
    [transform.scale[1], transform.scale[2]] = [transform.scale[2], transform.scale[1]];
    transform.quaternion = multiplyQuaternion(
      transform.quaternion,
      [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
    );
    return;
  }
  if (!/(side|divider)/i.test(part.label)) return;
  [part.w, part.d] = [part.d, part.w];
  [transform.scale[0], transform.scale[2]] = [transform.scale[2], transform.scale[0]];
  part.thicknessAxis = 'w';
  part.grainAxis = 'h';
  part.edgeBanding = ['d-max'];
  transform.quaternion = multiplyQuaternion(
    transform.quaternion,
    [0, -Math.SQRT1_2, 0, Math.SQRT1_2],
  );
}

function normalizeTransform(value: unknown): Transform | null {
  const transform = asRecord(value);
  if (!transform) return null;
  const rawPosition = validTuple(transform.position, 3);
  const rawQuaternion = validTuple(transform.quaternion, 4);
  const rawScale = validTuple(transform.scale, 3);
  if (!rawPosition || !rawQuaternion || !rawScale) return null;
  const position = rawPosition.map((v) => Math.min(10, Math.max(-10, v))) as Transform['position'];
  const qLength = Math.hypot(...rawQuaternion);
  const quaternion: Transform['quaternion'] = qLength > 1e-8
    ? rawQuaternion.map((v) => v / qLength) as Transform['quaternion']
    : [0, 0, 0, 1];
  const scale = rawScale.map((v) => Math.min(100, Math.max(0.001, v))) as Transform['scale'];
  return { position, quaternion, scale };
}

function normalizeSnapshot(value: unknown, legacyAxes = false): DocumentSnapshot {
  const base = createDefaultDocument();
  const doc = asRecord(value) ?? {};
  const seenIds = new Set<string>();
  const customParts = (Array.isArray(doc.customParts) ? doc.customParts : [])
    .map(normalizePart)
    .filter((part): part is CustomPart => {
      if (!part || seenIds.has(part.id)) return false;
      seenIds.add(part.id);
      return true;
    });
  const liveIds = new Set(customParts.map((part) => part.id));

  const transforms: DocumentSnapshot['transforms'] = {};
  const rawTransforms = asRecord(doc.transforms);
  for (const [index, part] of customParts.entries()) {
    transforms[part.id] = normalizeTransform(rawTransforms?.[part.id]) ?? {
      position: [index * 0.1, part.h / 2000, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    };
    if (legacyAxes) normalizeLegacyAxes(part, transforms[part.id]!);
  }

  const overrides: DocumentSnapshot['overrides'] = {};
  const rawOverrides = asRecord(doc.overrides);
  for (const id of liveIds) {
    const raw = asRecord(rawOverrides?.[id]);
    if (!raw) continue;
    const override: PartOverride = {};
    if (typeof raw.material === 'string' && isMaterialId(raw.material)) override.material = raw.material;
    if (typeof raw.color === 'string' && isColorId(raw.color)) override.color = raw.color;
    if (override.material || override.color) overrides[id] = override;
  }

  const occupied = new Set<string>();
  const groups: Group[] = [];
  for (const value of Array.isArray(doc.groups) ? doc.groups : []) {
    const raw = asRecord(value);
    if (!raw || typeof raw.id !== 'string' || typeof raw.label !== 'string') continue;
    const partIds = Array.isArray(raw.partIds)
      ? [...new Set(raw.partIds.filter((id): id is string => typeof id === 'string' && liveIds.has(id)))]
          .filter((id) => !occupied.has(id))
      : [];
    if (partIds.length < 2) continue;
    partIds.forEach((id) => occupied.add(id));
    const label = raw.label.trim() || 'Group';
    const rawCabinet = asRecord(raw.cabinet);
    const memberLabels = partIds
      .map((id) => customParts.find((part) => part.id === id)?.label ?? '')
      .join(' ');
    const inferredCabinet = CABINET_PRESETS.find(
      (preset) => preset.label === label || memberLabels.includes(`${preset.label} Left Side`),
    );
    let cabinet: CabinetConfig | undefined;
    const dimensionsValid = rawCabinet &&
      typeof rawCabinet.width === 'number' && Number.isFinite(rawCabinet.width) &&
      typeof rawCabinet.height === 'number' && Number.isFinite(rawCabinet.height) &&
      typeof rawCabinet.depth === 'number' && Number.isFinite(rawCabinet.depth) &&
      typeof rawCabinet.shelfCount === 'number' && Number.isInteger(rawCabinet.shelfCount);
    if (dimensionsValid) {
      cabinet = {
        presetId:
          typeof rawCabinet.presetId === 'string' &&
          CABINET_PRESETS.some((preset) => preset.id === rawCabinet.presetId)
            ? rawCabinet.presetId as CabinetConfig['presetId']
            : undefined,
        width: Math.min(3000, Math.max(100, rawCabinet.width as number)),
        height: Math.min(3000, Math.max(100, rawCabinet.height as number)),
        depth: Math.min(1500, Math.max(100, rawCabinet.depth as number)),
        shelfCount: Math.min(8, Math.max(0, rawCabinet.shelfCount as number)),
      };
    } else if (inferredCabinet && partIds.length === 5 + inferredCabinet.shelfCount) {
      cabinet = {
        presetId: inferredCabinet.id,
        width: inferredCabinet.width,
        height: inferredCabinet.height,
        depth: inferredCabinet.depth,
        shelfCount: inferredCabinet.shelfCount,
      };
    }
    if (cabinet) {
      const layout = buildCabinetLayout({
        id: cabinet.presetId ?? CABINET_PRESETS[0]!.id,
        label,
        width: cabinet.width,
        height: cabinet.height,
        depth: cabinet.depth,
        shelfCount: cabinet.shelfCount,
        icon: 'cabinet',
      });
      partIds.forEach((id, index) => {
        const stored = customParts.find((part) => part.id === id);
        const generated = layout[index];
        if (!stored || !generated) return;
        stored.category = generated.category;
        stored.bomLabel = generated.bomLabel;
        stored.thicknessAxis = generated.thicknessAxis;
        stored.grainAxis = generated.grainAxis;
        stored.edgeBanding = [...generated.edgeBanding];
      });
    }
    groups.push({ id: raw.id, label, partIds, cabinet });
  }

  return {
    defaultMaterialId:
      typeof doc.defaultMaterialId === 'string' && isMaterialId(doc.defaultMaterialId)
        ? doc.defaultMaterialId
        : base.defaultMaterialId,
    defaultColorId:
      typeof doc.defaultColorId === 'string' && isColorId(doc.defaultColorId)
        ? doc.defaultColorId
        : base.defaultColorId,
    defaultHardwareFinishId:
      typeof doc.defaultHardwareFinishId === 'string' && isHardwareFinishId(doc.defaultHardwareFinishId)
        ? doc.defaultHardwareFinishId
        : base.defaultHardwareFinishId,
    overrides,
    customParts,
    hiddenIds: Array.isArray(doc.hiddenIds)
      ? [...new Set(doc.hiddenIds.filter((id): id is string => typeof id === 'string' && liveIds.has(id)))]
      : [],
    transforms,
    groups,
  };
}

/** Guards against a hand-edited or partially-written payload. */
function normalize(value: Partial<FormaDocument>, legacyAxes = false): FormaDocument {
  const base = createDefaultDocument();
  const raw = asRecord(value) ?? {};
  const snapshot = normalizeSnapshot(raw, legacyAxes);
  const versions: SavedVersion[] = [];
  for (const value of Array.isArray(raw.versions) ? raw.versions : []) {
    const version = asRecord(value);
    if (
      !version ||
      typeof version.id !== 'string' ||
      typeof version.label !== 'string' ||
      typeof version.createdAt !== 'number' ||
      !Number.isFinite(version.createdAt)
    ) continue;
    versions.push({
      id: version.id,
      label: version.label,
      createdAt: version.createdAt,
      doc: normalizeSnapshot(version.doc, legacyAxes),
    });
  }
  const currentVersionId =
    typeof raw.currentVersionId === 'string' && versions.some((version) => version.id === raw.currentVersionId)
      ? raw.currentVersionId
      : null;
  return {
    ...snapshot,
    docTitle: typeof raw.docTitle === 'string' && raw.docTitle.trim() ? raw.docTitle : base.docTitle,
    versions,
    currentVersionId,
  };
}

export function loadDocument(): FormaDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function write(doc: FormaDocument): void {
  const ui = useUiStore.getState();
  try {
    const envelope: Envelope = { schemaVersion: SCHEMA_VERSION, doc };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    ui.setSaveStatus('saved', Date.now());
  } catch {
    // Quota exceeded, private-mode restrictions, or serialization failure.
    ui.setSaveStatus('error');
  }
}

/**
 * Debounced autosave. Returns an unsubscribe function. The status bar reports
 * the real result — in the prototype "Autosaved" was hardcoded text.
 */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = useDocumentStore.subscribe((state) => {
    useUiStore.getState().setSaveStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(() => write(stripActions(state)), DEBOUNCE_MS);
  });

  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    write(stripActions(useDocumentStore.getState()));
  };
  window.addEventListener('beforeunload', flush);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('beforeunload', flush);
    unsubscribe();
  };
}

/** The store carries its own action functions; only the data is persisted. */
function stripActions(state: FormaDocument & Record<string, unknown>): FormaDocument {
  return {
    defaultMaterialId: state.defaultMaterialId,
    defaultColorId: state.defaultColorId,
    defaultHardwareFinishId: state.defaultHardwareFinishId,
    overrides: state.overrides,
    customParts: state.customParts,
    hiddenIds: state.hiddenIds,
    transforms: state.transforms,
    groups: state.groups,
    docTitle: state.docTitle,
    versions: state.versions,
    currentVersionId: state.currentVersionId,
  };
}

export function loadDisplayUnit(): DisplayUnit | null {
  try {
    const raw = localStorage.getItem(DISPLAY_UNIT_KEY);
    return (DISPLAY_UNITS as readonly string[]).includes(raw ?? '') ? (raw as DisplayUnit) : null;
  } catch {
    return null;
  }
}

/** Saves immediately — a deliberate, rare toggle, not a per-keystroke stream. */
export function startDisplayUnitSync(): () => void {
  return useUiStore.subscribe(
    (s) => s.displayUnit,
    (unit) => {
      try {
        localStorage.setItem(DISPLAY_UNIT_KEY, unit);
      } catch {
        // Quota exceeded or private-mode restrictions — the preference just
        // won't survive a reload; nothing else depends on it succeeding.
      }
    },
  );
}

/** Null rather than the default for an unknown value, so App can skip the setter entirely. */
export function loadGridSize(): GridSizeM | null {
  try {
    const raw = localStorage.getItem(GRID_SIZE_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    // Reject corrupt or out-of-range preferences rather than loading them unchecked.
    return isGridSizeM(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves immediately — a deliberate, rare change, like the display unit. */
export function startGridSizeSync(): () => void {
  return useUiStore.subscribe(
    (s) => s.gridSizeM,
    (size) => {
      try {
        localStorage.setItem(GRID_SIZE_KEY, String(size));
      } catch {
        // Same rationale as the display-unit sync: the preference just won't
        // survive a reload, and nothing else depends on it succeeding.
      }
    },
  );
}

export { SCHEMA_VERSION, STORAGE_KEY, migrate, normalize };
