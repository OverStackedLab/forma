import { beforeEach, describe, expect, it } from 'vitest';
import type { SavedVersion } from '@/domain/types';
import { addCustomPanel, renameDocument, saveVersion } from './actions';
import { createDefaultDocument, snapshotDocument, useDocumentStore } from './documentStore';
import { clearHistory, commit, redo, undo } from './history';
import { useUiStore } from './uiStore';

describe('document history', () => {
  beforeEach(() => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({ selectedPartIds: [], toast: null });
    clearHistory();
  });

  it('clears Current after a change and restores it on undo', () => {
    const state = useDocumentStore.getState();
    const version: SavedVersion = {
      id: 'v1',
      label: 'Version 1',
      createdAt: 1,
      doc: snapshotDocument(state),
    };
    state.setVersions([version], version.id);

    commit(() => useDocumentStore.setState({ defaultMaterialId: 'ash' }));
    expect(useDocumentStore.getState().currentVersionId).toBeNull();

    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().currentVersionId).toBe(version.id);
  });

  it('undo restores title and version metadata as well as geometry', () => {
    const before = useDocumentStore.getState();
    commit(() => {
      useDocumentStore.setState({ docTitle: 'Opened Design', versions: [], currentVersionId: null });
    });
    expect(useDocumentStore.getState().docTitle).toBe('Opened Design');

    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().docTitle).toBe(before.docTitle);
    expect(useDocumentStore.getState().versions).toEqual(before.versions);
  });

  it('keeps Save Version checkpoints when undoing a later geometry edit', () => {
    addCustomPanel('shelf');
    saveVersion();
    expect(useDocumentStore.getState().versions).toHaveLength(1);

    addCustomPanel('door');
    expect(useDocumentStore.getState().customParts).toHaveLength(2);

    expect(undo()).toBe(true);
    const state = useDocumentStore.getState();
    expect(state.customParts).toHaveLength(1);
    expect(state.versions).toHaveLength(1);
    expect(state.currentVersionId).toBe(state.versions[0]!.id);

    // A further edit must not resurrect a path that deletes the checkpoint.
    commit(() => useDocumentStore.setState({ defaultMaterialId: 'ash' }));
    expect(redo()).toBe(false);
    expect(useDocumentStore.getState().versions).toHaveLength(1);
  });

  it('keeps a document rename when undoing a later geometry edit', () => {
    addCustomPanel('shelf');
    renameDocument('Kitchen Run');
    addCustomPanel('door');

    expect(undo()).toBe(true);
    expect(useDocumentStore.getState().docTitle).toBe('Kitchen Run');
    expect(useDocumentStore.getState().customParts).toHaveLength(1);
  });
});
