import { describe, expect, it } from 'vitest';
import { convertedValue, convertRange, decimalsFor, formatLength, fromMm, toMm } from './units';

describe('fromMm / toMm', () => {
  it('is the identity for mm', () => {
    expect(fromMm(800, 'mm')).toBe(800);
    expect(toMm(800, 'mm')).toBe(800);
  });

  it('divides/multiplies by 10 for cm', () => {
    expect(fromMm(800, 'cm')).toBe(80);
    expect(fromMm(18, 'cm')).toBe(1.8);
    expect(toMm(80, 'cm')).toBe(800);
    expect(toMm(1.8, 'cm')).toBeCloseTo(18, 10);
  });

  it('round-trips through mm and back', () => {
    for (const mm of [18, 300, 800, 1234.5]) {
      expect(toMm(fromMm(mm, 'cm'), 'cm')).toBeCloseTo(mm, 10);
    }
  });
});

describe('convertRange', () => {
  it('scales min, max and step together', () => {
    expect(convertRange({ min: 50, max: 3000, step: 5 }, 'cm')).toEqual({
      min: 5,
      max: 300,
      step: 0.5,
    });
  });

  it('is the identity for mm', () => {
    const range = { min: 3, max: 3000, step: 1 };
    expect(convertRange(range, 'mm')).toEqual(range);
  });
});

describe('decimalsFor', () => {
  it('shows whole numbers for mm and one decimal for cm', () => {
    expect(decimalsFor('mm')).toBe(0);
    expect(decimalsFor('cm')).toBe(1);
  });
});

describe('convertedValue', () => {
  it('returns a plain number, not a locale-formatted string', () => {
    expect(convertedValue(1400, 'mm')).toBe(1400);
    expect(convertedValue(1400, 'cm')).toBe(140);
    expect(convertedValue(18, 'cm')).toBe(1.8);
  });
});

describe('formatLength', () => {
  it('formats mm as a thousands-separated whole number', () => {
    expect(formatLength(1400, 'mm')).toBe('1,400');
  });

  it('omits the decimal for a whole number of cm', () => {
    expect(formatLength(1400, 'cm')).toBe('140');
    expect(formatLength(800, 'cm')).toBe('80');
  });

  it('shows one decimal only when the cm value is fractional', () => {
    expect(formatLength(18, 'cm')).toBe('1.8');
  });
});
