import { describe, expect, it } from 'vitest';
import {
  BODBYN_BEVEL_INSET_MM,
  BODBYN_BEVEL_THICKNESS_MM,
  BODBYN_BEVEL_WIDTH_MM,
  BODBYN_FRAME_MM,
  BODBYN_MUNTIN_MM,
  BODBYN_PANEL_INSET_MM,
  BODBYN_PANEL_MM,
  bodbynGlassPieces,
  bodbynPieces,
} from './bodbyn';

describe('bodbynPieces', () => {
  it('keeps 70 mm stiles on the 450×800 dishwasher front', () => {
    const pieces = bodbynPieces(450, 800, 19);
    const left = pieces[0];
    const panel = pieces.find((piece) => piece.role === 'panel');
    expect(left?.size.x).toBe(BODBYN_FRAME_MM);
    expect(left?.size.y).toBe(800);
    expect(left?.position.x).toBeCloseTo(-225 + BODBYN_FRAME_MM / 2);
    expect(panel?.size.x).toBe(450 - 2 * BODBYN_FRAME_MM - 2 * BODBYN_BEVEL_WIDTH_MM);
    expect(panel?.size.y).toBe(800 - 2 * BODBYN_FRAME_MM - 2 * BODBYN_BEVEL_WIDTH_MM);
    expect(panel?.size.z).toBe(BODBYN_PANEL_MM);
  });

  it('does not stretch the frame when the door is wider', () => {
    const panel400 = bodbynPieces(400, 800, 19).find((piece) => piece.role === 'panel');
    const panel600 = bodbynPieces(600, 800, 19).find((piece) => piece.role === 'panel');
    expect(bodbynPieces(600, 800, 19)[0]?.size.x).toBe(BODBYN_FRAME_MM);
    expect(panel600?.size.x).toBe((panel400?.size.x ?? 0) + 200);
  });

  it('narrows the frame before it swallows the panel on a tiny door', () => {
    const pieces = bodbynPieces(80, 80, 19);
    const panel = pieces.find((piece) => piece.role === 'panel');
    const bevel = pieces.find((piece) => piece.role === 'bevel');
    expect(pieces[0]?.size.x).toBeLessThan(BODBYN_FRAME_MM);
    expect(bevel?.size.x).toBe(0);
    expect(panel?.size.x).toBeGreaterThanOrEqual(40);
  });

  it('steps the bevel and panel behind the front face', () => {
    const pieces = bodbynPieces(450, 800, 19);
    const front = 19 / 2;
    const bevel = pieces.find((piece) => piece.role === 'bevel');
    const panel = pieces.find((piece) => piece.role === 'panel');
    expect(bevel?.size.z).toBe(BODBYN_BEVEL_THICKNESS_MM);
    expect(bevel?.position.z).toBeCloseTo(
      front - BODBYN_BEVEL_INSET_MM - BODBYN_BEVEL_THICKNESS_MM / 2,
    );
    expect(panel?.position.z).toBeCloseTo(
      front - BODBYN_PANEL_INSET_MM - BODBYN_PANEL_MM / 2,
    );
    expect(panel?.position.z).toBeLessThan(bevel?.position.z ?? 0);
  });
});

describe('bodbynGlassPieces', () => {
  it('keeps 70 mm stiles and an inset pane on a 400×800 glass door', () => {
    const pieces = bodbynGlassPieces(400, 800, 19);
    const glass = pieces.find((piece) => piece.role === 'glass');
    expect(pieces[0]?.size.x).toBe(BODBYN_FRAME_MM);
    expect(glass?.size.x).toBe(400 - 2 * BODBYN_FRAME_MM);
    expect(glass?.size.y).toBe(800 - 2 * BODBYN_FRAME_MM);
    expect(pieces.filter((piece) => piece.role === 'muntin')).toHaveLength(0);
  });

  it('adds a + cross-rail on the 40×40 muntin glass door', () => {
    const pieces = bodbynGlassPieces(400, 400, 19, true);
    const muntins = pieces.filter((piece) => piece.role === 'muntin');
    const glass = pieces.find((piece) => piece.role === 'glass');
    expect(muntins).toHaveLength(2);
    expect(muntins[0]?.size.x).toBe(BODBYN_MUNTIN_MM);
    expect(muntins[0]?.size.y).toBe(glass?.size.y);
    expect(muntins[1]?.size.y).toBe(BODBYN_MUNTIN_MM);
    expect(muntins[1]?.size.x).toBe(glass?.size.x);
  });
});
