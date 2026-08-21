import { describe, expect, it } from 'vitest';
import { CAMERA_PRESETS, cameraPresetDistance } from './CameraController';

describe('camera presets', () => {
  it('keeps the perspective ¾ viewpoint inside the orbit envelope', () => {
    const distance = cameraPresetDistance('angle');
    expect(distance).toBeGreaterThanOrEqual(1.2);
    expect(distance).toBeLessThan(4);
    expect(CAMERA_PRESETS.angle.pos).toEqual([2.5, 1.5, 2.7]);
  });
});
