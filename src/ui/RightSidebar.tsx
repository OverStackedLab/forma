import { useEffect, useState } from 'react';
import {
  CABINET_DIM_LIMITS,
  CUSTOM_PANEL_LIMITS,
  FINISHES,
  HARDWARE_FINISHES,
  findFinish,
  finishForAppearance,
  isRoundHardwareShape,
  resolveAppearance,
} from '@/domain/catalog';
import { oakGrainDataUrl } from '@/domain/oakGrain';
import { groupMatching, selectionUnits } from '@/domain/parts';
import { quaternionToEulerDegrees } from '@/domain/rotation';
import type { CabinetConfig, Group } from '@/domain/types';
import { convertedValue, convertRange, fromMm, toMm, type DisplayUnit } from '@/domain/units';
import { shelfPositions } from '@/domain/cabinets';
import {
  addCabinetShelf,
  applyFinish,
  deleteParts,
  distributeCabinetShelves,
  duplicateSelected,
  groupSelected,
  removeCabinetShelf,
  renameGroup,
  renamePart,
  resetOverrides,
  resetTransforms,
  setCabinetDim,
  setCabinetShelfPositions,
  setCustomPartDim,
  setHardwareDiameter,
  setGroupPositionAxis,
  setGroupSizeAxis,
  setPartGrainAxis,
  setPositionAxis,
  setRotationAxis,
  snapToFloor,
  snapSelectedTogether,
  togglePartEdgeBand,
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
  { id: 'materials', label: 'Color' },
] as const;

