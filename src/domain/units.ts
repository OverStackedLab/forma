export type DisplayUnit = 'mm' | 'cm';

export const DISPLAY_UNITS: readonly DisplayUnit[] = ['mm', 'cm'];

export type Range = { min: number; max: number; step: number };

/** Millimetres to the given display unit. */
export function fromMm(mm: number, unit: DisplayUnit): number {
  return unit === 'cm' ? mm / 10 : mm;
}

/** The given display unit back to millimetres — the domain's only unit. */
export function toMm(value: number, unit: DisplayUnit): number {
  return unit === 'cm' ? value * 10 : value;
}

/** A mm-denominated slider range (min/max/step), converted for display. */
export function convertRange(range: Range, unit: DisplayUnit): Range {
  return {
    min: fromMm(range.min, unit),
    max: fromMm(range.max, unit),
    step: fromMm(range.step, unit),
  };
}

/** Decimal places worth showing at this unit — mm is whole numbers, cm allows one decimal. */
export function decimalsFor(unit: DisplayUnit): number {
  return unit === 'cm' ? 1 : 0;
}

/** Millimetres converted to the display unit and rounded to its precision, as a plain number. */
export function convertedValue(mm: number, unit: DisplayUnit): number {
  const decimals = decimalsFor(unit);
  const value = fromMm(mm, unit);
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/**
 * Formats a millimetre value in the given display unit, thousands-separated —
 * for on-screen display. A whole number of cm shows no decimal (80, not
 * 80.0); a fractional one shows up to one (1.8). CSV export uses
 * `convertedValue` instead: a comma thousands-separator would need
 * CSV-quoting and can confuse a spreadsheet's numeric parsing.
 */
export function formatLength(mm: number, unit: DisplayUnit): string {
  return convertedValue(mm, unit).toLocaleString('en-US', {
    maximumFractionDigits: decimalsFor(unit),
  });
}
