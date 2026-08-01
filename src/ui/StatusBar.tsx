import { useEffect, useRef, useState } from 'react';
import { convertedValue, convertRange, toMm } from '@/domain/units';
import { coerceGridSize, GRID_SIZE_LIMITS_M } from '@/domain/workspace';
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
      <div className="ml-auto flex items-center gap-3">
        <GridSizeField />
        <span className="h-4 w-px bg-white/10" />
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${save.tone}`} />
          {save.text}
        </span>
      </div>
    </footer>
  );
}

function GridSizeField() {
  const gridSizeM = useUiStore((state) => state.gridSizeM);
  const setGridSize = useUiStore((state) => state.setGridSize);
  const unit = useUiStore((state) => state.displayUnit);
  const value = convertedValue(gridSizeM * 1000, unit);
  const range = convertRange({
    min: GRID_SIZE_LIMITS_M.min * 1000,
    max: GRID_SIZE_LIMITS_M.max * 1000,
    step: GRID_SIZE_LIMITS_M.step * 1000,
  }, unit);
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelBlur = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (cancelBlur.current) {
      cancelBlur.current = false;
      setDraft(String(value));
      return;
    }
    const numeric = Number(draft);
    if (!Number.isFinite(numeric)) {
      setDraft(String(value));
      return;
    }
    const next = coerceGridSize(toMm(numeric, unit) / 1000);
    setGridSize(next);
    setDraft(String(convertedValue(next * 1000, unit)));
  };

  const unitName = unit === 'mm' ? 'millimetres' : 'centimetres';
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap text-ink/45">
      Grid
      <input
        type="number"
        aria-label={`Grid size in ${unitName}`}
        title="Viewport grid extent"
        value={draft}
        min={range.min}
        max={range.max}
        step={range.step}
        onFocus={(event) => {
          setEditing(true);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            cancelBlur.current = true;
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        className="h-5 w-[62px] rounded border border-white/10 bg-input px-1.5 text-right font-mono text-[10.5px] text-ink/70"
      />
      <span className="uppercase">{unit}</span>
    </label>
  );
}
