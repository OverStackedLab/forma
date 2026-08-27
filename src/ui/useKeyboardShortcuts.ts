import { useEffect } from 'react';
import { arrowNudgeDeltaMm, isArrowKey, NUDGE_GRID_MM, type NudgeFrame } from '@/domain/nudge';
import { toMm } from '@/domain/units';
import { deleteParts, duplicateSelected, nudgeSelected, selectAll } from '@/store/actions';
import { redo, undo } from '@/store/history';
import { useUiStore, type GizmoMode } from '@/store/uiStore';
import { viewportApi } from '@/viewport/viewportApi';

/** True when keystrokes belong to a field rather than the app. */
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  );
}

const MODE_KEYS: Record<string, GizmoMode> = {
  q: 'select',
  escape: 'select',
  h: 'pan',
  g: 'translate',
  m: 'translate',
  r: 'rotate',
  s: 'scale',
};

const FALLBACK_NUDGE_FRAME: NudgeFrame = {
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  look: { x: 0, y: 0, z: -1 },
  plane: 'floor',
};

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;

      const ui = useUiStore.getState();
      // Model is the only mode with a selection or gizmos to drive.
      if (ui.viewMode !== 'model') return;

      const key = e.key.toLowerCase();

      if (e.metaKey || e.ctrlKey) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === 'a') {
          e.preventDefault();
          selectAll();
        } else if (key === 'd') {
          e.preventDefault();
          duplicateSelected();
        }
        return;
      }

      if (isArrowKey(e.key)) {
        if (ui.gizmoMode !== 'translate' || !ui.selectedPartIds.length) return;
        if (viewportApi()?.isGizmoDragging()) return;
        e.preventDefault();
        const stepMm = e.shiftKey ? NUDGE_GRID_MM : toMm(1, ui.displayUnit);
        const frame = viewportApi()?.viewNudgeFrame() ?? FALLBACK_NUDGE_FRAME;
        nudgeSelected(arrowNudgeDeltaMm(e.key, frame, stepMm));
        return;
      }

      if (key === 'f') {
        viewportApi()?.frameSelection(ui.selectedPartIds);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ui.selectedPartIds.length) {
          e.preventDefault();
          deleteParts(ui.selectedPartIds);
        }
        return;
      }

      const mode = MODE_KEYS[key];
      if (mode) ui.setGizmoMode(mode);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
