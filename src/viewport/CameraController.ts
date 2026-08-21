import * as THREE from 'three';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';
import {
  ORTHO_VIEWS,
  orthoCameraOffset,
  orthoFrustumHeight,
  type OrthoView,
} from './orthoView';
import type { SceneManager } from './SceneManager';

export type CameraPreset = OrthoView | 'angle';

export const CAMERA_PRESETS: Record<
  'angle',
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  angle: { pos: [2.5, 1.5, 2.7], target: [0, 0.4, 0] },
};

export function cameraPresetDistance(preset: 'angle'): number {
  const { pos, target } = CAMERA_PRESETS[preset];
  return Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
}

/** Empty-canvas stand-in so Front/Side/Top still have a sensible scale. */
const DEFAULT_ORTHO_SIZE = { x: 1.2, y: 1.2, z: 1.2 };
const DEFAULT_ORTHO_CENTRE = new THREE.Vector3(0, 0.6, 0);

/** Fraction of the remaining distance covered per frame. */
const EASE = 0.08;
const ARRIVAL_EPSILON = 0.002;

/** Eases the perspective camera between viewpoints rather than snapping. */
export class CameraController {
  private flight: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private readonly cancelFlight = () => {
    this.flight = null;
  };

  constructor(
    private readonly scene: SceneManager,
    private readonly builder: ModelBuilder,
  ) {
    // OrbitControls emits `start` for mouse, touch and wheel gestures. A user
    // gesture takes ownership immediately so an eased Frame flight cannot
    // keep pulling the camera back after the user scrolls to zoom.
    scene.controls.addEventListener('start', this.cancelFlight);
  }

  /** Called once per frame from the render loop. */
  update(): void {
    const f = this.flight;
    if (!f) return;
    this.scene.camera.position.lerp(f.pos, EASE);
    this.scene.controls.target.lerp(f.target, EASE);
    if (
      this.scene.camera.position.distanceTo(f.pos) < ARRIVAL_EPSILON &&
      this.scene.controls.target.distanceTo(f.target) < ARRIVAL_EPSILON
    ) {
      this.scene.camera.position.copy(f.pos);
      this.scene.controls.target.copy(f.target);
      this.flight = null;
    }
  }

  goTo(preset: CameraPreset): void {
    if (preset === 'angle') {
      this.goToAngle();
      return;
    }
    this.goToOrtho(preset);
  }

  /** Fits every live part, falling back to the default view for an empty scene. */
  frameAll(): void {
    const ids = this.builder.partSpecs.map((part) => part.id);
    if (ids.length) this.frameSelection(ids);
    else this.goTo('angle');
  }

  /**
   * Frames the current selection in the perspective ¾ view. Selection
   * halos are excluded — they are children scaled 1.045, so including them
   * inflated the box by 4.5%.
   */
  frameSelection(selectedIds: readonly string[]): void {
    const box = combinedWorldBounds(selectedIds.map((id) => this.builder.getRoot(id)));
    if (!box) {
      this.goTo('angle');
      return;
    }

    this.scene.usePerspective();
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.15);
    // Both bounds come from the orbit envelope, so the destination is always
    // one OrbitControls will accept. A fixed 0.9 floor sat below minDistance
    // (1.2), so framing a small part — a knob, most single panels — asked for
    // a distance the controls clamped away every frame while `update()` lerped
    // back toward it, and the flight never reached its arrival epsilon.
    const scale = this.scene.viewportScale;
    const distance = Math.min(Math.max(radius * 3.2, scale.frameMinDistance), scale.frameClamp);
    const direction = new THREE.Vector3(0.8, 0.55, 0.9).normalize();
    this.flyTo(centre.clone().add(direction.multiplyScalar(distance)), centre);
  }

  private goToAngle(): void {
    this.scene.usePerspective();
    const p = CAMERA_PRESETS.angle;
    this.flyTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target));
  }

  private goToOrtho(view: OrthoView): void {
    this.flight = null;
    const ids = this.builder.partSpecs.map((part) => part.id);
    const box = combinedWorldBounds(ids.map((id) => this.builder.getRoot(id)));
    const size = box?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(
      DEFAULT_ORTHO_SIZE.x,
      DEFAULT_ORTHO_SIZE.y,
      DEFAULT_ORTHO_SIZE.z,
    );
    const centre = box?.getCenter(new THREE.Vector3()) ?? DEFAULT_ORTHO_CENTRE.clone();
    const frustumHeight = orthoFrustumHeight(
      view,
      { x: size.x, y: size.y, z: size.z },
      this.canvasAspect(),
    );
    const offset = orthoCameraOffset(view, { x: size.x, y: size.y, z: size.z });
    const position = centre.clone().add(new THREE.Vector3(...offset));
    const up = new THREE.Vector3(...ORTHO_VIEWS[view].up);
    this.scene.useOrthographic(position, centre, up, frustumHeight);
  }

  private canvasAspect(): number {
    const canvas = this.scene.renderer.domElement;
    return canvas.clientWidth / canvas.clientHeight || 1;
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3): void {
    this.flight = { pos, target };
  }

  dispose(): void {
    this.scene.controls.removeEventListener('start', this.cancelFlight);
    this.flight = null;
  }
}
