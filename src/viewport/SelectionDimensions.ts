import * as THREE from 'three';
import { convertedValue, formatLength, parseLength, type DisplayUnit } from '@/domain/units';
import { cabinetContainingSelection, selectionUnits, dimensionNeighborIds } from '@/domain/parts';
import type { Group } from '@/domain/types';
import { nudgeSelected } from '@/store/actions';
import { useUiStore } from '@/store/uiStore';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';
import {
  gapsBetweenBoxes,
  gapDeltaMm,
  nearestFacingGaps,
  overallDimensions,
  type Aabb,
  type Axis,
  type GapDimension,
  type Vec3,
} from './selectionGap';

const LINE_COLOR = 0x4fa3ff;
const LABEL_CLASS =
  'pointer-events-auto absolute z-[7] hidden -translate-x-1/2 -translate-y-[130%] cursor-text select-none rounded-[5px] border border-select/40 bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-select';
const OVERALL_LABEL_CLASS =
  'pointer-events-none absolute z-[7] hidden -translate-x-1/2 -translate-y-[130%] select-none rounded-[5px] border border-select/40 bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-select';
const INPUT_CLASS =
  'w-[4.2rem] border-0 bg-transparent p-0 text-center font-mono text-[11px] text-select outline-none';
const AXIS_LETTER: Record<Axis, string> = { x: 'W', y: 'H', z: 'D' };
const AXIS_TITLE: Record<Axis, string> = { x: 'Width', y: 'Height', z: 'Depth' };

type GapEdit = {
  index: number;
  input: HTMLInputElement;
  cancelled: boolean;
  axis: Axis;
  gapMm: number;
  movableIsHigh: boolean;
};

/**
 * SketchUp-style selection dimensions. Two selected units lock that pair.
 * One selected unit shows the nearest facing gap in each direction so a
 * panel can be placed without picking a second object first. A cabinet (or
 * fully selected group) also draws overall W/H/D. Click a clearance label
 * to type a new gap; the gizmo's parts move to match. Overall labels are
 * display-only.
 */
export class SelectionDimensions {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({
    color: LINE_COLOR,
    depthTest: false,
  });
  private lines: THREE.LineSegments | null = null;
  private labelRoot: HTMLElement | null = null;
  private readonly labels: HTMLElement[] = [];
  private dimensions: GapDimension[] = [];
  private signature = '';
  private editing: GapEdit | null = null;

  constructor(private readonly scene: SceneManager) {
    this.group.renderOrder = 10;
    scene.scene.add(this.group);
  }

