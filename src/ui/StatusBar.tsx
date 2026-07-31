import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { relativeTime } from './format';
import { useSelectionInfo } from './useSelection';

export function StatusBar() {
  const partCount = useDocumentStore((s) => s.customParts.length);
  const saveStatus = useUiStore((s) => s.saveStatus);
  const lastSavedAt = useUiStore((s) => s.lastSavedAt);
  const selection = useSelectionInfo();

  const breadcrumb =
    selection.kind === 'none'
      ? 'Model · Nothing selected'
      : selection.kind === 'multi'
        ? `Model · ${selection.count} parts selected`
        : `Model · ${selection.spec.label}`;

  const save =
    saveStatus === 'saving'
      ? { tone: 'bg-accent', text: 'Saving…' }
      : saveStatus === 'error'
        ? { tone: 'bg-danger', text: 'Not saved' }
        : saveStatus === 'saved'
          ? { tone: 'bg-success', text: `Saved ${lastSavedAt ? relativeTime(lastSavedAt) : ''}` }
          : { tone: 'bg-ink/30', text: 'Ready' };

  return (
    <footer className="flex h-7 flex-none items-center gap-3.5 bg-surface px-4 font-mono text-[11px] text-ink/40">
      <span className="truncate">{breadcrumb}</span>
      <span>·</span>
      <span>
        {partCount} {partCount === 1 ? 'part' : 'parts'}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${save.tone}`} />
        {save.text}
      </span>
    </footer>
  );
}
