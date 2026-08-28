import { describe, expect, it } from 'vitest';
import {
  AXSTAD_FRAME_MM,
  AXSTAD_GLASS_MM,
  axstadGlassPieces,
} from './glassDoor';

describe('axstadGlassPieces', () => {
  it('keeps 78 mm stiles on a 400×800 AXSTAD door', () => {
    const pieces = axstadGlassPieces(400, 800, 19);
    const left = pieces[0];
    const glass = pieces.find((piece) => piece.role === 'glass');
    expect(left?.size.x).toBe(AXSTAD_FRAME_MM);
    expect(left?.size.y).toBe(800);
    expect(left?.position.x).toBeCloseTo(-200 + AXSTAD_FRAME_MM / 2);
    expect(glass?.size.x).toBe(400 - 2 * AXSTAD_FRAME_MM);
    expect(glass?.size.y).toBe(800 - 2 * AXSTAD_FRAME_MM);
    expect(glass?.size.z).toBe(AXSTAD_GLASS_MM);
  });

  it('does not stretch the frame when the door is wider', () => {
    const glass400 = axstadGlassPieces(400, 800, 19).find((piece) => piece.role === 'glass');
    const glass600 = axstadGlassPieces(600, 800, 19).find((piece) => piece.role === 'glass');
    expect(axstadGlassPieces(600, 800, 19)[0]?.size.x).toBe(AXSTAD_FRAME_MM);
    expect(glass600?.size.x).toBe((glass400?.size.x ?? 0) + 200);
  });

  it('narrows the frame before it swallows the glass on a tiny door', () => {
    const pieces = axstadGlassPieces(80, 80, 19);
    const glass = pieces.find((piece) => piece.role === 'glass');
    expect(pieces[0]?.size.x).toBeLessThan(AXSTAD_FRAME_MM);
    expect(glass?.size.x).toBeGreaterThanOrEqual(40);
  });
});
