import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_COLOR_ID, DEFAULT_MATERIAL_ID } from '@/domain/catalog';
import type { DocumentSnapshot, FormaDocument, SavedVersion, Transform } from '@/domain/types';

export const DOC_KEYS = [
  'defaultMaterialId',
  'defaultColorId',
  'overrides',
  'customParts',
  'hiddenIds',
  'transforms',
  'groups',
] as const satisfies readonly (keyof DocumentSnapshot)[];

/** An empty scene — the only way to add geometry is from the panel library. */
export function createDefaultDocument(): FormaDocument {
  return {
    defaultMaterialId: DEFAULT_MATERIAL_ID,
    defaultColorId: DEFAULT_COLOR_ID,
    overrides: {},
    customParts: [],
    hiddenIds: [],
    transforms: {},
    groups: [],
    docTitle: 'Untitled Design',
    versions: [],
    currentVersionId: null,
  };
}

export type DocumentStore = FormaDocument & {
  /** Replaces the whole undoable slice — used by undo, redo and version restore. */
  replaceSnapshot: (snapshot: DocumentSnapshot) => void;
  setVersions: (versions: SavedVersion[], currentVersionId: string | null) => void;
  setDocTitle: (title: string) => void;
  hydrate: (doc: FormaDocument) => void;
};

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((set) => ({
    ...createDefaultDocument(),
    replaceSnapshot: (snapshot) => set({ ...snapshot }),
    setVersions: (versions, currentVersionId) => set({ versions, currentVersionId }),
    setDocTitle: (docTitle) => set({ docTitle }),
    hydrate: (doc) => set({ ...doc }),
  })),
);

/** A structural clone of everything undo, autosave and versions must capture. */
export function snapshotDocument(
  state: FormaDocument = useDocumentStore.getState(),
): DocumentSnapshot {
  return {
    defaultMaterialId: state.defaultMaterialId,
    defaultColorId: state.defaultColorId,
    overrides: structuredClone(state.overrides),
    customParts: structuredClone(state.customParts),
    hiddenIds: [...state.hiddenIds],
    transforms: structuredClone(state.transforms),
    groups: structuredClone(state.groups),
  };
}

export const IDENTITY_TRANSFORM: Transform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};
