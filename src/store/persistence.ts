import { DISPLAY_UNITS, type DisplayUnit } from '@/domain/units';
import { CUSTOM_PANEL_LIMITS, isColorId, isMaterialId } from '@/domain/catalog';
import type {
  CustomPart,
  DimensionAxis,
  DocumentSnapshot,
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
/**
 * Schema 3 splits the single "finish" (defaultFinishId / an override's
 * `body`) into an independent material and color, and adds a `shape` to each
 * custom part. Schema 2 was the empty-scene / library-panels-only shape with
 * one combined finish; schema 1 was the parametric-sideboard shape. Neither
 * maps sensibly onto the new fields, so only the current schema is accepted —
 * older saves fall back to a fresh empty document.
 */
const SCHEMA_VERSION = 3;
const DEBOUNCE_MS = 600;

type Envelope = { schemaVersion: number; doc: FormaDocument };

function migrate(raw: unknown): FormaDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as Partial<Envelope>;
  if (typeof envelope.schemaVersion !== 'number' || !envelope.doc) return null;

  switch (envelope.schemaVersion) {
    case SCHEMA_VERSION:
      return normalize(envelope.doc);
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
  return {
    id: part.id,
    label: part.label.trim() || 'Untitled Part',
    w,
    h,
    d,
    shape: part.shape,
    thicknessAxis: part.shape === 'cylinder' ? null : validAxis ? thicknessAxis as DimensionAxis : undefined,
  };
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

function normalizeSnapshot(value: unknown): DocumentSnapshot {
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
    groups.push({ id: raw.id, label: raw.label.trim() || 'Group', partIds });
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
function normalize(value: Partial<FormaDocument>): FormaDocument {
  const base = createDefaultDocument();
  const raw = asRecord(value) ?? {};
  const snapshot = normalizeSnapshot(raw);
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
      doc: normalizeSnapshot(version.doc),
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

export { SCHEMA_VERSION, STORAGE_KEY, migrate, normalize };
