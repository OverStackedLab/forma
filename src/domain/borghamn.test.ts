import { describe, expect, it } from 'vitest';
import {
  BORGHAMN_BAR_MM,
  BORGHAMN_CENTRES_MM,
  BORGHAMN_LENGTH_MM,
  BORGHAMN_PROJECTION_MM,
  borghamnCenterline,
} from './borghamn';

describe('borghamnCenterline', () => {
  it('puts the feet on 160 mm centres and the grip at 36 mm projection', () => {
    const points = borghamnCenterline();
    const first = points[0];
    const last = points[points.length - 1];
    expect(first?.x).toBeCloseTo(-BORGHAMN_CENTRES_MM / 2);
    expect(last?.x).toBeCloseTo(BORGHAMN_CENTRES_MM / 2);
    expect(first?.z).toBeCloseTo(BORGHAMN_BAR_MM / 2);
    expect(last?.z).toBeCloseTo(BORGHAMN_BAR_MM / 2);

    const gripZ = points.map((point) => point.z).reduce((max, z) => Math.max(max, z), 0);
    expect(gripZ).toBeCloseTo(BORGHAMN_PROJECTION_MM - BORGHAMN_BAR_MM / 2);
  });

  it('stays inside the 170 × 10 × 36 mm catalog envelope', () => {
    const halfBar = BORGHAMN_BAR_MM / 2;
    for (const point of borghamnCenterline()) {
      expect(Math.abs(point.x) + halfBar).toBeLessThanOrEqual(BORGHAMN_LENGTH_MM / 2 + 1e-6);
      expect(Math.abs(point.y) + halfBar).toBeLessThanOrEqual(halfBar + 1e-6);
      expect(point.z + halfBar).toBeLessThanOrEqual(BORGHAMN_PROJECTION_MM + 1e-6);
      expect(point.z - halfBar).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});
