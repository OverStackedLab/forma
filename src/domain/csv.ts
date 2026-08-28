import { convertedValue, type DisplayUnit } from './units';
import type { BomRow } from './types';

export function csvHeaders(unit: DisplayUnit): readonly string[] {
  return [
    'Type',
    'Part',
    'Qty',
    'Color',
    `W (${unit})`,
    `H (${unit})`,
    `D (${unit})`,
    `Thickness (${unit})`,
    'Edge Band',
    'Grain',
  ];
}

/**
 * Characters that make Excel and Google Sheets treat a cell as a formula
 * rather than text. A leading tab or carriage return counts too, because both
 * are stripped before the parser looks at the first visible character.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * RFC 4180 field escaping. Custom panel labels are user-facing text, so an
 * unescaped join corrupts the file the moment one contains a comma or quote.
 *
 * Quoting alone does not stop a spreadsheet evaluating a leading `=`, so a
 * text field that opens with a formula trigger also gets an apostrophe prefix —
 * the standard neutralizer, which spreadsheets consume as "treat as text"
 * (BUG-011). Numeric fields are exempt, so a negative measurement stays a
 * number the sheet can compute with.
 */
function escapeField(value: string | number): string {
  const raw = String(value);
  const s = typeof value === 'string' && FORMULA_TRIGGER.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Byte-order mark. Excel on Windows opens a double-clicked .csv as ANSI unless
 * the file announces UTF-8, which turned the hardware grain placeholder (an em
 * dash) into `â€"` (BUG-013). Every other consumer skips it silently.
 */
export const CSV_BOM = '\uFEFF';

/** Serializes exactly the rows the cut list table displays, in the given display unit. */
export function toCSV(rows: readonly BomRow[], unit: DisplayUnit): string {
  const lines = [csvHeaders(unit).map(escapeField).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.source === 'sheet' ? 'Sheet Good' : 'Hardware',
        r.label,
        r.qty,
        r.finish,
        convertedValue(r.w, unit),
        convertedValue(r.h, unit),
        convertedValue(r.d, unit),
        r.thickness === null ? '' : convertedValue(r.thickness, unit),
        r.edgeBand,
        r.grain,
      ]
        .map(escapeField)
        .join(','),
    );
  }
  return lines.join('\r\n');
}
