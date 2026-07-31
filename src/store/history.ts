import { livePartIds } from '@/domain/parts';
import type { DocumentSnapshot } from '@/domain/types';
import { snapshotDocument, useDocumentStore } from './documentStore';
import { pruneSelection } from './uiStore';

const MAX_DEPTH = 50;

const undoStack: DocumentSnapshot[] = [];
const redoStack: DocumentSnapshot[] = [];

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
export function commit(mutate: () => void): void {
  undoStack.push(snapshotDocument());
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  redoStack.length = 0;
  mutate();
  notify();
}

export function undo(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  redoStack.push(snapshotDocument());
  applySnapshot(previous);
  notify();
  return true;
}

export function redo(): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  undoStack.push(snapshotDocument());
  applySnapshot(next);
  notify();
  return true;
}

function applySnapshot(snapshot: DocumentSnapshot): void {
  useDocumentStore.getState().replaceSnapshot(snapshot);
  pruneSelection(livePartIds(useDocumentStore.getState().customParts));
}

export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  notify();
}
