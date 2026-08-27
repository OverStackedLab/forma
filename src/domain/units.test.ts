import { describe, expect, it } from 'vitest';
import { convertedValue, convertRange, decimalsFor, formatLength, fromMm, parseLength, toMm } from './units';

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

  it('divides/multiplies by 25.4 for inches', () => {
    expect(fromMm(762, 'in')).toBe(30);
    expect(fromMm(25.4, 'in')).toBe(1);
    expect(toMm(30, 'in')).toBeCloseTo(762, 10);
    expect(toMm(1, 'in')).toBeCloseTo(25.4, 10);
  });

  it('round-trips through mm and back', () => {
    for (const mm of [18, 300, 800, 1234.5]) {
      expect(toMm(fromMm(mm, 'cm'), 'cm')).toBeCloseTo(mm, 10);
      expect(toMm(fromMm(mm, 'in'), 'in')).toBeCloseTo(mm, 10);
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

  it('scales into inches', () => {
    const range = convertRange({ min: 25.4, max: 2540, step: 25.4 }, 'in');
    expect(range.min).toBeCloseTo(1, 10);
    expect(range.max).toBeCloseTo(100, 10);
    expect(range.step).toBeCloseTo(1, 10);
  });
});

describe('decimalsFor', () => {
  it('shows whole numbers for mm, one decimal for cm, two for inches', () => {
    expect(decimalsFor('mm')).toBe(0);
    expect(decimalsFor('cm')).toBe(1);
    expect(decimalsFor('in')).toBe(2);
  });
});

describe('convertedValue', () => {
  it('returns a plain number, not a locale-formatted string', () => {
    expect(convertedValue(1400, 'mm')).toBe(1400);
    expect(convertedValue(1400, 'cm')).toBe(140);
    expect(convertedValue(18, 'cm')).toBe(1.8);
    expect(convertedValue(800, 'in')).toBe(31.5);
    expect(convertedValue(762, 'in')).toBe(30);
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

  it('shows two decimals for fractional inches and omits them for a whole inch', () => {
    expect(formatLength(800, 'in')).toBe('31.5');
    expect(formatLength(762, 'in')).toBe('30');
  });
});

describe('parseLength', () => {
  it('reads a bare number in the current display unit', () => {
    expect(parseLength('20', 'cm')).toBe(200);
    expect(parseLength('200', 'mm')).toBe(200);
    expect(parseLength('1.8', 'cm')).toBeCloseTo(18, 10);
  });

  it('lets a trailing unit override the display unit', () => {
    expect(parseLength('20 cm', 'mm')).toBe(200);
    expect(parseLength('200mm', 'cm')).toBe(200);
    expect(parseLength('1 in', 'mm')).toBeCloseTo(25.4, 10);
  });

  it('strips thousands separators', () => {
    expect(parseLength('1,400', 'mm')).toBe(1400);
  });

  it('rejects empty or non-numeric text', () => {
    expect(parseLength('', 'mm')).toBeNull();
    expect(parseLength('abc', 'mm')).toBeNull();
  });
});
