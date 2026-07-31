import * as THREE from 'three';
import type { Marquee } from '@/store/uiStore';
import type { ModelBuilder } from './ModelBuilder';
import type { SceneManager } from './SceneManager';

/** Pointer travel, in px, before a shift-drag becomes a marquee. */
const MARQUEE_THRESHOLD = 5;
/** Pointer travel below which a pointerup still counts as a click. */
const CLICK_SLOP = 5;

export type PickCallbacks = {
  isMeasureActive: () => boolean;
  isPanMode: () => boolean;
  isGizmoDragging: () => boolean;
  onSelect: (partId: string, additive: boolean) => void;
  onClearSelection: () => void;
  onMarqueeChange: (marquee: Marquee | null) => void;
  onMarqueeCommit: (partIds: string[], additive: boolean) => void;
  onMeasurePoint: (point: THREE.Vector3) => void;
  onDropPanel: (presetId: string, point: { x: number; z: number } | null) => void;
};

export class PickController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly element: HTMLElement;
  private readonly dropElement: HTMLElement;

  private downAt: { x: number; y: number } | null = null;
  private marqueePending: { x: number; y: number } | null = null;
  private marqueeStart: { x: number; y: number } | null = null;
  private marqueeAdditive = false;
  private marqueeBox: Marquee | null = null;

  private readonly handlers: Array<[HTMLElement, string, EventListener]> = [];

  constructor(
    private readonly scene: SceneManager,
    private readonly builder: ModelBuilder,
    private readonly callbacks: PickCallbacks,
  ) {
    // Pointer events are scoped to the canvas itself, not its container. The
    // gizmo toolbar, Frame button and render bar are siblings of the canvas
    // inside that container, so listening on the container caught their
    // clicks too — bubbling into a raycast that hit nothing and cleared the
    // selection every time a tool button was pressed. Drag/drop doesn't touch
    // selection, so it stays on the container for a more forgiving drop area.
    this.element = scene.renderer.domElement;
    this.dropElement = this.element.parentElement ?? this.element;

    this.on(this.element, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.on(this.element, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.on(this.element, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.on(this.element, 'pointerleave', () => this.onPointerLeave());
    this.on(this.dropElement, 'dragover', (e) => e.preventDefault());
    this.on(this.dropElement, 'drop', (e) => this.onDrop(e as DragEvent));
  }

  private on(target: HTMLElement, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.handlers.push([target, type, handler]);
  }

  private localPoint(e: PointerEvent | DragEvent): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.callbacks.isGizmoDragging()) return;
    this.downAt = { x: e.clientX, y: e.clientY };

    // The marquee is only *armed* here. Committing to it on pointerdown would
    // swallow shift-click additive selection, because a zero-movement
    // shift-click would then never reach the raycast path.
    const canMarquee = e.shiftKey && !this.callbacks.isPanMode() && !this.callbacks.isMeasureActive();
    if (canMarquee) {
      this.marqueePending = this.localPoint(e);
      this.marqueeAdditive = e.metaKey || e.ctrlKey;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const p = this.localPoint(e);

    if (this.marqueePending && !this.marqueeStart) {
      const from = this.marqueePending;
      if (Math.hypot(p.x - from.x, p.y - from.y) < MARQUEE_THRESHOLD) return;
      this.marqueeStart = from;
      this.scene.controls.enabled = false;
    }

    if (!this.marqueeStart) return;
    const s = this.marqueeStart;
    this.marqueeBox = {
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    };
    this.callbacks.onMarqueeChange(this.marqueeBox);
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.marqueeStart) {
      this.downAt = null;
      this.marqueePending = null;
      this.finishMarquee();
      return;
    }
    this.marqueePending = null;

    const down = this.downAt;
    this.downAt = null;
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;

    const hit = this.raycast(e);

    if (this.callbacks.isMeasureActive()) {
      if (hit) this.callbacks.onMeasurePoint(hit.point);
      return;
    }

    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (hit?.partId) this.callbacks.onSelect(hit.partId, additive);
    else if (!additive) this.callbacks.onClearSelection();
  }

  private onPointerLeave(): void {
    if (this.marqueeStart) this.finishMarquee();
    else this.marqueePending = null;
  }

  private raycast(e: PointerEvent | DragEvent): { partId?: string; point: THREE.Vector3 } | null {
    const rect = this.element.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);
    const hits = this.raycaster.intersectObjects(this.builder.pickables, true);
    for (const h of hits) {
      const partId = h.object.userData.partId as string | undefined;
      if (partId) return { partId, point: h.point };
    }
    return null;
  }

  /**
   * Hit-tests by projecting each visible part's world position into screen
   * space and testing containment.
   */
  private finishMarquee(): void {
    const box = this.marqueeBox;
    this.marqueeStart = null;
    this.marqueePending = null;
    this.marqueeBox = null;
    this.scene.controls.enabled = true;
    this.callbacks.onMarqueeChange(null);

    if (!box || (box.w < 4 && box.h < 4)) return;

    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    const projected = new THREE.Vector3();
    const hits: string[] = [];

    for (const id of this.builder.visibleIds()) {
      const root = this.builder.getRoot(id);
      if (!root) continue;
      root.updateMatrixWorld(true);
      root.getWorldPosition(projected).project(this.scene.camera);
      if (projected.z > 1) continue;
      const sx = (projected.x * 0.5 + 0.5) * width;
      const sy = (-projected.y * 0.5 + 0.5) * height;
      if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) hits.push(id);
    }

    this.callbacks.onMarqueeCommit(hits, this.marqueeAdditive);
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
    const data = e.dataTransfer?.getData('text/plain');
    if (!data) return;
    const [kind, id] = data.split(':');
    if (kind !== 'panel' || !id) return;

    const rect = this.element.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);
    const groundHit = this.raycaster.intersectObject(this.scene.ground)[0];
    this.callbacks.onDropPanel(
      id,
      groundHit ? { x: groundHit.point.x, z: groundHit.point.z } : null,
    );
  }

  dispose(): void {
    for (const [target, type, handler] of this.handlers) target.removeEventListener(type, handler);
    this.handlers.length = 0;
  }
}
