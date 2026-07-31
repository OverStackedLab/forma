import { useEffect, useState } from 'react';
import { CUSTOM_PANEL_LIMITS, FINISHES } from '@/domain/catalog';
import { groupMatching } from '@/domain/parts';
import { quaternionToEulerDegrees } from '@/domain/rotation';
import { convertRange, fromMm, toMm, type DisplayUnit } from '@/domain/units';
import {
  applyFinish,
  deleteParts,
  duplicateSelected,
  groupSelected,
  renameGroup,
  renamePart,
  resetOverrides,
  resetTransforms,
  setCustomPartDim,
  setRotationAxis,
  snapToFloor,
  ungroupSelected,
} from '@/store/actions';
import { IDENTITY_TRANSFORM, useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { Button } from './primitives/Button';
import { DimChip } from './primitives/DimChip';
import { Icon } from './primitives/Icon';
import { SliderField } from './primitives/SliderField';
import { UnderlineTabs } from './primitives/UnderlineTabs';
import { scopeLabel, useSelectionInfo, type SelectionInfo } from './useSelection';

const TABS = [
  { id: 'properties', label: 'Properties' },
  { id: 'materials', label: 'Materials' },
] as const;

export function RightSidebar() {
  const rightTab = useUiStore((s) => s.rightTab);
  const setRightTab = useUiStore((s) => s.setRightTab);

  return (
    <aside className="flex w-[300px] flex-none flex-col border-l border-hairline bg-panel">
      <UnderlineTabs tabs={TABS} value={rightTab} onChange={setRightTab} ariaLabel="Right panel" />
      <div className="flex-1 overflow-y-auto p-4">
        {rightTab === 'properties' ? <PropertiesTab /> : <MaterialsTab />}
      </div>
    </aside>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold tracking-[.04em] text-ink/45 uppercase">
      {children}
    </h3>
  );
}

const DIM_FIELDS: { key: 'w' | 'h' | 'd'; label: string }[] = [
  { key: 'w', label: 'Width' },
  { key: 'h', label: 'Height' },
  { key: 'd', label: 'Depth' },
];

const UNIT_NAMES: Record<DisplayUnit, string> = { mm: 'millimetres', cm: 'centimetres' };

const ROTATION_AXES: { axis: 'x' | 'y' | 'z'; label: string }[] = [
  { axis: 'x', label: 'X Angle' },
  { axis: 'y', label: 'Y Angle' },
  { axis: 'z', label: 'Z Angle' },
];
const ROTATION_LIMITS = { min: -180, max: 180, step: 1 } as const;

/**
 * Numeric counterpart to the rotate gizmo — set an exact angle per axis
 * rather than only free-hand dragging. Reads the part's current orientation
 * back out of its stored quaternion so the fields stay in sync with gizmo
 * drags too.
 */
function RotationFields({ partId }: { partId: string }) {
  const transform = useDocumentStore((s) => s.transforms[partId]) ?? IDENTITY_TRANSFORM;
  const euler = quaternionToEulerDegrees(transform.quaternion);

  return (
    <>
      <SectionHeader>Rotation</SectionHeader>
      {ROTATION_AXES.map(({ axis, label }) => (
        <SliderField
          key={axis}
          label={label}
          value={Math.round(euler[axis] * 10) / 10}
          min={ROTATION_LIMITS.min}
          max={ROTATION_LIMITS.max}
          step={ROTATION_LIMITS.step}
          unit="°"
          unitName="degrees"
          onChange={(v) => setRotationAxis(partId, axis, v)}
        />
      ))}
      <hr className="my-4 border-hairline" />
    </>
  );
}

/** A persistent, always-editable name field — commits on blur or Enter. */
function NameField({
  value,
  onRename,
  ariaLabel,
}: {
  value: string;
  onRename: (value: string) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onRename(trimmed);
    else setDraft(value);
  };

  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className="mb-4 h-8 w-full rounded-[7px] border border-hairline bg-input px-2.5 text-[12.5px] text-ink"
    />
  );
}

/**
 * One dimensions block whose content follows the scope chip above it. Every
 * part is a library panel, so a single selection always gets live sliders —
 * there's no separate "derived, read-only" kind of part anymore.
 */