  setLabelRoot(el: HTMLElement | null): void {
    this.labelRoot = el;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) this.hideLabels();
  }

  sync(
    builder: ModelBuilder,
    selectedIds: readonly string[],
    groups: readonly Group[],
    visibleIds: readonly string[],
  ): void {
    if (!this.group.visible) {
      this.clear();
      return;
    }
    const units = selectionUnits(groups, selectedIds);
    if (units.length === 2) {
      const first = units[0];
      const second = units[1];
      if (!first || !second) {
        this.clear();
        return;
      }
      const boxA = combinedWorldBounds(first.partIds.map((id) => builder.getRoot(id)));
      const boxB = combinedWorldBounds(second.partIds.map((id) => builder.getRoot(id)));
      if (!boxA || !boxB) {
        this.clear();
        return;
      }
      this.draw(gapsBetweenBoxes(boxA, boxB));
      return;
    }
    if (units.length !== 1) {
      this.clear();
      return;
    }
    const selected = units[0];
    if (!selected) {
      this.clear();
      return;
    }
    const selectedBox = combinedWorldBounds(selected.partIds.map((id) => builder.getRoot(id)));
    if (!selectedBox) {
      this.clear();
      return;
    }
    const others: Aabb[] = [];
    for (const partIds of dimensionNeighborIds(groups, visibleIds, selected.partIds)) {
      const box = combinedWorldBounds(partIds.map((id) => builder.getRoot(id)));
      if (box) others.push(box);
    }
    const overallIds = previewOverallIds(groups, selectedIds, selected);
    const overallBox = overallIds
      ? combinedWorldBounds(overallIds.map((id) => builder.getRoot(id)))
      : null;
    const overall = overallBox ? overallDimensions(aabbFromBox(overallBox)) : [];
    this.draw([...overall, ...nearestFacingGaps(selectedBox, others)]);
  }

  updateLabels(): void {
    const root = this.labelRoot;
    if (!root || !this.group.visible || !this.dimensions.length) {
      this.hideLabels();
      return;
    }
    this.ensureLabels(this.dimensions.length);
    const unit = useUiStore.getState().displayUnit;
    const width = this.scene.renderer.domElement.clientWidth;
    const height = this.scene.renderer.domElement.clientHeight;
    this.dimensions.forEach((dimension, index) => {
      const el = this.labels[index];
      if (!el) return;
      const isOverall = dimension.kind === 'overall';
      el.className = isOverall ? OVERALL_LABEL_CLASS : LABEL_CLASS;
      el.dataset.testid = isOverall ? 'selection-overall-dimension' : 'selection-dimension';
      el.title = isOverall ? AXIS_TITLE[dimension.axis] : 'Set clearance';
      const mid = midpoint(dimension.line[0], dimension.line[1]).project(this.scene.camera);
      el.style.display = mid.z < 1 ? 'block' : 'none';
      el.style.left = `${(mid.x * 0.5 + 0.5) * width}px`;
      el.style.top = `${(-mid.y * 0.5 + 0.5) * height}px`;
      if (this.editing?.index === index) return;
      el.textContent = isOverall
        ? `${AXIS_LETTER[dimension.axis]} ${formatLength(dimension.gapMm, unit)} ${unit}`
        : `${formatLength(dimension.gapMm, unit)} ${unit}`;
    });
  }

  dispose(): void {
    this.clear();
    this.hideLabels();
    for (const el of this.labels) el.remove();
    this.labels.length = 0;
    this.group.removeFromParent();
    this.material.dispose();
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
    const positions: number[] = [];
    for (const dimension of dimensions) {
      addSegment(positions, dimension.line);
      addSegment(positions, dimension.witnessA);
      addSegment(positions, dimension.witnessB);
      addSegment(positions, dimension.tickA);
      addSegment(positions, dimension.tickB);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.lines = new THREE.LineSegments(geometry, this.material);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
  }

  private ensureLabels(count: number): void {
    const root = this.labelRoot;
    if (!root) return;
    while (this.labels.length < count) {
      const el = document.createElement('div');
      el.className = LABEL_CLASS;
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
    for (let i = count; i < this.labels.length; i++) {
      const extra = this.labels[i];
      if (extra) extra.style.display = 'none';
    }
  }

  private beginEdit(index: number): void {
    if (this.editing?.index === index) {
      this.editing.input.focus();
      return;
    }
    this.commitEdit();
    const el = this.labels[index];
    const dimension = this.dimensions[index];
    if (!el || !dimension || dimension.kind === 'overall') return;

    const unit = useUiStore.getState().displayUnit;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.setAttribute('aria-label', 'Clearance');
    input.className = INPUT_CLASS;
    input.value = String(convertedValue(dimension.gapMm, unit));
    this.editing = {
      index,
      input,
      cancelled: false,
      axis: dimension.axis,
      gapMm: dimension.gapMm,
      movableIsHigh: dimension.movableIsHigh,
    };
    el.textContent = '';
    el.append(input, document.createTextNode(` ${unit}`));
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
    const unit = useUiStore.getState().displayUnit;
    const raw = editing.input.value;
    if (typedMatchesDisplay(raw, editing.gapMm, unit)) return;
    const target = parseLength(raw, unit);
    const delta = target === null ? null : gapDeltaMm(editing.movableIsHigh, editing.gapMm, target);
    if (delta === null || delta === 0) return;
    nudgeSelected({
      x: editing.axis === 'x' ? delta : 0,
      y: editing.axis === 'y' ? delta : 0,
      z: editing.axis === 'z' ? delta : 0,
    });
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
    for (const el of this.labels) el.style.display = 'none';
  }

  private clear(): void {
    this.dimensions = [];
    this.signature = '';
    this.clearLines();
    this.hideLabels();
  }

  private clearLines(): void {
    if (!this.lines) return;
    this.lines.geometry.dispose();
    this.lines.removeFromParent();
    this.lines = null;
  }
}

function previewOverallIds(
  groups: readonly Group[],
  selectedIds: readonly string[],
  selected: { kind: 'group' | 'part'; partIds: readonly string[] },
): readonly string[] | null {
  const cabinet = cabinetContainingSelection(groups, selectedIds);
  if (cabinet) return cabinet.partIds;
  if (selected.kind === 'group') return selected.partIds;
  return null;
}

function aabbFromBox(box: THREE.Box3): Aabb {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

function typedMatchesDisplay(raw: string, gapMm: number, unit: DisplayUnit): boolean {
  const typed = raw.trim().replace(/,/g, '').toLowerCase();
  const shown = String(convertedValue(gapMm, unit));
  return typed === shown || typed === `${shown} ${unit}` || typed === `${shown}${unit}`;
}

function addSegment(positions: number[], segment: [Vec3, Vec3]): void {
  positions.push(segment[0].x, segment[0].y, segment[0].z, segment[1].x, segment[1].y, segment[1].z);
}

function midpoint(a: Vec3, b: Vec3): THREE.Vector3 {
  return new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
