/** Default matches the shipped 240 px Assembly / Library column. */
export const DEFAULT_LEFT_SIDEBAR_WIDTH = 240;

export const LEFT_SIDEBAR_WIDTH_LIMITS = { min: 200, max: 480 } as const;

export function isLeftSidebarWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LEFT_SIDEBAR_WIDTH_LIMITS.min &&
    value <= LEFT_SIDEBAR_WIDTH_LIMITS.max
  );
}

/** Validates, clamps and rounds unknown input to a whole pixel width. */
export function coerceLeftSidebarWidth(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_LEFT_SIDEBAR_WIDTH;
  return Math.round(
    Math.min(LEFT_SIDEBAR_WIDTH_LIMITS.max, Math.max(LEFT_SIDEBAR_WIDTH_LIMITS.min, n)),
  );
}
