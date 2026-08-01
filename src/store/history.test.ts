import { beforeEach, describe, expect, it } from 'vitest';
import type { SavedVersion } from '@/domain/types';
import { createDefaultDocument, snapshotDocument, useDocumentStore } from './documentStore';
import { clearHistory, commit, undo } from './history';

describe('document history', () => {
  beforeEach(() => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
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
});
