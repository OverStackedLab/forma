import * as THREE from 'three';
import { convertedValue, formatLength } from '@/domain/units';
import type { Group } from '@/domain/types';
import { useUiStore } from '@/store/uiStore';
import { combinedWorldBounds } from './bounds';
import { clearanceTypedEdit, clearanceWitnesses, type ClearanceEdit } from './clearance';
import { layoutLabels, type LabelCandidate } from './labelLayout';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';
import { type Aabb, type Axis, type GapDimension, type Vec3 } from './selectionGap';

const LINE_COLOR = 0x4fa3ff;
const ALIGN_COLOR = 0xc68a46;
const LABEL_CLASS =
  'pointer-events-auto absolute z-[7] -translate-x-1/2 -translate-y-[130%] cursor-text select-none rounded-[5px] border border-select/40 bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-select';
const ALIGN_LABEL_CLASS =
  'pointer-events-auto absolute z-[7] -translate-x-1/2 -translate-y-[130%] cursor-text select-none rounded-[5px] border border-accent/40 bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-accent';
const OVERALL_LABEL_CLASS =
  'pointer-events-none absolute z-[7] -translate-x-1/2 -translate-y-[130%] select-none rounded-[5px] border border-select/40 bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-select';
const INPUT_CLASS =
  'w-[4.2rem] border-0 bg-transparent p-0 text-center font-mono text-[11px] outline-none';
const AXIS_LETTER: Record<Axis, string> = { x: 'W', y: 'H', z: 'D' };
const AXIS_TITLE: Record<Axis, string> = { x: 'Width', y: 'Height', z: 'Depth' };

type GapEdit = {
  index: number;
  input: HTMLInputElement;
  cancelled: boolean;
  axis: Axis;
  gapMm: number;
  movableIsHigh: boolean;
  kind: GapDimension['kind'];
};

/**
 * SketchUp-style selection dimensions. Two selected units lock that pair.
 * One selected unit shows the nearest facing gap in each direction so a
 * panel can be placed without picking a second object first.
 *
 * Each witness family belongs to the gesture that uses it: flush faces and
 * group-to-group edge alignment draw in the accent colour only while the move
 * gizmo is on, and overall W/H/D only while the scale gizmo is on, where the
 * labels can be typed to resize. Click a clearance label to type a new gap;
 * the gizmo's parts move to match. Labels are de-overlapped in screen space
 * once projected.
 */
export class SelectionDimensions {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({
    color: LINE_COLOR,
    depthTest: false,
  });
  private readonly alignMaterial = new THREE.LineBasicMaterial({
    color: ALIGN_COLOR,
    depthTest: false,
  });
  private lines: THREE.LineSegments | null = null;
  private alignLines: THREE.LineSegments | null = null;
  private labelRoot: HTMLElement | null = null;
  private readonly labels: HTMLElement[] = [];
  private dimensions: GapDimension[] = [];
  private signature = '';
  private editing: GapEdit | null = null;
  /** Inputs of the last `sync`, so an unchanged frame costs nothing. */
  private lastInputs = '';

  constructor(
    private readonly scene: SceneManager,
    private readonly onEdit: (edit: ClearanceEdit) => void,
  ) {
    this.group.renderOrder = 10;
    scene.scene.add(this.group);
  }

  setLabelRoot(el: HTMLElement | null): void {
    this.labelRoot = el;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    this.lastInputs = '';
    if (!visible) this.hideLabels();
  }

  /**
   * Recomputes the witness geometry. Called every frame, so it short-circuits
   * on unchanged inputs: bounds come from `combinedWorldBounds`, which walks
   * every mesh of every neighbour and allocates a transformed box per mesh —
   * O(parts) of work that only actually changes when the document changes or a
   * drag is moving meshes. `sceneRevision` is bumped by the caller in both
   * cases (IMP-016). Label positioning still runs per frame in `updateLabels`,
   * because that follows the camera.
   */
  sync(
    builder: ModelBuilder,
    selectedIds: readonly string[],
    groups: readonly Group[],
    visibleIds: readonly string[],
    sceneRevision: number,
  ): void {
    if (!this.group.visible) {
      this.clear();
      return;
    }
    const gizmoMode = useUiStore.getState().gizmoMode;
    const inputs = `${sceneRevision}|${gizmoMode}|${selectedIds.join(',')}`;
    if (inputs === this.lastInputs) return;
    this.lastInputs = inputs;
    if (this.editing?.kind === 'align' && gizmoMode !== 'translate') this.cancelEdit();
    const witnesses = clearanceWitnesses({
      groups,
      selectedIds,
      visibleIds,
      gizmoMode,
      bounds: (partIds) => {
        const box = combinedWorldBounds(partIds.map((id) => builder.getRoot(id)));
        return box ? aabbFromBox(box) : null;
      },
    });
    if (!witnesses) {
      this.clear();
      return;
    }
    this.draw(witnesses);
  }

