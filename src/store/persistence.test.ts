import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from './documentStore';
import { loadFormaText, migrate, normalize, SCHEMA_VERSION } from './persistence';

describe('design notes persistence', () => {
  it('loads a current-schema document without notes as an empty string', () => {
    const { notes: _notes, ...legacy } = createDefaultDocument();
    const doc = migrate({ schemaVersion: SCHEMA_VERSION, doc: legacy });
    expect(doc?.notes).toBe('');
  });

  it('defaults non-string notes to an empty string', () => {
    expect(normalize({ ...createDefaultDocument(), notes: 42 }).notes).toBe('');
  });

  it('round-trips notes through the saved envelope', () => {
    const text = 'Check fridge gap: 600 vs 610 mm\nClient wants walnut fronts';
    const saved = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      doc: { ...createDefaultDocument(), notes: text },
    });
    const result = loadFormaText(saved);
    expect(result.ok && result.doc.notes).toBe(text);
  });

  it('keeps notes on saved versions and omits them for older versions', () => {
    const base = createDefaultDocument();
    const { versions: _v, docTitle: _t, notes: _n, currentVersionId: _c, ...snapshot } = base;
    const doc = normalize({
      ...base,
      versions: [
        { id: 'v1', label: 'Version 1', createdAt: 1, doc: snapshot },
        { id: 'v2', label: 'Version 2', createdAt: 2, doc: snapshot, notes: 'walnut' },
      ],
    });
    expect(doc.versions[0]).not.toHaveProperty('notes');
    expect(doc.versions[1]?.notes).toBe('walnut');
  });
});