function PropertiesTab() {
  const selection = useSelectionInfo();
  const clearSelection = useUiStore((s) => s.clearSelection);
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);
  const groups = useDocumentStore((s) => s.groups);
  const matchedGroup = groupMatching(groups, selectedPartIds);
  const unit = useUiStore((s) => s.displayUnit);

  return (
    <>
      <ScopeChip selection={selection} onClear={clearSelection} />

      {selection.kind === 'single' && (
        <NameField
          value={selection.spec.label}
          onRename={(v) => renamePart(selection.spec.id, v)}
          ariaLabel="Part name"
        />
      )}
      {matchedGroup && (
        <NameField
          value={matchedGroup.label}
          onRename={(v) => renameGroup(matchedGroup.id, v)}
          ariaLabel="Group name"
        />
      )}

      {selection.kind === 'single' && (
        <>
          <SectionHeader>Dimensions</SectionHeader>
          {DIM_FIELDS.map((field) => {
            const range = convertRange(CUSTOM_PANEL_LIMITS[field.key], unit);
            return (
              <SliderField
                key={field.key}
                label={field.label}
                value={fromMm(selection.size[field.key], unit)}
                min={range.min}
                max={range.max}
                step={range.step}
                unit={unit}
                unitName={UNIT_NAMES[unit]}
                onChange={(v) => setCustomPartDim(selection.spec.id, field.key, toMm(v, unit))}
              />
            );
          })}
          <hr className="my-4 border-hairline" />
          <RotationFields partId={selection.spec.id} />
        </>
      )}

      {selection.kind === 'multi' && selection.size && (
        <>
          <SectionHeader>Dimensions</SectionHeader>
          <div className="flex gap-2">
            <DimChip axis="W" value={selection.size.w} unit={unit} />
            <DimChip axis="H" value={selection.size.h} unit={unit} />
            <DimChip axis="D" value={selection.size.d} unit={unit} />
          </div>
          <hr className="my-4 border-hairline" />
        </>
      )}

      <FinishPicker />

      {selection.kind === 'none' ? (
        <>
          <hr className="my-4 border-hairline" />
          <p className="text-[11px] leading-relaxed text-ink/35">
            Click a part in the viewport or the Assembly tree to inspect it, or insert one from
            the Library.
          </p>
        </>
      ) : (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button onClick={clearSelection}>Clear</Button>
          <Button onClick={() => resetTransforms(selectedPartIds)}>Reset transform</Button>
          <Button onClick={() => snapToFloor(selectedPartIds)}>Snap to Floor</Button>
          {selection.kind === 'single' && <Button onClick={duplicateSelected}>Duplicate</Button>}
          {selection.kind === 'multi' && !matchedGroup && (
            <Button onClick={groupSelected}>Group</Button>
          )}
          {matchedGroup && <Button onClick={ungroupSelected}>Ungroup</Button>}
          <Button variant="danger" onClick={() => deleteParts(selectedPartIds)}>
            Delete
          </Button>
        </div>
      )}
    </>
  );
}

/** The "Editing: X" scope chip shared in spirit with the Materials tab. */
function ScopeChip({
  selection,
  onClear,
}: {
  selection: SelectionInfo;
  onClear: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-[7px] border border-hairline bg-surface px-2.5 py-2">
      <span className="text-[11.5px] text-ink/75">Editing: {scopeLabel(selection)}</span>
      {selection.kind !== 'none' && (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="flex h-4 w-4 items-center justify-center text-ink/50 hover:text-ink"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

function MaterialsTab() {
  const clearSelection = useUiStore((s) => s.clearSelection);
  const selection = useSelectionInfo();

  return (
    <>
      <ScopeChip selection={selection} onClear={clearSelection} />
      <FinishPicker />
    </>
  );
}

/**
 * Finish swatches, bound to the current selection scope (an override on the
 * selected part(s), or the document default with nothing selected — which
 * only sets the finish newly inserted panels start with). Shared by the
 * Materials tab and the Properties tab, so a finish can be changed without
 * switching tabs.
 */
function FinishPicker() {
  const defaultFinishId = useDocumentStore((s) => s.defaultFinishId);
  const overrides = useDocumentStore((s) => s.overrides);
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);

  const first = selectedPartIds[0];
  const override = first ? overrides[first] : undefined;
  const current = override?.body ?? defaultFinishId;
  const hasOverride = selectedPartIds.some((id) => overrides[id]?.body);

  return (
    <>
      <SectionHeader>Finish</SectionHeader>
      <div className="grid grid-cols-5 gap-1.5">
        {FINISHES.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={current === f.id}
            aria-label={f.label}
            onClick={() => applyFinish(f.id)}
            className="flex flex-col gap-1"
          >
            <span
              className={`block h-10 rounded-md border-2 ${
                current === f.id ? 'border-select' : 'border-white/12'
              }`}
              style={{ background: f.color }}
            />
            <span className="text-center text-[9.5px] leading-tight text-ink/55">{f.label}</span>
          </button>
        ))}
      </div>
      {hasOverride && (
        <button
          type="button"
          className="mt-2 text-[11px] text-select"
          onClick={() => resetOverrides(selectedPartIds)}
        >
          Reset to default
        </button>
      )}
    </>
  );
}
