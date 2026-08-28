/**
 * One place that knows which modifier key this machine has.
 *
 * The key *handlers* have always been portable — `useKeyboardShortcuts` tests
 * `metaKey || ctrlKey`, so Ctrl works everywhere — but the on-screen hints
 * hardcoded `⌘`, which is simply wrong off macOS (BUG-041). Detection lives
 * here so hints, tooltips and `aria-keyshortcuts` can never drift apart, and
 * the formatting stays pure enough to unit-test in Node.
 */

type PlatformNavigator = Navigator & { userAgentData?: { platform?: string } };

function detectApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as PlatformNavigator;
  // `navigator.platform` is deprecated but still the only value present in
  // every browser Forma runs in; userAgentData is preferred where available.
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export const IS_APPLE_PLATFORM = detectApplePlatform();

/** The primary accelerator modifier, written the way this platform writes it. */
export const MOD_KEY = IS_APPLE_PLATFORM ? '⌘' : 'Ctrl';

/**
 * Renders a shortcut spec for display. `mod` becomes the platform modifier;
 * macOS joins its glyphs directly (`⌘D`) while everywhere else uses the
 * conventional `Ctrl+D`.
 *
 * `modKey` is injectable so the formatting can be tested for both platforms
 * without stubbing `navigator`.
 */
export function formatShortcut(spec: string, modKey: string = MOD_KEY): string {
  const parts = spec
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.toLowerCase() === 'mod' ? modKey : part));
  const glyphOnly = modKey === '⌘';
  return parts.join(glyphOnly ? '' : '+');
}
