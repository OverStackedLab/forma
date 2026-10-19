import { describe, expect, it } from 'vitest';
import { libraryDescriptionInCm } from './format';

describe('libraryDescriptionInCm', () => {
  it('converts dimension groups and secondary measurements to centimetres', () => {
    expect(
      libraryDescriptionInCm('400×800×19 mm · 78 mm frame · inset glass'),
    ).toBe('40×80×1.9 cm · 7.8 cm frame · inset glass');
  });

  it('converts diameter measurements while preserving their symbols and spacing', () => {
    expect(libraryDescriptionInCm('Ø32 × 25 mm projection')).toBe(
      'Ø3.2 × 2.5 cm projection',
    );
  });

  it('leaves copy without millimetre measurements unchanged', () => {
    expect(libraryDescriptionInCm('IKEA METOD frame size')).toBe('IKEA METOD frame size');
  });
});
