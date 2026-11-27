/** Pointer travel, in px, before a press counts as a viewport drag. */
export const DRAG_CURSOR_THRESHOLD_PX = 3;

export type DragCursorPointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
};

export type DragCursorPhase = {
  pointerId: number | null;
  x: number;
  y: number;
  grabbing: boolean;
};

export const IDLE_DRAG_CURSOR: DragCursorPhase = {
  pointerId: null,
  x: 0,
  y: 0,
  grabbing: false,
};

/**
 * Arms a gesture for the left, middle, or right button. A second pointer
 * does not replace the one already tracked.
 */
export function beginDragCursor(phase: DragCursorPhase, event: DragCursorPointer): DragCursorPhase {
  if (phase.pointerId !== null) return phase;
  if (event.button < 0 || event.button > 2) return phase;
  return { pointerId: event.pointerId, x: event.clientX, y: event.clientY, grabbing: false };
}

/** Closed hand once the pointer has actually moved; a click stays the arrow. */
export function moveDragCursor(phase: DragCursorPhase, event: DragCursorPointer): DragCursorPhase {
  if (phase.pointerId !== event.pointerId || phase.grabbing) return phase;
  const travel = Math.hypot(event.clientX - phase.x, event.clientY - phase.y);
  if (travel < DRAG_CURSOR_THRESHOLD_PX) return phase;
  return { ...phase, grabbing: true };
}

/** Ends the gesture for this pointer. A different pointer leaves it alone. */
export function endDragCursor(phase: DragCursorPhase, pointerId: number): DragCursorPhase {
  if (phase.pointerId !== pointerId) return phase;
  return IDLE_DRAG_CURSOR;
}

export function dragCursorStyle(phase: DragCursorPhase): '' | 'grabbing' {
  return phase.grabbing ? 'grabbing' : '';
}

/**
 * Shows a closed hand on the viewport canvas while a drag is in progress
 * (orbit, pan, or a gizmo), then restores the default cursor.
 *
 * The inline style lives on the canvas only, so text inputs, clearance
 * labels (`cursor-text`), and the Measure tool keep their own cursors.
 * OrbitControls' `cursorStyle = 'grab'` is not used: it leaves an open hand
 * as the resting cursor, and it never runs during a gizmo drag because orbit
 * is disabled for that gesture.
 */
export class DragCursor {
  private phase: DragCursorPhase = IDLE_DRAG_CURSOR;

  private readonly onPointerDown = (event: PointerEvent) => {
    const next = beginDragCursor(this.phase, event);
    if (next === this.phase) return;
    this.phase = next;
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    this.element.addEventListener('lostpointercapture', this.onPointerEnd);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    this.apply(moveDragCursor(this.phase, event));
  };

  private readonly onPointerEnd = (event: PointerEvent) => {
    const next = endDragCursor(this.phase, event.pointerId);
    if (next === this.phase) return;
    this.phase = next;
    this.element.style.cursor = '';
    this.unlistenEnd();
  };

  constructor(private readonly element: HTMLElement) {
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerEnd);
    element.addEventListener('pointercancel', this.onPointerEnd);
  }

  private apply(next: DragCursorPhase): void {
    if (next === this.phase) return;
    this.phase = next;
    this.element.style.cursor = dragCursorStyle(next);
  }

  private unlistenEnd(): void {
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    this.element.removeEventListener('lostpointercapture', this.onPointerEnd);
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerEnd);
    this.element.removeEventListener('pointercancel', this.onPointerEnd);
    this.unlistenEnd();
    this.phase = IDLE_DRAG_CURSOR;
    this.element.style.cursor = '';
  }
}
