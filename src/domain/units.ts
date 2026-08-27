export type DisplayUnit = 'mm' | 'cm' | 'in';

export const DISPLAY_UNITS: readonly DisplayUnit[] = ['cm', 'mm', 'in'];

export const DISPLAY_UNIT_NAMES: Record<DisplayUnit, string> = {
  mm: 'millimetres',
  cm: 'centimetres',
  in: 'inches',
};

const MM_PER: Record<DisplayUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
};

export type Range = { min: number; max: number; step: number };

/** Millimetres to the given display unit. */
export function fromMm(mm: number, unit: DisplayUnit): number {
  return mm / MM_PER[unit];
}

/** The given display unit back to millimetres — the domain's only unit. */
export function toMm(value: number, unit: DisplayUnit): number {
  return value * MM_PER[unit];
}

/** A mm-denominated slider range (min/max/step), converted for display. */
export function convertRange(range: Range, unit: DisplayUnit): Range {
  return {
    min: fromMm(range.min, unit),
    max: fromMm(range.max, unit),
    step: fromMm(range.step, unit),
  };
}

/** Decimal places worth showing at this unit. */
export function decimalsFor(unit: DisplayUnit): number {
  if (unit === 'in') return 2;
  if (unit === 'cm') return 1;
  return 0;
}

/** Millimetres converted to the display unit and rounded to its precision, as a plain number. */
export function convertedValue(mm: number, unit: DisplayUnit): number {
  const decimals = decimalsFor(unit);
  const value = fromMm(mm, unit);
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/**
 * Formats a millimetre value in the given display unit, thousands-separated —
 * for on-screen display. A whole number shows no trailing zeros (80, not
 * 80.0); a fractional one shows up to the unit's precision (1.8 cm, 31.5 in).
 * CSV export uses `convertedValue` instead: a comma thousands-separator would
 * need CSV-quoting and can confuse a spreadsheet's numeric parsing.
 */
export function formatLength(mm: number, unit: DisplayUnit): string {
  return convertedValue(mm, unit).toLocaleString('en-US', {
    maximumFractionDigits: decimalsFor(unit),
  });
}
