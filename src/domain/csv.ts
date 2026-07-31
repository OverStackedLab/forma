import { convertedValue, type DisplayUnit } from './units';
import type { BomRow } from './types';

export function csvHeaders(unit: DisplayUnit): readonly string[] {
  return [
    'Part',
    'Qty',
    'Material',
    'Color',
    `W (${unit})`,
    `H (${unit})`,
    `D (${unit})`,
    'Edge Band',
    'Grain',
  ];
}

/**
 * RFC 4180 field escaping. Custom panel labels are user-facing text, so an
 * unescaped join corrupts the file the moment one contains a comma or quote.
 */
function escapeField(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serializes exactly the rows the cut list table displays, in the given display unit. */
export function toCSV(rows: readonly BomRow[], unit: DisplayUnit): string {
  const lines = [csvHeaders(unit).map(escapeField).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.label,
        r.qty,
        r.material,
        r.color,
        convertedValue(r.w, unit),
        convertedValue(r.h, unit),
        convertedValue(r.d, unit),
        r.edge ? 'Y' : 'N',
        r.grain,
      ]
        .map(escapeField)
        .join(','),
    );
  }
  return lines.join('\r\n');
}
