import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Transform } from '@/domain/types';
import type { GizmoMode } from '@/store/uiStore';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';

/** Snap increments: 100 mm, 15°, 0.1×. */
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

/**
 * Wraps TransformControls.
 *
 * The prototype wrote the transform map on every `objectChange` — i.e. per
 * frame of a drag — which is why gizmo moves never landed on the undo stack in
 * a usable form. Here the drag mutates the scene freely and commits **once** on
 * release, producing exactly one undo entry per gesture.
 */
export class GizmoController {
  private readonly controls: TransformControls;
  private readonly pivot = new THREE.Object3D();
  private pivotAttached = false;
  private relatives = new Map<string, THREE.Matrix4>();
  private ids: string[] = [];
  private mode: GizmoMode = 'select';
  private dragging = false;
  private dragStart: Record<string, Transform> | null = null;

  constructor(
    scene: SceneManager,
    private readonly builder: ModelBuilder,
    private readonly onCommit: GizmoCommit,
  ) {
    this.controls = new TransformControls(scene.camera, scene.renderer.domElement);
    this.controls.size = 0.85;
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
    });
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  setSnapEnabled(enabled: boolean): void {
    this.controls.setTranslationSnap(enabled ? SNAP.translate : null);
    this.controls.setRotationSnap(enabled ? SNAP.rotate : null);
    this.controls.setScaleSnap(enabled ? SNAP.scale : null);
  }

  sync(mode: GizmoMode, selectedIds: readonly string[]): void {
    const ids = selectedIds.filter((id) => this.builder.getRoot(id));
    this.ids = ids;
    this.mode = mode;

    if (!ids.length || mode === 'select' || mode === 'pan') {
      this.controls.detach();
      this.pivotAttached = false;
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
    this.controls.detach();
    this.controls.getHelper().removeFromParent();
    this.pivot.removeFromParent();
    this.controls.dispose();
  }
}
