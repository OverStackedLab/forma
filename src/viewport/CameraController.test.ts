import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraController } from './CameraController';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';

class FakeControls extends THREE.EventDispatcher<{ start: object }> {
  readonly target = new THREE.Vector3();
}

describe('CameraController', () => {
  it('stops an eased camera flight as soon as wheel/orbit interaction starts', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    const controls = new FakeControls();
    const scene = { camera, controls } as unknown as SceneManager;
    const builder = { partSpecs: [] } as unknown as ModelBuilder;
    const controller = new CameraController(scene, builder);

    controller.goTo('angle');
    controller.update();
    controls.dispatchEvent({ type: 'start' });
    const positionAfterUserStart = camera.position.clone();
    const targetAfterUserStart = controls.target.clone();

    controller.update();
    expect(camera.position).toEqual(positionAfterUserStart);
    expect(controls.target).toEqual(targetAfterUserStart);
    controller.dispose();
  });
});
