import { DISPLAY_UNITS, type DisplayUnit } from '@/domain/units';
import type { FormaDocument } from '@/domain/types';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';

const STORAGE_KEY = 'forma:doc';
/** A display preference, not document data — its own key, no schema versioning. */
const DISPLAY_UNIT_KEY = 'forma:displayUnit';
/**
 * Schema 2 is the empty-scene / library-panels-only document shape. Schema 1
 * was the parametric-sideboard shape (dims, leg/handle/base style, deleted
 * fixed parts) — there's no sensible mapping from a sideboard's doors and legs
 * onto a scene that only has library panels, so schema 1 saves aren't
 * migrated; they fall back to a fresh empty document.
 */
const SCHEMA_VERSION = 2;
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

/** Guards against a hand-edited or partially-written payload. */
function normalize(doc: Partial<FormaDocument>): FormaDocument {
  const base = createDefaultDocument();
  return {
    ...base,
    ...doc,
    overrides: doc.overrides ?? {},
    customParts: Array.isArray(doc.customParts) ? doc.customParts : [],
    hiddenIds: Array.isArray(doc.hiddenIds) ? doc.hiddenIds : [],
    transforms: doc.transforms ?? {},
    // Added after schema 2 shipped; older saves simply lack it.
    groups: Array.isArray(doc.groups) ? doc.groups : [],
    versions: Array.isArray(doc.versions) ? doc.versions : [],
    currentVersionId: doc.currentVersionId ?? null,
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
    defaultFinishId: state.defaultFinishId,
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
