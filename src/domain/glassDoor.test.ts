import { describe, expect, it } from 'vitest';
import {
  AXSTAD_FRAME_MM,
  AXSTAD_GLASS_MM,
  axstadGlassPieces,
  framedFrontResize,
  framedFrontSize,
} from './glassDoor';
import { eulerDegreesToQuaternion } from './rotation';

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

describe('framedFrontSize', () => {
  const current = { w: 400, h: 800, d: 19 };

  it('changes the outer width and leaves the stile depth', () => {
    expect(framedFrontSize(current, 'w', 600)).toEqual({ w: 600, h: 800, d: 19 });
    expect(axstadGlassPieces(600, 800, 19)[0]?.size.x).toBe(AXSTAD_FRAME_MM);
  });

  it('writes a rotated front on the local dimension that faces the typed axis', () => {
    const resized = framedFrontResize(
      current,
      eulerDegreesToQuaternion({ x: 0, y: 90, z: 0 }),
      'x',
      600,
    );
    expect(resized.key).toBe('d');
    expect(resized.size).toEqual({ w: 400, h: 800, d: 600 });
  });
});