  updateLabels(): void {
    const root = this.labelRoot;
    if (!root || !this.group.visible || !this.dimensions.length) {
      this.hideLabels();
      return;
    }
    this.ensureLabels(this.dimensions.length);
    const unit = useUiStore.getState().displayUnit;
    const scaleOn = useUiStore.getState().gizmoMode === 'scale';
    const width = this.scene.renderer.domElement.clientWidth;
    const height = this.scene.renderer.domElement.clientHeight;

    const candidates: LabelCandidate[] = [];
    this.dimensions.forEach((dimension, index) => {
      const el = this.labels[index];
      if (!el) return;
      el.className = labelClass(dimension.kind, scaleOn);
      el.dataset.testid = testIdFor(dimension.kind);
      el.title = labelTitle(dimension.kind, dimension.axis, scaleOn);
      const text =
        dimension.kind === 'overall'
          ? `${AXIS_LETTER[dimension.axis]} ${formatLength(dimension.gapMm, unit)} ${unit}`
          : `${formatLength(dimension.gapMm, unit)} ${unit}`;
      // The label being typed into owns its DOM children; leave its text alone.
      if (this.editing?.index !== index) el.textContent = text;

      const mid = midpoint(dimension.line[0], dimension.line[1]).project(this.scene.camera);
      if (mid.z >= 1) {
        el.style.display = 'none';
        return;
      }
      candidates.push({
        index,
        x: (mid.x * 0.5 + 0.5) * width,
        y: (-mid.y * 0.5 + 0.5) * height,
        text,
        depth: mid.z,
        pinned: this.editing?.index === index,
      });
    });

    // Two witnesses far apart in the scene can still project onto the same
    // pixels, so overlap is resolved here rather than in world space (BUG-039).
    for (const placed of layoutLabels(candidates)) {
      const el = this.labels[placed.index];
      if (!el) continue;
      el.style.display = placed.visible ? 'block' : 'none';
      el.style.left = `${placed.x}px`;
      el.style.top = `${placed.y}px`;
    }
  }

  dispose(): void {
    this.clear();
    this.hideLabels();
    for (const el of this.labels) el.remove();
    this.labels.length = 0;
    this.group.removeFromParent();
    this.material.dispose();
    this.alignMaterial.dispose();
  }

  private draw(dimensions: GapDimension[]): void {
    const signature = dimensions
      .map((dimension) =>
        [
          dimension.kind,
          dimension.axis,
          dimension.gapMm.toFixed(2),
          dimension.line[0].x,
          dimension.line[0].y,
          dimension.line[0].z,
          dimension.line[1].x,
          dimension.line[1].y,
          dimension.line[1].z,
        ].join(':'),
      )
      .join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.clearLines();
    this.dimensions = dimensions;
    if (!dimensions.length) {
      this.hideLabels();
      return;
    }
    const gapPositions: number[] = [];
    const alignPositions: number[] = [];
    for (const dimension of dimensions) {
      const positions = dimension.kind === 'align' ? alignPositions : gapPositions;
      addSegment(positions, dimension.line);
      addSegment(positions, dimension.witnessA);
      addSegment(positions, dimension.witnessB);
      addSegment(positions, dimension.tickA);
      addSegment(positions, dimension.tickB);
    }
    this.lines = makeLineSegments(gapPositions, this.material, this.group);
    this.alignLines = makeLineSegments(alignPositions, this.alignMaterial, this.group);
  }

