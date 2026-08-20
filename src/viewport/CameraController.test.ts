import { describe, expect, it } from 'vitest';
import { CAMERA_PRESETS, cameraPresetDistance, type CameraPreset } from './CameraController';

const PRESET_IDS: CameraPreset[] = ['front', 'side', 'top', 'angle'];

describe('camera presets', () => {
  it('keeps every viewpoint inside the orbit envelope', () => {
    expect(Object.keys(CAMERA_PRESETS)).toEqual(PRESET_IDS);
    for (const preset of PRESET_IDS) {
      const distance = cameraPresetDistance(preset);
      expect(distance).toBeGreaterThanOrEqual(1.2);
      expect(distance).toBeLessThan(4);
    }
  });

  it('places side on +X at the same height as front', () => {
    expect(CAMERA_PRESETS.side.pos[0]).toBe(CAMERA_PRESETS.front.pos[2]);
    expect(CAMERA_PRESETS.side.pos[1]).toBe(CAMERA_PRESETS.front.pos[1]);
    expect(CAMERA_PRESETS.side.target).toEqual(CAMERA_PRESETS.front.target);
  });
});
