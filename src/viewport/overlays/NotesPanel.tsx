import { setNotes } from '@/store/actions';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { Icon } from '@/ui/primitives/Icon';

/**
 * Design notes as a sticky note pinned to the viewport's top-right, under the
 * view buttons. Lives inside the viewport container so it anchors to the
 * canvas whether or not the right sidebar is open, and stays put while the
 * selection changes. Picking listens on the canvas, so clicks here never
 * clear the selection.
 */
export function NotesPanel() {
  const open = useUiStore((s) => s.notesOpen);
  const setNotesOpen = useUiStore((s) => s.setNotesOpen);
  const notes = useDocumentStore((s) => s.notes);
  if (!open) return null;

  return (
    <section
      aria-label="Design notes"
      className="absolute top-14 right-3 z-10 flex max-h-[calc(100%-7rem)] w-72 flex-col rounded-lg border border-accent/40 bg-[#2b2418] shadow-[0_12px_32px_rgba(0,0,0,.35)]"
    >
      <div className="flex flex-none items-center justify-between border-b border-accent/25 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
          <Icon name="notes" size={14} />
          Design notes
        </h2>
        <button
          type="button"
          aria-label="Close design notes"
          onClick={() => setNotesOpen(false)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink/60 hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <textarea
        autoFocus
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={(e) => {
          // The shortcut handler already ignores textareas; this also keeps
          // the keys away from viewport listeners (Shift snapping, etc.).
          e.stopPropagation();
          if (e.key === 'Escape') setNotesOpen(false);
        }}
        rows={10}
        placeholder="Measurements to double-check, hardware decisions, client requests…"
        aria-label="Design notes"
        className="min-h-24 flex-1 resize-none bg-transparent px-3 py-2.5 text-[12px] leading-relaxed text-ink outline-none placeholder:text-ink/30"
      />
      <p className="flex-none border-t border-accent/25 px-3 py-1.5 text-[10.5px] text-ink/40">
        Saved with the design. Esc closes.
      </p>
    </section>
  );
}
