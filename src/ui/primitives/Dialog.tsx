import { useEffect, useId } from 'react';

/**
 * A small modal. Forma deliberately has no `window.confirm` / `window.prompt`:
 * native dialogs cannot be styled, cannot be driven by the e2e suite, and in
 * the case of the File System Access picker were the source of BUG-026. This
 * is the one shape every in-app prompt uses.
 *
 * Escape and a backdrop click both cancel, so a prompt is never a trap.
 */
export function Dialog({
  title,
  description,
  onCancel,
  children,
  actions,
}: {
  title: string;
  /** Optional supporting copy, wired to `aria-describedby`. */
  description?: React.ReactNode;
  onCancel: () => void;
  children?: React.ReactNode;
  actions: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-panel p-4 shadow-[0_16px_40px_rgba(0,0,0,.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-[14px] font-semibold text-ink">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-[12.5px] leading-relaxed text-ink/60">
            {description}
          </p>
        )}
        {children}
        <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
