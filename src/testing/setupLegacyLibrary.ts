/**
 * Unit tests keep the pre-rebuild library so scene/setup helpers still resolve.
 * Production catalog/drawers stay empty for the rebuild.
 *
 * Fixtures are imported inside each factory so vitest's hoisted `vi.mock`
 * does not pull them in before the mocked modules initialise.
 */
import { vi } from 'vitest';

vi.mock('@/domain/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/catalog')>();
  const {
    LEGACY_CABINET_PRESET_ALIASES,
    LEGACY_CABINET_PRESETS,
    LEGACY_PANEL_PRESETS,
  } = await import('./legacyLibrary');
  return {
    ...actual,
    PANEL_PRESETS: LEGACY_PANEL_PRESETS,
    CABINET_PRESETS: LEGACY_CABINET_PRESETS,
    CABINET_PRESET_ALIASES: LEGACY_CABINET_PRESET_ALIASES,
    resolveCabinetPresetId(id: string | undefined) {
      if (!id) return undefined;
      const aliased = LEGACY_CABINET_PRESET_ALIASES[id];
      if (aliased) return aliased;
      return LEGACY_CABINET_PRESETS.find((preset) => preset.id === id)?.id;
    },
  };
});

vi.mock('@/domain/drawers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/drawers')>();
  const { LEGACY_DRAWER_PRESETS } = await import('./legacyLibrary');
  return {
    ...actual,
    DRAWER_PRESETS: LEGACY_DRAWER_PRESETS,
    resolveDrawerPresetId(id: string | undefined) {
      return LEGACY_DRAWER_PRESETS.find((preset) => preset.id === id)?.id;
    },
  };
});
