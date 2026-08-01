import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from './documentStore';
import { migrate, normalize, SCHEMA_VERSION } from './persistence';

describe('persistence.migrate', () => {
  it('accepts a current-schema payload', () => {
    const doc = createDefaultDocument();
    const result = migrate({ schemaVersion: SCHEMA_VERSION, doc });
    expect(result?.defaultMaterialId).toBe(doc.defaultMaterialId);
    expect(result?.defaultColorId).toBe(doc.defaultColorId);
    expect(result?.defaultHardwareFinishId).toBe(doc.defaultHardwareFinishId);
  });

  it('migrates schema-3 side panels and knobs into world-axis dimensions', () => {
    const doc = {
      ...createDefaultDocument(),
      customParts: [
        { id: 'side', label: 'Side Panel', w: 560, h: 720, d: 18, shape: 'box', thicknessAxis: 'd' },
        { id: 'knob', label: 'Knob', w: 32, h: 25, d: 32, shape: 'cylinder', thicknessAxis: null },
      ],
      transforms: {
        side: { position: [0, 0.36, 0], quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: [1, 1, 1] },
        knob: { position: [0, 0.016, 0], quaternion: [Math.SQRT1_2, 0, 0, Math.SQRT1_2], scale: [1, 1, 1] },
      },
    };
    const result = migrate({ schemaVersion: 3, doc });
    expect(result?.customParts[0]).toMatchObject({ w: 18, h: 720, d: 560, thicknessAxis: 'w' });
    expect(result?.customParts[1]).toMatchObject({ w: 32, h: 32, d: 25, category: 'hardware' });
    expect(result?.transforms.side?.quaternion).toEqual([0, 0, 0, 1]);
    expect(result?.transforms.knob?.quaternion).toEqual([0, 0, 0, 1]);
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
    expect(result.defaultHardwareFinishId).toBe('brushed-brass');
  });

  it('keeps a valid defaultMaterialId and defaultColorId', () => {
    const result = normalize({ defaultMaterialId: 'ash', defaultColorId: 'ebony' } as never);
    expect(result.defaultMaterialId).toBe('ash');
    expect(result.defaultColorId).toBe('ebony');
  });

  it('repairs collections stored with the wrong type', () => {
    const result = normalize({ customParts: 'corrupt', hiddenIds: 7 } as never);
    expect(result.customParts).toEqual([]);
    expect(result.hiddenIds).toEqual([]);
  });

  it('drops malformed parts and repairs a missing transform for a valid part', () => {
    const result = normalize({
      customParts: [
        null,
        { id: 'bad', label: 'Bad', w: -1, h: 20, d: 20, shape: 'box' },
        { id: 'good', label: 'Good', w: 800, h: 18, d: 300, shape: 'box' },
      ],
      transforms: {},
    } as never);
    expect(result.customParts.map((part) => part.id)).toEqual(['good']);
    expect(result.transforms.good).toEqual({
      position: [0, 0.009, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });
    expect(result.customParts[0]).toMatchObject({
      category: 'panel',
      grainAxis: 'w',
      edgeBanding: [],
    });
  });
});