export function RightSidebar() {
  const rightTab = useUiStore((s) => s.rightTab);
  const setRightTab = useUiStore((s) => s.setRightTab);

  return (
    <aside className="flex w-[300px] flex-none flex-col border-l border-hairline bg-panel">
      <UnderlineTabs tabs={TABS} value={rightTab} onChange={setRightTab} ariaLabel="Right panel" />
      <div className="flex-1 overflow-y-auto p-4">
        {rightTab === 'properties' ? <PropertiesTab /> : <FinishTab />}
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

const CABINET_DIM_FIELDS = [
  { key: 'width', label: 'Cabinet Width' },
  { key: 'height', label: 'Cabinet Height' },
  { key: 'depth', label: 'Cabinet Depth' },
] as const;

const UNIT_NAMES: Record<DisplayUnit, string> = { mm: 'millimetres', cm: 'centimetres' };

const ROTATION_AXES: { axis: 'x' | 'y' | 'z'; label: string }[] = [
  { axis: 'x', label: 'X Angle' },
  { axis: 'y', label: 'Y Angle' },
  { axis: 'z', label: 'Z Angle' },
];
const ROTATION_LIMITS = { min: -180, max: 180, step: 1 } as const;
const POSITION_LIMITS = { min: -10_000, max: 10_000, step: 1 } as const;
const GROUP_SIZE_LIMITS = { min: 1, max: 20_000, step: 1 } as const;
const GROUP_SIZE_AXES = [
  { axis: 'x', key: 'w', label: 'Group Width' },
  { axis: 'y', key: 'h', label: 'Group Height' },
  { axis: 'z', key: 'd', label: 'Group Depth' },
] as const;
const POSITION_AXES = [
  { axis: 'x', label: 'X Position', index: 0 },
  { axis: 'y', label: 'Y Position', index: 1 },
  { axis: 'z', label: 'Z Position', index: 2 },
] as const;
const EDGE_OPTIONS = [
  { id: 'w-min', label: 'Left' },
  { id: 'w-max', label: 'Right' },
  { id: 'h-min', label: 'Bottom' },
  { id: 'h-max', label: 'Top' },
  { id: 'd-min', label: 'Back' },
  { id: 'd-max', label: 'Front' },
] as const;

function PositionFields({ partId }: { partId: string }) {
  const transform = useDocumentStore((s) => s.transforms[partId]) ?? IDENTITY_TRANSFORM;
  const unit = useUiStore((s) => s.displayUnit);
  const range = convertRange(POSITION_LIMITS, unit);
  return (
    <>
      <SectionHeader>Position</SectionHeader>
      {POSITION_AXES.map(({ axis, label, index }) => (
        <SliderField
          key={axis}
          label={label}
          value={convertedValue(transform.position[index] * 1000, unit)}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={unit}
          unitName={UNIT_NAMES[unit]}
          onChange={(v) => setPositionAxis(partId, axis, toMm(v, unit))}
        />
      ))}
      <hr className="my-4 border-hairline" />
    </>
  );
}

function GroupPositionFields({ group }: { group: Group }) {
  const transforms = useDocumentStore((state) => state.transforms);
  const unit = useUiStore((state) => state.displayUnit);
  const range = convertRange(POSITION_LIMITS, unit);
  const members = group.partIds.map((id) => transforms[id] ?? IDENTITY_TRANSFORM);
  const pivot = POSITION_AXES.map(({ index }) =>
    members.reduce((sum, transform) => sum + transform.position[index], 0) /
    Math.max(members.length, 1),
  );

  return (
    <>
      <SectionHeader>Group Position</SectionHeader>
      {POSITION_AXES.map(({ axis, label, index }) => (
        <SliderField
          key={axis}
          label={`Group ${label}`}
          value={convertedValue(pivot[index]! * 1000, unit)}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={unit}
          unitName={UNIT_NAMES[unit]}
          onChange={(value) => setGroupPositionAxis(group.id, axis, toMm(value, unit))}
        />
      ))}
      <p className="mb-4 text-[10.5px] leading-relaxed text-ink/35">
        Position uses the shared group pivot; every member moves by the same amount.
      </p>
      <hr className="my-4 border-hairline" />
    </>
  );
}

function GroupSizeFields({
  group,
  size,
}: {
  group: Group;
  size: { w: number; h: number; d: number };
}) {
  const unit = useUiStore((state) => state.displayUnit);
  const range = convertRange(GROUP_SIZE_LIMITS, unit);

  return (
    <>
      <SectionHeader>Group Dimensions</SectionHeader>
      {GROUP_SIZE_AXES.map(({ axis, key, label }) => (
        <SliderField
          key={axis}
          label={label}
          value={fromMm(size[key], unit)}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={unit}
          unitName={UNIT_NAMES[unit]}
          onChange={(value) => setGroupSizeAxis(group.id, axis, toMm(value, unit))}
        />
      ))}
      <p className="mb-4 text-[10.5px] leading-relaxed text-ink/35">
        Resizing uses the shared group pivot; every member and the spacing between members scale together.
      </p>
      <hr className="my-4 border-hairline" />
    </>
  );
}

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

function ManufacturingFields({ partId }: { partId: string }) {
  const part = useDocumentStore((state) => state.customParts.find((candidate) => candidate.id === partId));
  if (!part) return null;
  if (part.category === 'hardware') {
    return (
      <>
        <SectionHeader>Manufacturing</SectionHeader>
        <p className="text-[11px] leading-relaxed text-ink/45">
          Purchased hardware. It is listed separately from sheet goods and does not use grain or edge banding.
        </p>
        <hr className="my-4 border-hairline" />
      </>
    );
  }

  const faceAxes = DIM_FIELDS.filter(({ key }) => key !== part.thicknessAxis);
  const edgeOptions = EDGE_OPTIONS.filter(({ id }) => id[0] !== part.thicknessAxis);
  return (
    <>
      <SectionHeader>Manufacturing</SectionHeader>
      <p className="mb-2 text-[10.5px] text-ink/40">Grain direction</p>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {faceAxes.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={part.grainAxis === key}
            onClick={() => setPartGrainAxis(part.id, key)}
            className={`rounded-md border px-2 py-1.5 text-[10.5px] ${
              part.grainAxis === key
                ? 'border-select bg-select/10 text-ink'
                : 'border-hairline bg-surface text-ink/55'
            }`}
          >
            Along {label.toLowerCase()}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[10.5px] text-ink/40">Exposed edges</p>
      <div className="grid grid-cols-2 gap-1.5">
        {edgeOptions.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={part.edgeBanding.includes(id)}
            onClick={() => togglePartEdgeBand(part.id, id)}
            className={`rounded-md border px-2 py-1.5 text-[10.5px] ${
              part.edgeBanding.includes(id)
                ? 'border-select bg-select/10 text-ink'
                : 'border-hairline bg-surface text-ink/55'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <hr className="my-4 border-hairline" />
    </>
  );
}

/** A persistent, always-editable name field — commits on blur or Enter. */
/**
 * Compact number input that keeps its own draft while focused. Rows are keyed
 * by their committed value, so a successful commit remounts with fresh state.
 */
function DraftNumberInput({
  ariaLabel,
  value,
  onCommit,
  widthClass = 'w-16',
}: {
  ariaLabel: string;
  value: number;
  onCommit: (value: number) => void;
  widthClass?: string;
}) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n)) onCommit(n);
    else setDraft(String(value));
  };

  return (
    <input
      type="number"
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={`box-border h-7 ${widthClass} rounded-[5px] border border-white/10 bg-input px-2 text-right font-mono text-[11.5px] leading-none text-ink`}
    />
  );
}

/**
 * Parametric shelf editor for a generated cabinet. Positions are measured
 * from the cabinet bottom to each shelf's centreline; edits rebuild the
 * carcass through the same path as the dimension sliders.
 */
function ShelfFields({
  groupId,
  cabinet,
  unit,
}: {
  groupId: string;
  cabinet: CabinetConfig;
  unit: DisplayUnit;
}) {
  const positions = shelfPositions(cabinet);
  const [addDraft, setAddDraft] = useState('');
  const [countDraft, setCountDraft] = useState('3');
  const [spacingDraft, setSpacingDraft] = useState('');

  const parseToMm = (draft: string): number | null => {
    const n = Number(draft);
    return draft.trim() !== '' && Number.isFinite(n) ? toMm(n, unit) : null;
  };

  const inputClass =
    'box-border h-7 rounded-[5px] border border-white/10 bg-input px-2 text-right font-mono text-[11.5px] leading-none text-ink';
  const unitClass = 'w-6 flex-none font-mono text-[10.5px] leading-none text-ink/35';
  const rowClass = 'flex h-7 items-center gap-2';

  const commitAdd = () => {
    const mm = parseToMm(addDraft);
    if (mm === null) return;
    addCabinetShelf(groupId, mm);
    setAddDraft('');
  };

  const commitDistribute = () => {
    const count = Math.floor(Number(countDraft));
    const spacingMm = parseToMm(spacingDraft);
    if (!Number.isFinite(count) || count < 1 || spacingMm === null) return;
    distributeCabinetShelves(groupId, count, spacingMm);
  };

  return (
    <>
      <SectionHeader>Shelves</SectionHeader>

      {positions.length > 0 && (
        <div className="mb-3 space-y-3">
          {positions.map((positionMm, index) => (
            <div key={`${index}-${positionMm}`}>
              <p className="mb-1.5 text-[10.5px] leading-none text-ink/40">
                Shelf {index + 1}
              </p>
              <div className={rowClass}>
                <DraftNumberInput
                  ariaLabel={`Shelf ${index + 1} position in ${UNIT_NAMES[unit]}`}
                  value={convertedValue(positionMm, unit)}
                  widthClass="w-16"
                  onCommit={(value) =>
                    setCabinetShelfPositions(
                      groupId,
                      positions.map((p, i) => (i === index ? toMm(value, unit) : p)),
                    )
                  }
                />
                <span className={unitClass}>{unit}</span>
                <button
                  type="button"
                  aria-label={`Remove shelf ${index + 1}`}
                  onClick={() => removeCabinetShelf(groupId, index)}
                  className="ml-auto flex h-7 w-7 flex-none items-center justify-center rounded text-ink/45 hover:bg-white/5 hover:text-danger"
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3">
        <p className="mb-1.5 text-[10.5px] leading-none text-ink/40">Add shelf</p>
        <div className={rowClass}>
          <input
            type="number"
            aria-label={`New shelf position in ${UNIT_NAMES[unit]}`}
            placeholder={unit === 'mm' ? '300' : '30'}
            value={addDraft}
            onChange={(e) => setAddDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
            }}
            className={`${inputClass} w-16 flex-none`}
          />
          <span className={unitClass}>{unit}</span>
          <Button className="ml-auto shrink-0" onClick={commitAdd}>
            Add Shelf
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-[10.5px] leading-none text-ink/40">Space evenly</p>
        <div className={rowClass}>
          <input
            type="number"
            aria-label="Shelf count"
            min={1}
            value={countDraft}
            onChange={(e) => setCountDraft(e.target.value)}
            className={`${inputClass} w-10 flex-none`}
          />
          <span className="flex-none text-[11px] leading-none text-ink/45">every</span>
          <input
            type="number"
            aria-label={`Shelf spacing in ${UNIT_NAMES[unit]}`}
            placeholder={unit === 'mm' ? '200' : '20'}
            value={spacingDraft}
            onChange={(e) => setSpacingDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDistribute();
            }}
            className={`${inputClass} w-14 flex-none`}
          />
          <span className={unitClass}>{unit}</span>
          <Button className="ml-auto shrink-0" onClick={commitDistribute}>
            Apply
          </Button>
        </div>
      </div>

      <p className="mb-4 text-[10.5px] leading-relaxed text-ink/35">
        Positions run from the cabinet bottom to each shelf's centreline. Spaced shelves start one
        spacing above the cabinet floor; any that don't fit are dropped.
      </p>
    </>
  );
}

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
 * One dimensions block whose content follows the scope chip above it. Loose
 * parts get direct controls; generated cabinets get assembly-level controls.
 */
function PropertiesTab() {
  const selection = useSelectionInfo();
  const clearSelection = useUiStore((s) => s.clearSelection);
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);
  const groups = useDocumentStore((s) => s.groups);
  const matchedGroup = groupMatching(groups, selectedPartIds);
  const units = selectionUnits(groups, selectedPartIds);
  const canSnapTogether = units.length === 2;
  const containsSavedGroup = units.some((selectionUnit) => selectionUnit.kind === 'group');
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
        <>
          <NameField
            value={matchedGroup.label}
            onRename={(v) => renameGroup(matchedGroup.id, v)}
            ariaLabel="Group name"
          />
          <div className="mb-4 rounded-[7px] border border-hairline bg-surface px-2.5 py-2 text-[11px] text-ink/55">
            {matchedGroup.cabinet ? 'Configurable cabinet' : 'Rigid group'} ·{' '}
            {matchedGroup.partIds.length} {matchedGroup.partIds.length === 1 ? 'piece' : 'pieces'}
          </div>
        </>
      )}

      {selection.kind === 'single' && (
        <>
          <SectionHeader>Dimensions</SectionHeader>
          {selection.spec.category === 'hardware' ? (
            isRoundHardwareShape(selection.spec.shape) ? (
              <>
                <SliderField
                  label="Diameter"
                  value={fromMm(Math.max(selection.size.w, selection.size.h), unit)}
                  min={convertRange(CUSTOM_PANEL_LIMITS.w, unit).min}
                  max={convertRange(CUSTOM_PANEL_LIMITS.w, unit).max}
                  step={convertRange(CUSTOM_PANEL_LIMITS.w, unit).step}
                  unit={unit}
                  unitName={UNIT_NAMES[unit]}
                  onChange={(value) => setHardwareDiameter(selection.spec.id, toMm(value, unit))}
                />
                <SliderField
                  label="Projection"
                  value={fromMm(selection.size.d, unit)}
                  min={convertRange(CUSTOM_PANEL_LIMITS.d, unit).min}
                  max={convertRange(CUSTOM_PANEL_LIMITS.d, unit).max}
                  step={convertRange(CUSTOM_PANEL_LIMITS.d, unit).step}
                  unit={unit}
                  unitName={UNIT_NAMES[unit]}
                  onChange={(value) => setCustomPartDim(selection.spec.id, 'd', toMm(value, unit))}
                />
              </>
            ) : (
              <>
                <SliderField
                  label="Length"
                  value={fromMm(selection.size.w, unit)}
                  min={convertRange(CUSTOM_PANEL_LIMITS.w, unit).min}
                  max={convertRange(CUSTOM_PANEL_LIMITS.w, unit).max}
                  step={convertRange(CUSTOM_PANEL_LIMITS.w, unit).step}
                  unit={unit}
                  unitName={UNIT_NAMES[unit]}
                  onChange={(value) => setCustomPartDim(selection.spec.id, 'w', toMm(value, unit))}
                />
                <SliderField
                  label="Width"
                  value={fromMm(selection.size.h, unit)}
                  min={convertRange(CUSTOM_PANEL_LIMITS.h, unit).min}
                  max={convertRange(CUSTOM_PANEL_LIMITS.h, unit).max}
                  step={convertRange(CUSTOM_PANEL_LIMITS.h, unit).step}
                  unit={unit}
                  unitName={UNIT_NAMES[unit]}
                  onChange={(value) => setCustomPartDim(selection.spec.id, 'h', toMm(value, unit))}
                />
                <SliderField
                  label="Projection"
                  value={fromMm(selection.size.d, unit)}
                  min={convertRange(CUSTOM_PANEL_LIMITS.d, unit).min}
                  max={convertRange(CUSTOM_PANEL_LIMITS.d, unit).max}
                  step={convertRange(CUSTOM_PANEL_LIMITS.d, unit).step}
                  unit={unit}
                  unitName={UNIT_NAMES[unit]}
                  onChange={(value) => setCustomPartDim(selection.spec.id, 'd', toMm(value, unit))}
                />
              </>
            )
          ) : DIM_FIELDS.map((field) => {
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
          <PositionFields partId={selection.spec.id} />
          <RotationFields partId={selection.spec.id} />
          <ManufacturingFields partId={selection.spec.id} />
        </>
      )}

      {selection.kind === 'multi' && matchedGroup?.cabinet && (
        <>
          <SectionHeader>Cabinet Dimensions</SectionHeader>
          {CABINET_DIM_FIELDS.map(({ key, label }) => {
            const range = convertRange(CABINET_DIM_LIMITS[key], unit);
            return (
              <SliderField
                key={key}
                label={label}
                value={fromMm(matchedGroup.cabinet![key], unit)}
                min={range.min}
                max={range.max}
                step={range.step}
                unit={unit}
                unitName={UNIT_NAMES[unit]}
                onChange={(value) => setCabinetDim(matchedGroup.id, key, toMm(value, unit))}
              />
            );
          })}
          <p className="mb-4 text-[10.5px] leading-relaxed text-ink/35">
            Resizing rebuilds the carcass and keeps its panels at 18 mm with an 8 mm back.
          </p>
          <ShelfFields groupId={matchedGroup.id} cabinet={matchedGroup.cabinet} unit={unit} />
          <hr className="my-4 border-hairline" />
        </>
      )}

      {selection.kind === 'multi' && matchedGroup && !matchedGroup.cabinet && selection.size && (
        <GroupSizeFields group={matchedGroup} size={selection.size} />
      )}

      {selection.kind === 'multi' && !matchedGroup && selection.size && (
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

      {matchedGroup && <GroupPositionFields group={matchedGroup} />}

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
        <>
          {canSnapTogether && (
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink/40">
              Snap Together keeps the first selected item fixed and moves the second to its nearest face.
            </p>
          )}
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button onClick={clearSelection}>Clear</Button>
            <Button onClick={() => resetTransforms(selectedPartIds)}>Reset transform</Button>
            <Button onClick={() => snapToFloor(selectedPartIds)}>Snap to Floor</Button>
            {canSnapTogether && <Button onClick={snapSelectedTogether}>Snap Together</Button>}
            {(selection.kind === 'single' || matchedGroup) && (
              <Button onClick={duplicateSelected}>Duplicate</Button>
            )}
            {selection.kind === 'multi' && !matchedGroup && !containsSavedGroup && (
              <Button onClick={groupSelected}>Group</Button>
            )}
            {matchedGroup && <Button onClick={ungroupSelected}>Ungroup</Button>}
            <Button variant="danger" onClick={() => deleteParts(selectedPartIds)}>
              Delete
            </Button>
          </div>
        </>
      )}
    </>
  );
}

/** The "Editing: X" scope chip shared in spirit with the Finish tab. */
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

function FinishTab() {
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
 * One user-facing finish picker. The existing material/color pair remains an
 * internal storage detail so older saved designs still load, but users only
 * need to make one appearance choice.
 */
function FinishPicker() {
  const defaultMaterialId = useDocumentStore((s) => s.defaultMaterialId);
  const defaultColorId = useDocumentStore((s) => s.defaultColorId);
  const overrides = useDocumentStore((s) => s.overrides);
  const customParts = useDocumentStore((s) => s.customParts);
  const defaultHardwareFinishId = useDocumentStore((s) => s.defaultHardwareFinishId);
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);

  const selectedKinds = new Set(
    selectedPartIds
      .map((id) => customParts.find((part) => part.id === id)?.category)
      .filter(Boolean)
      .map((category) => category === 'hardware' ? 'hardware' : 'body'),
  );
  if (selectedKinds.size > 1) {
    return (
      <div className="rounded-[7px] border border-hairline bg-surface px-3 py-3 text-[11px] leading-relaxed text-ink/50">
        Select only panels or only hardware to change their color.
      </div>
    );
  }

  const editingHardware = selectedKinds.has('hardware');
  const choices = editingHardware ? HARDWARE_FINISHES : FINISHES;
  const hardwareDefault = findFinish(defaultHardwareFinishId);

  const effectiveFinishIds = selectedPartIds.length
    ? selectedPartIds.map((partId) => {
        const override = overrides[partId];
        const part = customParts.find((candidate) => candidate.id === partId);
        const baseMaterial = part?.category === 'hardware'
          ? hardwareDefault.materialId
          : defaultMaterialId;
        const baseColor = part?.category === 'hardware' ? hardwareDefault.colorId : defaultColorId;
        return finishForAppearance(
          override?.material ?? baseMaterial,
          override?.color ?? baseColor,
        ).id;
      })
    : [finishForAppearance(defaultMaterialId, defaultColorId).id];
  const currentFinishId = effectiveFinishIds.every((id) => id === effectiveFinishIds[0])
    ? effectiveFinishIds[0]
    : null;
  const isMixed = currentFinishId === null;
  const hasOverride = selectedPartIds.some((id) => overrides[id]?.material || overrides[id]?.color);

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <SectionHeader>{editingHardware ? 'Hardware' : 'Color'}</SectionHeader>
        {isMixed && (
          <span className="mb-2 text-[10.5px] font-medium text-select">Mixed colors</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {choices.map((finish) => {
          const active = currentFinishId === finish.id;
          const appearance = resolveAppearance(finish.materialId, finish.colorId);
          return (
          <button
            key={finish.id}
            type="button"
            aria-pressed={active}
            aria-label={finish.label}
            onClick={() => applyFinish(finish.id)}
            className={`flex min-h-12 items-center gap-2 rounded-[7px] border px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-select ${
              active
                ? 'border-select bg-select/10 text-ink'
                : 'border-hairline bg-surface text-ink/65 hover:border-white/20 hover:text-ink'
            }`}
          >
            <span
              aria-hidden="true"
              className="block h-7 w-7 flex-none rounded-md border border-white/15 bg-cover bg-center shadow-sm"
              style={{
                backgroundColor: appearance.color,
                backgroundImage: finish.id === 'oak' ? `url(${oakGrainDataUrl()})` : undefined,
              }}
            />
            <span className="text-[11px] leading-tight">{finish.label}</span>
          </button>
          );
        })}
      </div>

      {hasOverride && (
        <button
          type="button"
          className="mt-2 text-[11px] text-select"
          onClick={() => resetOverrides(selectedPartIds)}
        >
          Use design color
        </button>
      )}

      {!selectedPartIds.length && (
        <div className="mt-4 border-t border-hairline pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <SectionHeader>Hardware</SectionHeader>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HARDWARE_FINISHES.map((finish) => {
              const active = defaultHardwareFinishId === finish.id;
              const appearance = resolveAppearance(finish.materialId, finish.colorId);
              return (
                <button
                  key={finish.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={finish.label}
                  onClick={() => applyFinish(finish.id)}
                  className={`flex min-h-12 items-center gap-2 rounded-[7px] border px-2 py-1.5 text-left transition-colors ${
                    active
                      ? 'border-select bg-select/10 text-ink'
                      : 'border-hairline bg-surface text-ink/65 hover:border-white/20 hover:text-ink'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-7 w-7 flex-none rounded-md border border-white/15 shadow-sm"
                    style={{ background: appearance.color }}
                  />
                  <span className="text-[11px] leading-tight">{finish.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
