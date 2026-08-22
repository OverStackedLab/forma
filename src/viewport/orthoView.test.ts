import { describe, expect, it } from 'vitest';
import { orthoBoxSize, orthoCameraOffset, orthoFrustumHeight } from './orthoView';

describe('ortho views', () => {
  it('maps each view onto the two axes that lie in the picture plane', () => {
    expect(orthoBoxSize('front', { x: 2, y: 1, z: 3 })).toEqual({ width: 2, height: 1 });
    expect(orthoBoxSize('side', { x: 2, y: 1, z: 3 })).toEqual({ width: 3, height: 1 });
    expect(orthoBoxSize('top', { x: 2, y: 1, z: 3 })).toEqual({ width: 2, height: 3 });
  });

  it('sizes the frustum so a wide piece still fits at a tall aspect', () => {
    const height = orthoFrustumHeight('front', { x: 4, y: 1, z: 1 }, 1);
    expect(height).toBeCloseTo(5, 8);
  });

  it('places the camera on the view axis, outside the box', () => {
    expect(orthoCameraOffset('front', { x: 1, y: 1, z: 2 })).toEqual([0, 0, 3]);
    expect(orthoCameraOffset('side', { x: 2, y: 1, z: 1 })).toEqual([3, 0, 0]);
    expect(orthoCameraOffset('top', { x: 1, y: 2, z: 1 })).toEqual([0, 3, 0]);
  });
});
