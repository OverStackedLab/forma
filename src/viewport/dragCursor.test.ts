import { describe, expect, it } from 'vitest';
import {
  beginDragCursor,
  dragCursorStyle,
  endDragCursor,
  IDLE_DRAG_CURSOR,
  moveDragCursor,
  type DragCursorPointer,
} from './dragCursor';

function pointer(overrides: Partial<DragCursorPointer> = {}): DragCursorPointer {
  return { pointerId: 1, clientX: 0, clientY: 0, button: 0, ...overrides };
}

describe('viewport drag cursor', () => {
  it('keeps the arrow until the pointer has moved', () => {
    const armed = beginDragCursor(IDLE_DRAG_CURSOR, pointer({ clientX: 10, clientY: 10 }));
    expect(dragCursorStyle(armed)).toBe('');

    const twitch = moveDragCursor(armed, pointer({ clientX: 12, clientY: 10 }));
    expect(dragCursorStyle(twitch)).toBe('');

    const dragged = moveDragCursor(twitch, pointer({ clientX: 16, clientY: 10 }));
    expect(dragCursorStyle(dragged)).toBe('grabbing');
  });

  it('restores the default cursor when that pointer ends', () => {
    const armed = beginDragCursor(IDLE_DRAG_CURSOR, pointer());
    const dragged = moveDragCursor(armed, pointer({ clientX: 20 }));
    const ended = endDragCursor(dragged, 1);
    expect(ended).toEqual(IDLE_DRAG_CURSOR);
    expect(dragCursorStyle(ended)).toBe('');
  });

  it('ignores a pointerup from a different pointer', () => {
    const armed = beginDragCursor(IDLE_DRAG_CURSOR, pointer());
    expect(endDragCursor(armed, 2)).toBe(armed);
  });

  it('does not let a second pointer replace the gesture', () => {
    const armed = beginDragCursor(IDLE_DRAG_CURSOR, pointer());
    expect(beginDragCursor(armed, pointer({ pointerId: 2, clientX: 8, clientY: 8 }))).toBe(armed);
  });

  it('ignores buttons that do not drag the viewport', () => {
    expect(beginDragCursor(IDLE_DRAG_CURSOR, pointer({ button: 3 }))).toBe(IDLE_DRAG_CURSOR);
  });
});
