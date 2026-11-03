import {
  DEFAULT_COLOR_ID,
  DEFAULT_HARDWARE_FINISH_ID,
  DEFAULT_MATERIAL_ID,
} from './catalog';
import type { FormaDocument } from './types';

/**
 * Demo kitchen seed. Returns an empty document while the library is rebuilt.
 * Open with `?demo=kitchen`.
 */
export function createDemoKitchen(): FormaDocument {
  return {
    defaultMaterialId: DEFAULT_MATERIAL_ID,
    defaultColorId: DEFAULT_COLOR_ID,
    defaultHardwareFinishId: DEFAULT_HARDWARE_FINISH_ID,
    overrides: {},
    customParts: [],
    hiddenIds: [],
    transforms: {},
    groups: [],
    docTitle: 'Demo kitchen',
    versions: [],
    currentVersionId: null,
  };
}
