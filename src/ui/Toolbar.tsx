import { useRef, useState, useSyncExternalStore } from 'react';
import { DISPLAY_UNITS, type DisplayUnit } from '@/domain/units';
import {
  needsFilename,
  newDocument,
  openFile,
  renameDocument,
  sanitizeFilename,
  saveToFile,
  saveVersion,
  supportsFilePicker,
} from '@/store/actions';
import { DEFAULT_DOC_TITLE, useDocumentStore } from '@/store/documentStore';
import { canRedo, canUndo, historyStore, redo, undo } from '@/store/history';
import { useUiStore, type ViewMode } from '@/store/uiStore';
import { Button } from './primitives/Button';
import { Dialog } from './primitives/Dialog';
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
    (s) => s.customParts.length > 0 || s.versions.length > 0 || s.docTitle !== DEFAULT_DOC_TITLE,
  );

  const [newFilePrompt, setNewFilePrompt] = useState(false);
  const [saveAsPrompt, setSaveAsPrompt] = useState(false);

  const requestNewFile = () => {
    if (!hasDocumentContent) {
      newDocument();
      return;
    }
    setNewFilePrompt(true);
  };

  // Save writes straight away: once a design is bound to a file, or already
  // named in the toolbar title, asking again would be the same decision twice.
  //
  // A name is only ever collected once, and only by whichever of the two
  // mechanisms is actually available. Where the native picker exists it takes
  // the name and the folder together, so the in-app prompt must stay out of the
  // way; where it does not, the in-app prompt is the only chance to avoid
  // writing "Untitled Design.forma.json".
  const requestSave = () => {
    if (needsFilename() && !supportsFilePicker()) {
      setSaveAsPrompt(true);
      return;
    }
    void saveToFile();
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
        <IconButton icon="save_file" label="Save to File" onClick={requestSave} />
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
      {saveAsPrompt && (
        <NameDesignPrompt
          initialName={docTitle}
          onCancel={() => setSaveAsPrompt(false)}
          onSave={async (name) => {
            await saveToFile(name);
            setSaveAsPrompt(false);
          }}
        />
      )}
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
  return (
    <Dialog
      title="Create a new design?"
      description={
        <>
          The current design will be cleared from this browser. Save a{' '}
          <span className="font-mono text-ink/80">.forma.json</span> copy first if you want to
          open it again later.
        </>
      }
      onCancel={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={onDiscard}>Don&apos;t save</Button>
          <Button variant="primary" onClick={onSave}>
            Save and continue
          </Button>
        </>
      }
    />
  );
}

/**
 * Asked once, when a never-named design is saved for the first time. After that
 * the toolbar title is the rename affordance and Save is a single click — a
 * dialog on every save would only ask the user to re-confirm a name they had
 * already typed.
 *
 * A name is collected in-app rather than through the File System Access picker,
 * which is Chromium-only and whose post-dialog write failures caused BUG-026.
 */
function NameDesignPrompt({
  initialName,
  onCancel,
  onSave,
}: {
  initialName: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(initialName);
  const filename = `${sanitizeFilename(draft)}.forma.json`;
  const canSave = draft.trim().length > 0;

  const submit = () => {
    if (canSave) onSave(draft);
  };

  return (
    <Dialog
      title="Name this design"
      description="Saved as a .forma.json download you can open again later. The name becomes the document title, so later saves go straight to this file name."
      onCancel={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          aria-label="File name"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submit();
          }}
          className="h-8 min-w-0 flex-1 rounded-[7px] border border-hairline bg-input px-2.5 text-[12.5px] text-ink"
        />
        <span className="flex-none font-mono text-[11px] text-ink/45">.forma.json</span>
      </div>
      {/* Sanitisation drops characters the filesystem rejects; show the real
          result rather than letting the download quietly differ from the input. */}
      <p className="mt-2 font-mono text-[10.5px] text-ink/35">Saves as {filename}</p>
    </Dialog>
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
