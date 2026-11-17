import { useEffect, useRef } from 'react';
import { useUiStore } from '@/store/uiStore';
import { Icon } from './primitives/Icon';

const DISMISS_MS = 2600;

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => dismissToast(toast.id), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [toast, dismissToast]);

  // Click-away dismissal, for dismissible (tool) toasts only. A pointerdown
  // outside the toast closes it. While
  // Measure is on, a press on the canvas that dismisses the toast is swallowed
  // (capture phase, before PickController) so dismissing never adds or resets
  // a measure point; the next click measures normally. Presses elsewhere
  // (toolbar, sidebars) and all presses outside Measure keep their usual effect.
  useEffect(() => {
    if (!toast?.dismissible) return;
    const onPointerDown = (e: PointerEvent) => {
      if (pillRef.current?.contains(e.target as Node)) return;
      dismissToast(toast.id);
      if (useUiStore.getState().measureActive && e.target instanceof HTMLCanvasElement) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [toast, dismissToast]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 z-30">
      {toast && (
        <div
          key={toast.id}
          ref={pillRef}
          className={`animate-toast-in absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[20px] border border-white/12 bg-input text-[12.5px] text-ink ${
            toast.dismissible ? 'pointer-events-auto py-1.5 pr-1.5 pl-4.5 whitespace-nowrap' : 'px-4.5 py-2.5'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {toast.message}
          {toast.dismissible && (
            <button
              type="button"
              aria-label="Dismiss"
              title="Dismiss"
              // Keep the press away from the viewport and any window listeners.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink/50 hover:bg-white/8 hover:text-ink"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
