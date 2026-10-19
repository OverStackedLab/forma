import { describe, expect, it } from 'vitest';
import { createDemoKitchen } from './demoKitchen';
import { loadFormaText, SCHEMA_VERSION } from '../store/persistence';
import type { CustomPart, Transform } from './types';

describe('demo kitchen', () => {
  const doc = createDemoKitchen();

  it('builds a parametric run that reloads as a current-schema document', () => {
    expect(doc.docTitle).toBe('Demo kitchen');
    expect(doc.groups.map((group) => group.label)).toEqual([
      'Pantry',
      'Drawer base',
      'Base cabinet',
      'Glass base',
      'Hob base',
      'Wall cabinet',
      'Glass wall',
      'Wall cabinet',
      'Glass wall',
      'Drawer box 80×40 cm',
      'Drawer box 80×20 cm',
      'Drawer box 80×20 cm',
    ]);
    expect(doc.groups.filter((group) => group.cabinet)).toHaveLength(9);
    expect(doc.groups.filter((group) => group.drawer)).toHaveLength(3);
    for (const group of doc.groups) {
      expect(group.partIds.length).toBeGreaterThan(0);
      for (const id of group.partIds) {
        expect(doc.customParts.some((part) => part.id === id)).toBe(true);
        expect(doc.transforms[id]).toBeDefined();
      }
    }

    const loaded = loadFormaText(JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.doc.customParts).toHaveLength(doc.customParts.length);
    expect(loaded.doc.groups).toHaveLength(doc.groups.length);
    expect(loaded.doc.customParts.map((part) => part.shape)).toEqual(doc.customParts.map((part) => part.shape));
  });

  it('keeps every part from occupying another part', () => {
    const boxes = doc.customParts.map((part) => aabb(part, doc.transforms[part.id]));
    const clashes: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a || !b || !overlaps(a, b)) continue;
        clashes.push(`${doc.customParts[i]?.label} × ${doc.customParts[j]?.label}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('lines the wall tops up with the pantry and leaves a 600 mm gap over the bases', () => {
    const pantry = groupBox(doc, 'Pantry');
    const base = groupBox(doc, 'Drawer base');
    const wall = groupBox(doc, 'Wall cabinet');
    expect(pantry.maxY).toBeCloseTo(2200, 3);
    expect(wall.minY).toBeCloseTo(1400, 3);
    expect(wall.maxY).toBeCloseTo(pantry.maxY, 3);
    expect(wall.minY - base.maxY).toBeCloseTo(600, 3);
  });
});

type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

function aabb(part: CustomPart, transform: Transform | undefined): Box | null {
  if (!transform) return null;
  const [x, y, z] = transform.position.map((metre) => metre * 1000);
  if (x === undefined || y === undefined || z === undefined) return null;
  return {
    minX: x - part.w / 2,
    maxX: x + part.w / 2,
    minY: y - part.h / 2,
    maxY: y + part.h / 2,
    minZ: z - part.d / 2,
    maxZ: z + part.d / 2,
  };
}

function overlaps(a: Box, b: Box): boolean {
  const dx = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const dy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  const dz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return dx > 0.5 && dy > 0.5 && dz > 0.5;
}

function groupBox(doc: ReturnType<typeof createDemoKitchen>, label: string): Box {
  const group = doc.groups.find((candidate) => candidate.label === label);
  if (!group) throw new Error(`Missing group ${label}`);
  const boxes = group.partIds.map((id) => {
    const part = doc.customParts.find((candidate) => candidate.id === id);
    return part ? aabb(part, doc.transforms[id]) : null;
  }).filter((box): box is Box => box !== null);
  const first = boxes[0];
  if (!first) throw new Error(`Empty group ${label}`);
  return boxes.reduce((union, box) => ({
    minX: Math.min(union.minX, box.minX),
    maxX: Math.max(union.maxX, box.maxX),
    minY: Math.min(union.minY, box.minY),
    maxY: Math.max(union.maxY, box.maxY),
    minZ: Math.min(union.minZ, box.minZ),
    maxZ: Math.max(union.maxZ, box.maxZ),
  }), first);
}
