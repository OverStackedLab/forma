import { describe, expect, it } from 'vitest';
import { findColor, findMaterial, finishForAppearance, resolveAppearance, resolveCabinetPresetId } from './catalog';

describe('resolveAppearance', () => {
  it("uses the material's own color and finish when the color is natural", () => {
    const appearance = resolveAppearance('walnut', 'natural');
    const walnut = findMaterial('walnut');
    expect(appearance).toEqual({
      color: walnut.color,
      roughness: walnut.roughness,
      metalness: walnut.metalness,
    });
  });

  it("overrides the material's color and finish when a stain or paint is set", () => {
    const appearance = resolveAppearance('walnut', 'white');
    const white = findColor('white');
    expect(appearance).toEqual({
      color: white.tint,
      roughness: white.roughness,
      metalness: white.metalness,
    });
  });

  it('applies the same color consistently across different materials', () => {
    const onWalnut = resolveAppearance('walnut', 'ebony');
    const onAsh = resolveAppearance('ash', 'ebony');
    expect(onWalnut).toEqual(onAsh);
  });

  it('falls back to the first material or color for an unknown id', () => {
    expect(findMaterial(undefined).id).toBe(findMaterial('bogus').id);
    expect(findColor(undefined).id).toBe(findColor('bogus').id);
  });
});

describe('finishForAppearance', () => {
  it('maps a natural wood pair to its matching finish', () => {
    expect(finishForAppearance('oak', 'natural').label).toBe('Oak');
    expect(finishForAppearance('walnut', 'natural').label).toBe('Walnut');
  });

  it('maps older mixed pairs to the closest user-facing finish', () => {
    expect(finishForAppearance('oak', 'ebony').label).toBe('Dark Gray');
  });

  it('maps metal appearances to a single hardware finish', () => {
    expect(finishForAppearance('metal', 'brass').label).toBe('Brushed Brass');
    expect(finishForAppearance('metal', 'steel').label).toBe('Brushed Steel');
    expect(finishForAppearance('metal', 'white').label).toBe('White');
  });
});

describe('resolveCabinetPresetId', () => {
  it('maps retired library ids onto the current METOD presets', () => {
    expect(resolveCabinetPresetId('base-450')).toBe('base-400');
    expect(resolveCabinetPresetId('base-900')).toBe('base-800');
    expect(resolveCabinetPresetId('wall-900')).toBe('wall-800');
    expect(resolveCabinetPresetId('tall-600')).toBe('high-600');
    expect(resolveCabinetPresetId('base-600')).toBe('base-600');
    expect(resolveCabinetPresetId('nope')).toBeUndefined();
  });
});
