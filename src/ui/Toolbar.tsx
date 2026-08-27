import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DISPLAY_UNITS, type DisplayUnit } from '@/domain/units';
import { newDocument, openFile, renameDocument, saveToFile, saveVersion } from '@/store/actions';
import { useDocumentStore } from '@/store/documentStore';
import { canRedo, canUndo, historyStore, redo, undo } from '@/store/history';
import { useUiStore, type ViewMode } from '@/store/uiStore';
import { Button } from './primitives/Button';
import { IconButton } from './primitives/IconButton';
import { Icon } from './primitives/Icon';
import { InlineRename } from './primitives/InlineRename';

const MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'model', label: 'Model', icon: 'model' },
  { id: 'cutlist', label: 'Cut List', icon: 'cutlist' },
  { id: 'render', label: 'Render', icon: 'render' },
];

export function Toolbar() {
  const partCount = useDocumentStore((s) => s.customParts.length);
  const docTitle = useDocumentStore((s) => s.docTitle);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const measureActive = useUiStore((s) => s.measureActive);
  const toggleMeasure = useUiStore((s) => s.toggleMeasure);
  const historyOpen = useUiStore((s) => s.historyOpen);
  const toggleHistory = useUiStore((s) => s.toggleHistory);
  const leftSidebarOpen = useUiStore((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = useUiStore((s) => s.toggleLeftSidebar);
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useUiStore((s) => s.toggleRightSidebar);
  const hasDocumentContent = useDocumentStore(
    (s) => s.customParts.length > 0 || s.versions.length > 0 || s.docTitle !== 'Untitled Design',
  );

  const [newFilePrompt, setNewFilePrompt] = useState(false);

  const requestNewFile = () => {
    if (!hasDocumentContent) {
      newDocument();
      return;
    }
    setNewFilePrompt(true);
  };

  const finishNewFile = async (saveFirst: boolean) => {
    if (saveFirst) {
      const saved = await saveToFile();
      if (!saved) return;
    }
    setNewFilePrompt(false);
    newDocument();
  };

  // The undo stacks live outside the reactive stores; this subscribes to their
  // revision counter so the buttons enable and disable correctly.
  useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot);

  return (
    <>
      <header className="grid h-14 flex-none grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-hairline bg-surface px-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em] whitespace-nowrap text-ink">
          <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent text-xs font-bold text-canvas">
            F
          </div>
          Forma
        </div>
        <div className="h-[22px] w-px flex-none bg-white/10" />
        <div className="flex min-w-0 flex-col leading-tight">
          <InlineRename
            value={docTitle}
            onRename={renameDocument}
            ariaLabel="Document title"
            className="truncate text-[13px] font-semibold text-ink"
            inputClassName="min-w-0 rounded-[4px] border border-select bg-input px-1 text-[13px] font-semibold text-ink outline-none"
          />
          <span className="font-mono text-[10.5px] text-ink/40">
            {partCount} {partCount === 1 ? 'part' : 'parts'} · <SaveIndicator />
          </span>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="View mode"
        className="flex justify-self-center gap-0.5 rounded-[9px] border border-hairline bg-canvas p-[3px]"
      >
        {MODES.map((m) => {
          const active = viewMode === m.id;
          return (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setViewMode(m.id)}
              className={`flex items-center gap-1.5 rounded-[7px] px-4 py-[7px] text-[12.5px] font-semibold whitespace-nowrap ${
                active ? 'bg-raised text-ink' : 'text-ink/55'
              }`}
            >
              <Icon name={m.icon} size={16} />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 justify-self-end">
        <UnitToggle />
        <div className="h-5 w-px flex-none bg-white/10" />
        <IconButton icon="undo" label="Undo" onClick={undo} disabled={!canUndo()} />
        <IconButton icon="redo" label="Redo" onClick={redo} disabled={!canRedo()} />
        <div className="h-5 w-px flex-none bg-white/10" />
        <IconButton
          icon="sidebar_left"
          label="Toggle left sidebar"
          toggle
          active={leftSidebarOpen}
          disabled={viewMode === 'render'}
          onClick={toggleLeftSidebar}
        />
        <IconButton
          icon="sidebar_right"
          label="Toggle right sidebar"
          toggle
          active={rightSidebarOpen}
          disabled={viewMode === 'render'}
          onClick={toggleRightSidebar}
        />
        <div className="h-5 w-px flex-none bg-white/10" />
        <IconButton
          icon="measure"
          label="Measure"
          toggle
          active={measureActive}
          disabled={viewMode !== 'model'}
          onClick={toggleMeasure}
        />
        <IconButton
          icon="history"
          label="Version history"
          toggle
          active={historyOpen}
          onClick={toggleHistory}
        />
        <div className="h-5 w-px flex-none bg-white/10" />
        <IconButton icon="new_file" label="New File" onClick={requestNewFile} />
        <IconButton icon="save_file" label="Save to File" onClick={() => void saveToFile()} />
        <OpenFileButton />
        <div className="h-5 w-px flex-none bg-white/10" />
        <button
          type="button"
          onClick={saveVersion}
          className="flex h-8 shrink-0 items-center whitespace-nowrap rounded-[7px] bg-accent px-3.5 text-[12.5px] font-bold text-canvas"
        >
          Save Version
        </button>
      </div>
      </header>
      {newFilePrompt && (
        <NewFilePrompt
          onCancel={() => setNewFilePrompt(false)}
          onDiscard={() => void finishNewFile(false)}
          onSave={() => void finishNewFile(true)}
        />
      )}
    </>
  );
}

type NewFilePromptProps = {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

/** In-app stand-in for the old window.confirm — Save actually downloads a copy. */
function NewFilePrompt({ onCancel, onDiscard, onSave }: NewFilePromptProps) {
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
        aria-labelledby="new-file-title"
        aria-describedby="new-file-copy"
        className="w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-panel p-4 shadow-[0_16px_40px_rgba(0,0,0,.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="new-file-title" className="text-[14px] font-semibold text-ink">
          Create a new design?
        </h2>
        <p id="new-file-copy" className="mt-2 text-[12.5px] leading-relaxed text-ink/60">
          The current design will be cleared from this browser. Save a{' '}
          <span className="font-mono text-ink/80">.forma.json</span> copy first if you want to
          open it again later.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={onDiscard}>Don&apos;t save</Button>
          <Button variant="primary" onClick={onSave}>
            Save and continue
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A hidden file input driven by an icon button, so it matches the other toolbar controls. */
function OpenFileButton() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <IconButton icon="open_file" label="Open File" onClick={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        accept=".json,.forma.json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void openFile(file);
        }}
      />
    </>
  );
}

/** Display-only preference — a Cut List row is still generated in mm underneath. */
function UnitToggle() {
  const displayUnit = useUiStore((s) => s.displayUnit);
  const setDisplayUnit = useUiStore((s) => s.setDisplayUnit);

  return (
    <div
      role="tablist"
      aria-label="Display unit"
      className="flex gap-0.5 rounded-[7px] border border-hairline bg-canvas p-[3px]"
    >
      {DISPLAY_UNITS.map((unit: DisplayUnit) => {
        const active = displayUnit === unit;
        return (
          <button
            key={unit}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => setDisplayUnit(unit)}
            className={`h-[26px] rounded-[5px] px-2.5 text-[11.5px] font-semibold uppercase ${
              active ? 'bg-raised text-ink' : 'text-ink/55'
            }`}
          >
            {unit}
          </button>
        );
      })}
    </div>
  );
}

/** Reports the real autosave state rather than a hardcoded "Autosaved". */
function SaveIndicator() {
  const saveStatus = useUiStore((s) => s.saveStatus);
  if (saveStatus === 'saving') return <>Saving…</>;
  if (saveStatus === 'error') return <span className="text-danger">Not saved</span>;
  if (saveStatus === 'saved') return <>Autosaved</>;
  return <>Ready</>;
}
