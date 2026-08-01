import { describe, expect, it } from 'vitest';
import {
  coerceGridSize,
  DEFAULT_GRID_SIZE_M,
  GRID_SIZES_M,
  isGridSizeM,
  viewportScale,
} from './workspace';

describe('viewportScale', () => {
  // The highest-value assertion in the file: making the grid configurable must
  // not change the default scene, so at 4 m every value is the literal the
  // viewport shipped with before this module existed.
  it('reproduces the shipped 4 m scene exactly', () => {
    expect(viewportScale(4)).toEqual({
      gridSizeM: 4,
      divisions: 40,
      minDistance: 1.2,
      maxDistance: 7,
      frameMinDistance: 1.2,
      frameClamp: 6,
      shadowExtent: 3.5,
      shadowFar: 12,
      groundSize: 12,
      cameraFar: 50,
    });
  });

  // The visible cell must stay one gizmo translate-snap step (0.1) at every
  // size, or the grid stops meaning anything when you drag a part.
  it('keeps 100 mm cells at every preset size', () => {
    for (const g of GRID_SIZES_M) {
      expect(g / viewportScale(g).divisions).toBeCloseTo(0.1, 12);
    }
  });

  // The worst case is not half the diagonal: OrbitControls lets you pan the
  // target to a grid corner and *then* zoom out to maxDistance.
  it('keeps the far plane clear of a fully panned, fully zoomed-out view', () => {
    for (const g of GRID_SIZES_M) {
      const s = viewportScale(g);
      expect(s.cameraFar).toBeGreaterThan(s.maxDistance + g * Math.SQRT2);
    }
  });

  // The invariant that makes a stalled camera flight impossible: every
  // destination frameSelection can produce lies inside the orbit envelope.
  it('keeps every Frame destination inside the orbit envelope', () => {
    for (const g of GRID_SIZES_M) {
      const s = viewportScale(g);
      expect(s.minDistance).toBeLessThanOrEqual(s.frameMinDistance);
      expect(s.frameMinDistance).toBeLessThanOrEqual(s.frameClamp);
      expect(s.frameClamp).toBeLessThanOrEqual(s.maxDistance);
    }
  });

  // CameraController's 'angle' preset sits 3.8406 from its target and does not
  // scale with the grid. Without the floor, 7k at the 2 m grid is only 3.5 and
  // the flight would lerp against the clamp forever.
  it('reaches the fixed camera presets even at the smallest grid', () => {
    expect(viewportScale(2).maxDistance).toBeGreaterThanOrEqual(3.842);
  });

  // Parts stay legal anywhere in ±10 m at every grid size, so shrinking the
  // ground plane would break library drops and shrinking the shadow frustum
  // would silently drop their shadows.
  it('never shrinks scene coverage below the 4 m baseline', () => {
    for (const g of GRID_SIZES_M) {
      const s = viewportScale(g);
      expect(s.groundSize).toBeGreaterThanOrEqual(12);
      expect(s.shadowExtent).toBeGreaterThanOrEqual(3.5);
      expect(s.shadowFar).toBeGreaterThanOrEqual(12);
      expect(s.cameraFar).toBeGreaterThanOrEqual(50);
    }
  });

  it('scales linearly above the base size, where no floor applies', () => {
    const s = viewportScale(20);
    expect(s.maxDistance).toBe(35);
    expect(s.frameClamp).toBe(30);
    expect(s.shadowExtent).toBe(17.5);
    expect(s.shadowFar).toBe(60);
    expect(s.groundSize).toBe(60);
    expect(s.divisions).toBe(200);
  });

  it('tightens the zoom envelope on a smaller grid', () => {
    expect(viewportScale(2).maxDistance).toBeLessThan(viewportScale(4).maxDistance);
  });

  it('falls back to the default for a size that is not a preset', () => {
    expect(viewportScale(3).gridSizeM).toBe(DEFAULT_GRID_SIZE_M);
  });
});

describe('coerceGridSize', () => {
  it('accepts the numeric string localStorage hands back', () => {
    expect(coerceGridSize('10')).toBe(10);
  });

  it('accepts every preset unchanged', () => {
    for (const g of GRID_SIZES_M) expect(coerceGridSize(g)).toBe(g);
  });

  it('falls back to the default for anything else', () => {
    expect(coerceGridSize(3)).toBe(DEFAULT_GRID_SIZE_M);
    expect(coerceGridSize(null)).toBe(DEFAULT_GRID_SIZE_M);
    expect(coerceGridSize(undefined)).toBe(DEFAULT_GRID_SIZE_M);
    expect(coerceGridSize(Number.NaN)).toBe(DEFAULT_GRID_SIZE_M);
    expect(coerceGridSize('huge')).toBe(DEFAULT_GRID_SIZE_M);
    expect(coerceGridSize({})).toBe(DEFAULT_GRID_SIZE_M);
  });
});

describe('isGridSizeM', () => {
  it('rejects a near-miss that would break the cell-size invariant', () => {
    expect(isGridSizeM(4.0000001)).toBe(false);
    expect(isGridSizeM('4')).toBe(false);
    expect(isGridSizeM(4)).toBe(true);
  });
});
