import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Transform } from '@/domain/types';
import type { GizmoMode } from '@/store/uiStore';
import { applyFaceSnapPlan, computeFaceSnap, type FaceSnapAxis } from './faceSnap';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';
import { SnapGuide } from './snapGuide';

/** Grid increments, used for rotation/scale and for Shift-held translation. */
const SNAP = { translate: 0.1, rotate: Math.PI / 12, scale: 0.1 };

export type GizmoCommitContext = {
  mode: GizmoMode;
  /** Multi-selection scale applied at the shared pivot during this gesture. */
  groupScale?: Transform['scale'];
};

export type GizmoCommit = (
  transforms: Record<string, Transform>,
  context: GizmoCommitContext,
) => void;

function sameArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameTransform(a: Transform, b: Transform): boolean {
  return (
    sameArray(a.position, b.position) &&
    sameArray(a.quaternion, b.quaternion) &&
    sameArray(a.scale, b.scale)
  );
}

function translateAxes(axis: string | null | undefined): readonly FaceSnapAxis[] {
  if (!axis || axis === 'XYZ' || axis === 'E') return ['x', 'y', 'z'];
  const axes: FaceSnapAxis[] = [];
  if (axis.includes('X')) axes.push('x');
  if (axis.includes('Y')) axes.push('y');
  if (axis.includes('Z')) axes.push('z');
  return axes.length ? axes : ['x', 'y', 'z'];
}

/**
 * Wraps TransformControls.
 *
 * The prototype wrote the transform map on every `objectChange` — i.e. per
 * frame of a drag — which is why gizmo moves never landed on the undo stack in
 * a usable form. Here the drag mutates the scene freely and commits **once** on
 * release, producing exactly one undo entry per gesture.
 *
 * The magnet toggle is object-face snap while translating. Shift temporarily
 * restores the 100 mm grid; rotation and scale still use their increment snaps.
 */
export class GizmoController {
  private readonly controls: TransformControls;
  private readonly pivot = new THREE.Object3D();
  private readonly guide: SnapGuide;
  private readonly onShift = (event: KeyboardEvent) => this.setShiftHeld(event.shiftKey);
  private readonly onBlur = () => this.setShiftHeld(false);
  private pivotAttached = false;
  private relatives = new Map<string, THREE.Matrix4>();
  private ids: string[] = [];
  private mode: GizmoMode = 'select';
  private dragging = false;
  private snapEnabled = false;
  private shiftHeld = false;
  private dragStart: Record<string, Transform> | null = null;

  constructor(
    scene: SceneManager,
    private readonly builder: ModelBuilder,
    private readonly onCommit: GizmoCommit,
  ) {
    this.controls = new TransformControls(scene.camera, scene.renderer.domElement);
    this.controls.size = 0.85;
    this.guide = new SnapGuide(scene);
    scene.scene.add(this.controls.getHelper());
    scene.scene.add(this.pivot);

    this.controls.addEventListener('dragging-changed', (e) => {
      const value = (e as unknown as { value: boolean }).value;
      // Orbit must not fight the gizmo.
      scene.controls.enabled = !value;
      this.dragging = value;
      if (value) this.dragStart = this.readTransforms();
      else this.commit();
    });

    this.controls.addEventListener('objectChange', () => {
      if (this.ids.length > 1) this.applyPivotToParts();
      this.applyLiveFaceSnap();
    });

    window.addEventListener('keydown', this.onShift);
    window.addEventListener('keyup', this.onShift);
    window.addEventListener('blur', this.onBlur);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    this.applyGizmoIncrements();
  }

  sync(mode: GizmoMode, selectedIds: readonly string[]): void {
    const ids = selectedIds.filter((id) => this.builder.getRoot(id));
    this.ids = ids;
    this.mode = mode;
    this.applyGizmoIncrements();

    if (!ids.length || mode === 'select' || mode === 'pan') {
      this.controls.detach();
      this.pivotAttached = false;
      this.guide.clear();
      return;
    }

    this.controls.setMode(mode);

    if (ids.length === 1) {
      const root = this.builder.getRoot(ids[0]!);
      if (root) this.controls.attach(root);
      this.pivotAttached = false;
      return;
    }

    this.attachPivot(ids);
  }

