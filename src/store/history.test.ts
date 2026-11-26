import { beforeEach, describe, expect, it } from 'vitest';
import { setNotes } from './actions';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { canUndo, clearHistory, commit, undo } from './history';

describe('design notes and undo', () => {
  beforeEach(() => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    clearHistory();
  });

  it('does not push an undo step while typing notes', () => {
    setNotes('a');
    setNotes('ab');
    expect(useDocumentStore.getState().notes).toBe('ab');
    expect(canUndo()).toBe(false);
  });

  it('keeps the latest notes when a geometry edit is undone', () => {
    commit(() => useDocumentStore.setState({ hiddenIds: ['p1'] }));
    setNotes('keep me');
    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().hiddenIds).toEqual([]);
    expect(useDocumentStore.getState().notes).toBe('keep me');
  });
});
