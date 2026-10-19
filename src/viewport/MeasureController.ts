import * as THREE from 'three';
import { formatLength } from '@/domain/units';
import { isAxisAligned, measureDeltas } from '@/domain/measure';
import { useUiStore, type MeasurePoint } from '@/store/uiStore';
import type { SceneManager } from './SceneManager';

const MEASURE_COLOR = 0x4fa3ff;
/** 8 mm marker spheres. */
const DOT_RADIUS = 0.008;

function metres(point: MeasurePoint): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

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
  private preview: THREE.Vector3 | null = null;
  private labelEl: HTMLElement | null = null;

  constructor(private readonly scene: SceneManager) {
    scene.scene.add(this.group);
  }

  setLabelElement(el: HTMLElement | null): void {
    this.labelEl = el;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible && this.labelEl) this.labelEl.style.display = 'none';
  }

  setPoints(points: readonly MeasurePoint[]): void {
    this.points = points.map((p) => metres(p));
    if (this.points.length !== 1) this.preview = null;
    this.rebuild();
  }

  /** Rubber-band the second point before it is committed. World metres. */
  setPreview(point: MeasurePoint | null): void {
    if (this.points.length !== 1) {
      if (this.preview) {
        this.preview = null;
        this.rebuild();
      }
      return;
    }
    if (!point) {
      if (this.preview) {
        this.preview = null;
        this.rebuild();
      }
      return;
    }
    if (
      this.preview &&
      this.preview.x === point.x &&
      this.preview.y === point.y &&
      this.preview.z === point.z
    ) return;
    this.preview = metres(point);
    this.rebuild();
  }

  /** Called once per frame — keeps the DOM label pinned to the 3D midpoint. */
  updateLabel(): void {
    const el = this.labelEl;
    if (!el) return;
    const span = this.span();
    if (!this.group.visible || !span) {
      el.style.display = 'none';
      return;
    }
    const [a, b] = span;
    const mid = a.clone().add(b).multiplyScalar(0.5).project(this.scene.camera);
    const container = this.scene.renderer.domElement;
    el.style.display = mid.z < 1 ? 'block' : 'none';
    el.style.left = `${(mid.x * 0.5 + 0.5) * container.clientWidth}px`;
    el.style.top = `${(-mid.y * 0.5 + 0.5) * container.clientHeight}px`;
    const unit = useUiStore.getState().displayUnit;
    const aMm = { x: a.x * 1000, y: a.y * 1000, z: a.z * 1000 };
    const bMm = { x: b.x * 1000, y: b.y * 1000, z: b.z * 1000 };
    const deltas = measureDeltas(aMm, bMm);
    const length = `${formatLength(deltas.distance, unit)} ${unit}`;
    if (isAxisAligned(aMm, bMm)) {
      el.textContent = length;
      return;
    }
    el.textContent = `${length}\nΔX ${formatLength(Math.abs(deltas.dx), unit)} · ΔY ${formatLength(Math.abs(deltas.dy), unit)} · ΔZ ${formatLength(Math.abs(deltas.dz), unit)}`;
  }

  private span(): [THREE.Vector3, THREE.Vector3] | null {
    if (this.points.length === 2) {
      const a = this.points[0];
      const b = this.points[1];
      return a && b ? [a, b] : null;
    }
    if (this.points.length === 1 && this.preview) {
      const a = this.points[0];
      return a ? [a, this.preview] : null;
    }
    return null;
  }

  private rebuild(): void {
    this.clearChildren();
    for (const p of this.points) {
      const dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial);
      dot.position.copy(p);
      this.group.add(dot);
    }
    if (this.preview && this.points.length === 1) {
      const dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial);
      dot.position.copy(this.preview);
      this.group.add(dot);
    }
    const span = this.span();
    if (!span) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(span);
    this.line = new THREE.Line(geometry, this.lineMaterial);
    this.line.computeLineDistances();
    this.group.add(this.line);
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