  /**
   * Multi-selection drives a temporary pivot at the centroid; each part keeps
   * its offset from that pivot as a matrix, reapplied on every drag frame.
   */
  private attachPivot(ids: readonly string[]): void {
    const centre = new THREE.Vector3();
    for (const id of ids) {
      const root = this.builder.getRoot(id);
      if (!root) continue;
      root.updateMatrixWorld(true);
      centre.add(root.getWorldPosition(new THREE.Vector3()));
    }
    centre.divideScalar(ids.length || 1);

    this.pivot.position.copy(centre);
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.scale.set(1, 1, 1);
    this.pivot.updateMatrixWorld(true);

    const inverse = this.pivot.matrixWorld.clone().invert();
    this.relatives = new Map();
    for (const id of ids) {
      const root = this.builder.getRoot(id);
      if (!root) continue;
      root.updateMatrixWorld(true);
      this.relatives.set(id, new THREE.Matrix4().multiplyMatrices(inverse, root.matrixWorld));
    }

    this.controls.attach(this.pivot);
    this.pivotAttached = true;
  }

  private applyPivotToParts(): void {
    this.pivot.updateMatrixWorld(true);
    const world = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (const id of this.ids) {
      const root = this.builder.getRoot(id);
      const relative = this.relatives.get(id);
      if (!root || !relative) continue;
      world.multiplyMatrices(this.pivot.matrixWorld, relative);
      world.decompose(position, quaternion, scale);
      root.position.copy(position);
      root.quaternion.copy(quaternion);
      root.scale.copy(scale);
    }
  }

  private setShiftHeld(held: boolean): void {
    if (held === this.shiftHeld) return;
    this.shiftHeld = held;
    this.applyGizmoIncrements();
    if (this.dragging) this.applyLiveFaceSnap();
  }

  /** Grid snap is Shift+translate; the magnet itself is object-face snap. */
  private applyGizmoIncrements(): void {
    const gridTranslate = this.shiftHeld && this.mode === 'translate';
    this.controls.setTranslationSnap(gridTranslate ? SNAP.translate : null);
    this.controls.setRotationSnap(this.snapEnabled ? SNAP.rotate : null);
    this.controls.setScaleSnap(this.snapEnabled ? SNAP.scale : null);
  }

  private applyLiveFaceSnap(): void {
    if (!this.dragging || this.mode !== 'translate' || !this.snapEnabled || this.shiftHeld) {
      this.guide.clear();
      return;
    }
    const plan = computeFaceSnap(this.builder, this.ids, translateAxes(this.controls.axis));
    if (!plan) {
      this.guide.clear();
      return;
    }
    const snapped = applyFaceSnapPlan(this.builder, this.ids, plan);
    if (this.pivotAttached && Object.keys(snapped).length) {
      this.pivot.position.x += plan.delta.x;
      this.pivot.position.y += plan.delta.y;
      this.pivot.position.z += plan.delta.z;
    }
    this.guide.setGuides(plan.guides);
  }

  private readTransforms(): Record<string, Transform> {
    const out: Record<string, Transform> = {};
    for (const id of this.ids) {
      const root = this.builder.getRoot(id);
      if (!root) continue;
      out[id] = {
        position: root.position.toArray() as [number, number, number],
        quaternion: root.quaternion.toArray() as [number, number, number, number],
        scale: root.scale.toArray() as [number, number, number],
      };
    }
    return out;
  }

  private commit(): void {
    this.guide.clear();
    const current = this.readTransforms();
    const before = this.dragStart;
    this.dragStart = null;

    // A click that never moved the gizmo must not land on the undo stack.
    const changed: Record<string, Transform> = {};
    for (const [id, t] of Object.entries(current)) {
      const prev = before?.[id];
      if (!prev || !sameTransform(prev, t)) changed[id] = t;
    }

    if (Object.keys(changed).length) {
      const groupScale =
        this.mode === 'scale' && this.pivotAttached
          ? this.pivot.scale.toArray() as Transform['scale']
          : undefined;
      this.onCommit(changed, { mode: this.mode, groupScale });
    }
    // Re-seat the pivot so the next drag starts from the committed state.
    if (this.pivotAttached && this.ids.length > 1) this.attachPivot(this.ids);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onShift);
    window.removeEventListener('keyup', this.onShift);
    window.removeEventListener('blur', this.onBlur);
    this.guide.dispose();
    this.controls.detach();
    this.controls.getHelper().removeFromParent();
    this.pivot.removeFromParent();
    this.controls.dispose();
  }
}
