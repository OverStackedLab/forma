import * as THREE from 'three';
import { formatLength } from '@/domain/units';
import { useUiStore, type MeasurePoint } from '@/store/uiStore';
import type { SceneManager } from './SceneManager';

const MEASURE_COLOR = 0x4fa3ff;
/** 8 mm marker spheres. */
const DOT_RADIUS = 0.008;

/**
 * Renders the two measurement markers and the dashed span between them, and
 * positions the DOM label at the projected midpoint.
 *
 * The prototype replaced its group without disposing the old one, leaking a
 * geometry and material on every click.
 */
export class MeasureController {
  private readonly group = new THREE.Group();
  private readonly dotGeometry = new THREE.SphereGeometry(DOT_RADIUS, 12, 12);
  private readonly dotMaterial = new THREE.MeshBasicMaterial({ color: MEASURE_COLOR });
  private readonly lineMaterial = new THREE.LineDashedMaterial({
    color: MEASURE_COLOR,
    dashSize: 0.02,
    gapSize: 0.012,
  });
  private line: THREE.Line | null = null;
  private points: THREE.Vector3[] = [];
  private labelEl: HTMLElement | null = null;

  constructor(private readonly scene: SceneManager) {
    scene.scene.add(this.group);
  }

  setLabelElement(el: HTMLElement | null): void {
    this.labelEl = el;
  }

  setPoints(points: readonly MeasurePoint[]): void {
    this.clearChildren();
    this.points = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));

    for (const p of this.points) {
      const dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial);
      dot.position.copy(p);
      this.group.add(dot);
    }

    if (this.points.length === 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
      this.line = new THREE.Line(geometry, this.lineMaterial);
      this.line.computeLineDistances();
      this.group.add(this.line);
    }
  }

  /** Called once per frame — keeps the DOM label pinned to the 3D midpoint. */
  updateLabel(): void {
    const el = this.labelEl;
    if (!el) return;
    if (this.points.length !== 2) {
      el.style.display = 'none';
      return;
    }
    const [a, b] = this.points as [THREE.Vector3, THREE.Vector3];
    const mid = a.clone().add(b).multiplyScalar(0.5).project(this.scene.camera);
    const container = this.scene.renderer.domElement;
    el.style.display = mid.z < 1 ? 'block' : 'none';
    el.style.left = `${(mid.x * 0.5 + 0.5) * container.clientWidth}px`;
    el.style.top = `${(-mid.y * 0.5 + 0.5) * container.clientHeight}px`;
    const unit = useUiStore.getState().displayUnit;
    el.textContent = `${formatLength(a.distanceTo(b) * 1000, unit)} ${unit}`;
  }

  private clearChildren(): void {
    if (this.line) {
      this.line.geometry.dispose();
      this.line = null;
    }
    this.group.clear();
  }

  dispose(): void {
    this.clearChildren();
    this.group.removeFromParent();
    this.dotGeometry.dispose();
    this.dotMaterial.dispose();
    this.lineMaterial.dispose();
  }
}
