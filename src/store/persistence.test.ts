import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from './documentStore';
import { migrate, normalize, SCHEMA_VERSION } from './persistence';

describe('persistence.migrate', () => {
  it('accepts a current-schema payload', () => {
    const doc = createDefaultDocument();
    const result = migrate({ schemaVersion: SCHEMA_VERSION, doc });
    expect(result?.defaultFinishId).toBe(doc.defaultFinishId);
  });

  it('rejects a payload with no schema version', () => {
    expect(migrate({ doc: createDefaultDocument() })).toBeNull();
  });

  // Schema 1 was the parametric-sideboard shape; there's no sensible mapping
  // from its doors and legs onto a scene that only has library panels.
  it('rejects a pre-rewrite schema 1 payload rather than guessing a migration', () => {
    expect(migrate({ schemaVersion: 1, doc: { dims: { width: 900 } } })).toBeNull();
  });

  it('rejects a schema version it does not understand', () => {
    expect(migrate({ schemaVersion: 999, doc: createDefaultDocument() })).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('nope')).toBeNull();
    expect(migrate(42)).toBeNull();
  });
});

describe('persistence.normalize', () => {
  it('fills in missing collections rather than yielding undefined', () => {
    const result = normalize({} as never);
    expect(result.customParts).toEqual([]);
    expect(result.hiddenIds).toEqual([]);
    expect(result.transforms).toEqual({});
    expect(result.versions).toEqual([]);
  });

  it('keeps a valid defaultFinishId', () => {
    const result = normalize({ defaultFinishId: 'ebony' } as never);
    expect(result.defaultFinishId).toBe('ebony');
  });

  it('repairs collections stored with the wrong type', () => {
    const result = normalize({ customParts: 'corrupt', hiddenIds: 7 } as never);
    expect(result.customParts).toEqual([]);
    expect(result.hiddenIds).toEqual([]);
  });
});
