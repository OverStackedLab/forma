const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/**
 * Formats a timestamp relative to now. Version entries store epoch millis and
 * are formatted here — the prototype stored frozen strings like "3 days ago"
 * that never updated.
 */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const delta = timestamp - now;
  const abs = Math.abs(delta);
  if (abs < 45_000) return 'just now';
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return RELATIVE.format(Math.round(delta / ms), unit);
  }
  return RELATIVE.format(Math.round(delta / 1000), 'second');
}

function centimetreValue(millimetres: string): string {
  return String(Number(millimetres) / 10);
}

/**
 * Converts measurements embedded in a catalog description from mm to cm.
 * Geometry stays millimetre-based; this only keeps Library copy consistent
 * with the app's default display unit.
 */
export function libraryDescriptionInCm(description: string): string {
  return description
    .replace(
      /(Ø?\d+(?:\.\d+)?(?:\s*×\s*\d+(?:\.\d+)?)+)\s*mm\b/g,
      (_match, dimensions: string) =>
        `${dimensions.replace(/\d+(?:\.\d+)?/g, centimetreValue)} cm`,
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*mm\b/g,
      (_match, millimetres: string) => `${centimetreValue(millimetres)} cm`,
    );
}
