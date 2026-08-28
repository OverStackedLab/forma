import { describe, expect, it } from 'vitest';
import {
  addCabinetDivider,
  addCabinetPreset,
  setCustomPartDim,
  setPartGrainAxis,
  togglePartEdgeBand,
} from './actions';
import { createDefaultDocument, useDocumentStore } from './documentStore';
import { clearHistory } from './history';
import { loadFormaText, migrate, normalize, SCHEMA_VERSION } from './persistence';
import { useUiStore } from './uiStore';

describe('persistence.migrate', () => {
  it('accepts a current-schema payload', () => {
    const doc = createDefaultDocument();
    const result = migrate({ schemaVersion: SCHEMA_VERSION, doc });
    expect(result?.defaultMaterialId).toBe(doc.defaultMaterialId);
    expect(result?.defaultColorId).toBe(doc.defaultColorId);
    expect(result?.defaultHardwareFinishId).toBe(doc.defaultHardwareFinishId);
  });

  it('resets appearance defaults when migrating schema 4 to the current catalog', () => {
    const doc = {
      ...createDefaultDocument(),
      defaultMaterialId: 'ash' as const,
      defaultColorId: 'dark-gray' as const,
      defaultHardwareFinishId: 'brushed-brass' as const,
    };
    const result = migrate({ schemaVersion: 4, doc });
    expect(result?.defaultMaterialId).toBe('ash');
    expect(result?.defaultColorId).toBe('white');
    expect(result?.defaultHardwareFinishId).toBe('matte-black');
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

  it('rejects a payload that is not a Forma envelope or document', () => {
    expect(migrate({ hello: 'world' })).toBeNull();
  });

  it('accepts a wrapped document that omitted schemaVersion', () => {
    const doc = createDefaultDocument();
    expect(migrate({ doc })?.defaultMaterialId).toBe(doc.defaultMaterialId);
  });

  it('accepts schemaVersion stored as a string', () => {
    const doc = {
      ...createDefaultDocument(),
      defaultColorId: 'dark-gray' as const,
    };
    expect(migrate({ schemaVersion: '4', doc })?.defaultColorId).toBe('white');
    expect(migrate({ schemaVersion: '5', doc })?.defaultColorId).toBe('dark-gray');
  });

  it('accepts document as an alias for doc', () => {
    const doc = createDefaultDocument();
    expect(migrate({ schemaVersion: 5, document: doc })?.customParts).toEqual(doc.customParts);
  });

  it('accepts a bare document without an envelope', () => {
    const doc = createDefaultDocument();
    expect(migrate(doc)?.groups).toEqual(doc.groups);
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
    expect(result.defaultHardwareFinishId).toBe('matte-black');
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

  it('preserves cabinet grain and edge-banding edits across a current-schema reload', () => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({ selectedPartIds: [], toast: null });
    clearHistory();
    addCabinetPreset('base-600');
    const leftSide = useDocumentStore.getState().customParts.find((part) =>
      part.label.includes('Left Side'),
    )!;
    setPartGrainAxis(leftSide.id, 'd');
    togglePartEdgeBand(leftSide.id, 'h-max');

    const saved = useDocumentStore.getState();
    const reloaded = migrate({
      schemaVersion: SCHEMA_VERSION,
      doc: {
        ...saved,
        versions: [],
        currentVersionId: null,
      },
    });
    const restored = reloaded?.customParts.find((part) => part.id === leftSide.id);
    expect(restored?.grainAxis).toBe('d');
    expect(restored?.edgeBanding).toContain('h-max');
  });

  it('round-trips cabinet vertical panel positions on the current schema', () => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({ selectedPartIds: [], toast: null });
    clearHistory();
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    addCabinetDivider(group.id, 300);

    const saved = useDocumentStore.getState();
    const reloaded = migrate({
      schemaVersion: SCHEMA_VERSION,
      doc: {
        ...saved,
        versions: [],
        currentVersionId: null,
      },
    });
    expect(reloaded?.groups[0]?.cabinet?.dividerPositionsMm).toEqual([300]);
    expect(reloaded?.customParts.filter((part) => part.label.includes('Panel'))).toHaveLength(1);
    expect(reloaded?.customParts.filter((part) => part.label.includes('Shelf'))).toHaveLength(2);
  });

  it('does not resurrect a demoted cabinet from its label on current-schema reload', () => {
    useDocumentStore.getState().hydrate(createDefaultDocument());
    useUiStore.setState({ selectedPartIds: [], toast: null });
    clearHistory();
    addCabinetPreset('base-600');
    const group = useDocumentStore.getState().groups[0]!;
    setCustomPartDim(group.partIds[0]!, 'h', 700);
    expect(useDocumentStore.getState().groups[0]?.cabinet).toBeUndefined();

    const saved = useDocumentStore.getState();
    const reloaded = migrate({
      schemaVersion: SCHEMA_VERSION,
      doc: {
        ...saved,
        versions: [],
        currentVersionId: null,
      },
    });
    expect(reloaded?.groups[0]?.cabinet).toBeUndefined();
    expect(reloaded?.groups[0]?.label).toBe('Base 600');
  });
});

describe('persistence.loadFormaText', () => {
  it('strips a UTF-8 BOM before parsing', () => {
    const envelope = { schemaVersion: SCHEMA_VERSION, doc: createDefaultDocument() };
    const result = loadFormaText(`\uFEFF${JSON.stringify(envelope)}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.defaultMaterialId).toBe(envelope.doc.defaultMaterialId);
  });

  it('unwraps a JSON string that was encoded twice', () => {
    const envelope = { schemaVersion: SCHEMA_VERSION, doc: createDefaultDocument() };
    const result = loadFormaText(JSON.stringify(JSON.stringify(envelope)));
    expect(result.ok).toBe(true);
  });

  it('reports an empty truncated save separately from invalid JSON', () => {
    expect(loadFormaText('')).toEqual({ ok: false, reason: 'empty' });
    expect(loadFormaText('\uFEFF  \n')).toEqual({ ok: false, reason: 'empty' });
    expect(loadFormaText('{')).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('reports unsupported versions without throwing', () => {
    expect(loadFormaText(JSON.stringify({ hello: 'world' }))).toEqual({
      ok: false,
      reason: 'unsupported',
    });
    expect(loadFormaText(JSON.stringify({ schemaVersion: 1, doc: { dims: { width: 900 } } }))).toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });
});
