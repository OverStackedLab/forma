import * as THREE from 'three';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';

export type CameraPreset = 'front' | 'angle' | 'top';

const PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0, 0.55, 3.1], target: [0, 0.42, 0] },
  angle: { pos: [2.5, 1.5, 2.7], target: [0, 0.4, 0] },
  top: { pos: [0.1, 3.4, 0.1], target: [0, 0.3, 0] },
};

/** Fraction of the remaining distance covered per frame. */
const EASE = 0.08;
/** Frames-worth of progress per step, so a flight always terminates. */
const STEP = 0.035;

/** Eases the camera between viewpoints rather than snapping. */
export class CameraController {
  private flight: { pos: THREE.Vector3; target: THREE.Vector3; t: number } | null = null;

  constructor(
    private readonly scene: SceneManager,
    private readonly builder: ModelBuilder,
  ) {}

  /** Called once per frame from the render loop. */
  update(): void {
    const f = this.flight;
    if (!f) return;
    f.t = Math.min(1, f.t + STEP);
    this.scene.camera.position.lerp(f.pos, EASE);
    this.scene.controls.target.lerp(f.target, EASE);
    if (f.t >= 1) this.flight = null;
  }

  goTo(preset: CameraPreset): void {
    const p = PRESETS[preset];
    this.flyTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target));
  }

  /** The default three-quarter view. */
  frameAll(): void {
    this.goTo('angle');
  }

  /**
   * Frames the current selection. Selection halos are excluded — they are
   * children scaled 1.045, so including them inflated the box by 4.5%.
   */
  frameSelection(selectedIds: readonly string[]): void {
    const box = combinedWorldBounds(selectedIds.map((id) => this.builder.getRoot(id)));
    if (!box) {
      this.frameAll();
      return;
    }

    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.15);
    const distance = Math.min(Math.max(radius * 3.2, 0.9), 6);
    const direction = new THREE.Vector3(0.8, 0.55, 0.9).normalize();
    this.flyTo(centre.clone().add(direction.multiplyScalar(distance)), centre);
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3): void {
    this.flight = { pos, target, t: 0 };
  }
}
