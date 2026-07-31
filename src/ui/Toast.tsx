import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';

const DISMISS_MS = 2600;

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => dismissToast(toast.id), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [toast, dismissToast]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 z-30">
      {toast && (
        <div
          key={toast.id}
          className="animate-toast-in absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[20px] border border-white/12 bg-input px-4.5 py-2.5 text-[12.5px] text-ink"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {toast.message}
        </div>
      )}
    </div>
  );
}
