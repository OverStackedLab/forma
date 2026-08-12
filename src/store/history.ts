import { livePartIds } from '@/domain/parts';
import type { DocumentSnapshot, FormaDocument } from '@/domain/types';
import { snapshotDocument, useDocumentStore } from './documentStore';
import { pruneSelection } from './uiStore';

const MAX_DEPTH = 50;

const undoStack: FormaDocument[] = [];
const redoStack: FormaDocument[] = [];

/** Bumped on every stack change so React can re-render undo/redo affordances. */
let revision = 0;
const listeners = new Set<() => void>();

function notify(): void {
  revision++;
  for (const l of listeners) l();
}

export const historyStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): number {
    return revision;
  },
};

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

/**
 * Every document mutation goes through here. The snapshot covers the *entire*
 * undoable slice — including hiddenIds and transforms, which the prototype
 * omitted, so undoing a delete silently lost a part's placement.
 */
function fullSnapshot(): FormaDocument {
  const state = useDocumentStore.getState();
  return {
    ...snapshotDocument(state),
    docTitle: state.docTitle,
    versions: structuredClone(state.versions),
    currentVersionId: state.currentVersionId,
  };
}

function sameSnapshot(a: DocumentSnapshot | FormaDocument, b: DocumentSnapshot | FormaDocument): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function reconcileCurrentVersion(): void {
  const state = useDocumentStore.getState();
  const current = snapshotDocument(state);
  let matchingId: string | null = null;
  for (let i = state.versions.length - 1; i >= 0; i--) {
    const version = state.versions[i]!;
    if (sameSnapshot(version.doc, current)) {
      matchingId = version.id;
      break;
    }
  }
  if (state.currentVersionId !== matchingId) useDocumentStore.setState({ currentVersionId: matchingId });
}

export function commit(mutate: () => void): void {
  const before = fullSnapshot();
  mutate();
  reconcileCurrentVersion();
  if (sameSnapshot(before, fullSnapshot())) return;
  undoStack.push(before);
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  redoStack.length = 0;
  notify();
}

export function undo(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  redoStack.push(fullSnapshot());
  applySnapshot(previous);
  notify();
  return true;
}

export function redo(): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  undoStack.push(fullSnapshot());
  applySnapshot(next);
  notify();
  return true;
}

function applySnapshot(snapshot: FormaDocument): void {
  useDocumentStore.getState().hydrate(structuredClone(snapshot));
  pruneSelection(livePartIds(useDocumentStore.getState().customParts));
  // Stack entries may carry a stale currentVersionId after metadata sync
  // patches versions without rewriting which checkpoint matched that entry.
  reconcileCurrentVersion();
}

export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  notify();
}

/**
 * `saveVersion` and `renameDocument` intentionally skip `commit()` — they are
 * document metadata, not geometry edits. History snapshots still carry those
 * fields (so `openFile` can undo a whole document), which means an unpatched
 * stack would resurrect a pre-save/pre-rename meta state on the next Undo.
 * Push the live title and version list into every stacked snapshot so geometry
 * undo cannot silently destroy checkpoints or titles. `currentVersionId` is
 * left alone and re-derived on apply via `reconcileCurrentVersion`.
 */
export function syncHistoryDocumentMeta(): void {
  const state = useDocumentStore.getState();
  const docTitle = state.docTitle;
  const versions = structuredClone(state.versions);
  for (const entry of undoStack) {
    entry.docTitle = docTitle;
    entry.versions = structuredClone(versions);
  }
  for (const entry of redoStack) {
    entry.docTitle = docTitle;
    entry.versions = structuredClone(versions);
  }
}