  private ensureLabels(count: number): void {
    const root = this.labelRoot;
    if (!root) return;
    while (this.labels.length < count) {
      const el = document.createElement('div');
      el.className = LABEL_CLASS;
      el.style.display = 'none';
      el.dataset.testid = 'selection-dimension';
      el.title = 'Set clearance';
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        this.beginEdit(this.labels.indexOf(el));
      });
      root.appendChild(el);
      this.labels.push(el);
    }
    for (let i = count; i < this.labels.length; i++) releaseLabel(this.labels[i]);
  }

  private beginEdit(index: number): void {
    if (this.editing?.index === index) {
      this.editing.input.focus();
      return;
    }
    this.commitEdit();
    const el = this.labels[index];
    const dimension = this.dimensions[index];
    if (!el || !dimension) return;
    const gizmoMode = useUiStore.getState().gizmoMode;
    if (dimension.kind === 'overall' && gizmoMode !== 'scale') return;
    if (dimension.kind === 'align' && gizmoMode !== 'translate') return;

    const unit = useUiStore.getState().displayUnit;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.setAttribute(
      'aria-label',
      dimension.kind === 'overall' ? AXIS_TITLE[dimension.axis] : 'Clearance',
    );
    input.className = `${INPUT_CLASS} ${dimension.kind === 'align' ? 'text-accent' : 'text-select'}`;
    input.value = String(convertedValue(dimension.gapMm, unit));
    this.editing = {
      index,
      input,
      cancelled: false,
      axis: dimension.axis,
      gapMm: dimension.gapMm,
      movableIsHigh: dimension.movableIsHigh,
      kind: dimension.kind,
    };
    el.textContent = '';
    if (dimension.kind === 'overall') {
      el.append(
        document.createTextNode(`${AXIS_LETTER[dimension.axis]} `),
        input,
        document.createTextNode(` ${unit}`),
      );
    } else {
      el.append(input, document.createTextNode(` ${unit}`));
    }
    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        this.finishEdit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelEdit();
      }
    });
    input.addEventListener('blur', () => this.finishEdit());
    input.focus();
    input.select();
  }

  private finishEdit(): void {
    const editing = this.editing;
    this.editing = null;
    if (!editing) return;
    if (!editing.cancelled) this.applyEdit(editing);
    editing.input.remove();
  }

  private applyEdit(editing: GapEdit): void {
    const edit = clearanceTypedEdit({
      kind: editing.kind,
      axis: editing.axis,
      gapMm: editing.gapMm,
      movableIsHigh: editing.movableIsHigh,
      raw: editing.input.value,
      unit: useUiStore.getState().displayUnit,
    });
    if (edit) this.onEdit(edit);
  }

  private commitEdit(): void {
    this.finishEdit();
  }

  private cancelEdit(): void {
    if (!this.editing) return;
    this.editing.cancelled = true;
    this.finishEdit();
  }

  private hideLabels(): void {
    this.cancelEdit();
    for (const el of this.labels) releaseLabel(el);
  }

  private clear(): void {
    this.dimensions = [];
    this.signature = '';
    this.lastInputs = '';
    this.clearLines();
    this.hideLabels();
  }

  private clearLines(): void {
    disposeLines(this.lines);
    disposeLines(this.alignLines);
    this.lines = null;
    this.alignLines = null;
  }
}

/**
 * Returns a pooled label to the free list. Hiding it is not enough: a retired
 * element that keeps its `data-testid` and its text still answers queries for
 * a witness that is no longer on screen.
 */
function releaseLabel(el: HTMLElement | undefined): void {
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
  delete el.dataset.testid;
}

function labelClass(kind: GapDimension['kind'], scaleOn: boolean): string {
  if (kind === 'align') return ALIGN_LABEL_CLASS;
  if (kind === 'overall') return scaleOn ? LABEL_CLASS : OVERALL_LABEL_CLASS;
  return LABEL_CLASS;
}

function testIdFor(kind: GapDimension['kind']): string {
  if (kind === 'overall') return 'selection-overall-dimension';
  if (kind === 'align') return 'selection-align-dimension';
  return 'selection-dimension';
}

function labelTitle(kind: GapDimension['kind'], axis: Axis, scaleOn: boolean): string {
  if (kind === 'overall') return scaleOn ? `Set ${AXIS_TITLE[axis].toLowerCase()}` : AXIS_TITLE[axis];
  if (kind === 'align') return 'Aligned — set clearance';
  return 'Set clearance';
}

function makeLineSegments(
  positions: number[],
  material: THREE.LineBasicMaterial,
  parent: THREE.Object3D,
): THREE.LineSegments | null {
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  parent.add(lines);
  return lines;
}

function disposeLines(lines: THREE.LineSegments | null): void {
  if (!lines) return;
  lines.geometry.dispose();
  lines.removeFromParent();
}

function aabbFromBox(box: THREE.Box3): Aabb {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

function addSegment(positions: number[], segment: [Vec3, Vec3]): void {
  positions.push(segment[0].x, segment[0].y, segment[0].z, segment[1].x, segment[1].y, segment[1].z);
}

function midpoint(a: Vec3, b: Vec3): THREE.Vector3 {
  return new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
