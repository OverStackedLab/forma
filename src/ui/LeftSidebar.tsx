import { useMemo, useState } from 'react';
import { CABINET_PRESETS, PANEL_PRESETS } from '@/domain/catalog';
import { groupInclusion } from '@/domain/parts';
import type { Group, PanelPreset, PartSpec } from '@/domain/types';
import {
  addCustomPanel,
  addCabinetPreset,
  renameGroup,
  renamePart,
  reorderGroups,
  selectAll,
  selectGroup,
  toggleGroupSelection,
  togglePartVisibility,
  toggleGroupVisibility,
} from '@/store/actions';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { Icon } from './primitives/Icon';
import { InlineRename } from './primitives/InlineRename';
import { OptionCard } from './primitives/OptionCard';
import { UnderlineTabs } from './primitives/UnderlineTabs';
import { usePartSpecs } from './useSelection';

const TABS = [
  { id: 'assembly', label: 'Assembly' },
  { id: 'library', label: 'Library' },
] as const;

export function LeftSidebar() {
  const leftTab = useUiStore((s) => s.leftTab);
  const setLeftTab = useUiStore((s) => s.setLeftTab);

  return (
    <aside className="flex w-60 flex-none flex-col border-r border-hairline bg-panel">
      <UnderlineTabs tabs={TABS} value={leftTab} onChange={setLeftTab} ariaLabel="Left panel" />
      {leftTab === 'assembly' ? <AssemblyTree /> : <LibraryPanel />}
    </aside>
  );
}

type TreeItem =
  | { kind: 'part'; spec: PartSpec }
  | { kind: 'group'; group: Group; members: PartSpec[] };

/** Groups in document order, then leftover loose parts. */
function buildTreeItems(specs: readonly PartSpec[], groups: readonly Group[]): TreeItem[] {
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const grouped = new Set(groups.flatMap((group) => group.partIds));
  const items: TreeItem[] = [];
  for (const group of groups) {
    const members = group.partIds
      .map((id) => specById.get(id))
      .filter((spec): spec is PartSpec => Boolean(spec));
    if (members.length) items.push({ kind: 'group', group, members });
  }
  for (const spec of specs) {
    if (!grouped.has(spec.id)) items.push({ kind: 'part', spec });
  }
  return items;
}

/** Every part appears individually or inside a saved/generated group. */
function AssemblyTree() {
  const specs = usePartSpecs();
  const groups = useDocumentStore((s) => s.groups);
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);
  const setSelection = useUiStore((s) => s.setSelection);
  const toggleSelection = useUiStore((s) => s.toggleSelection);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const hiddenIds = useDocumentStore((s) => s.hiddenIds);
  const setLeftTab = useUiStore((s) => s.setLeftTab);

  const hidden = new Set(hiddenIds);
  const selected = new Set(selectedPartIds);
  const items = useMemo(() => buildTreeItems(specs, groups), [specs, groups]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; place: 'before' | 'after' } | null>(null);
  const groupItems = items.filter((item) => item.kind === 'group');
  const canReorder = groupItems.length > 1;

  return (
    <>
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="font-mono text-[10.5px] text-ink/45">
          {selectedPartIds.length ? `${selectedPartIds.length} selected` : `${specs.length} parts`}
        </span>
        {specs.length > 0 && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="text-[11px] font-semibold text-select"
              onClick={selectAll}
            >
              Select All
            </button>
            {selectedPartIds.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-ink/50"
                onClick={clearSelection}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div role="tree" aria-label="Assembly" className="flex-1 overflow-y-auto px-1.5 py-2.5">
        {specs.length === 0 && (
          <p className="px-2 py-4 text-[11px] leading-relaxed text-ink/35">
            No parts yet.{' '}
            <button
              type="button"
              className="text-select underline-offset-2 hover:underline"
              onClick={() => setLeftTab('library')}
            >
              Insert one from the Library
            </button>{' '}
            to get started.
          </p>
        )}

        {items.map((item) =>
          item.kind === 'part' ? (
            <PartRow
              key={item.spec.id}
              spec={item.spec}
              isSelected={selected.has(item.spec.id)}
              isVisible={!hidden.has(item.spec.id)}
              onClick={(additive) =>
                additive ? toggleSelection(item.spec.id) : setSelection([item.spec.id])
              }
            />
          ) : (
            <GroupRow
              key={item.group.id}
              group={item.group}
              members={item.members}
              selectedPartIds={selectedPartIds}
              hidden={hidden}
              canReorder={canReorder}
              dropPlace={drop?.id === item.group.id ? drop.place : null}
              onToggleMember={(id, additive) =>
                additive ? toggleSelection(id) : setSelection([id])
              }
              onDragStart={() => setDragId(item.group.id)}
              onDragOver={(place) => {
                if (dragId && dragId !== item.group.id) setDrop({ id: item.group.id, place });
              }}
              onDrop={(place) => {
                if (dragId) reorderGroups(dragId, item.group.id, place);
                setDragId(null);
                setDrop(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDrop(null);
              }}
            />
          ),
        )}
      </div>
    </>
  );
}

function PartRow({
  spec,
  isSelected,
  isVisible,
  indent = false,
  onClick,
}: {
  spec: PartSpec;
  isSelected: boolean;
  isVisible: boolean;
  indent?: boolean;
  onClick: (additive: boolean) => void;
}) {
  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={(e) => onClick(e.shiftKey || e.metaKey || e.ctrlKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(false);
        }
      }}
      className={`flex h-7 cursor-pointer items-center gap-2 rounded-md pr-2.5 text-[12.5px] ${
        indent ? 'pl-6' : 'pl-2.5'
      } ${isSelected ? 'bg-select/16 text-ink' : 'text-ink/75 hover:bg-white/4'}`}
    >
      <InlineRename
        value={spec.label}
        onRename={(v) => renamePart(spec.id, v)}
        ariaLabel={`Rename ${spec.label}`}
        className="min-w-0 flex-1 truncate"
        inputClassName="min-w-0 flex-1 rounded-[4px] border border-select bg-input px-1 text-[12.5px] text-ink outline-none"
      />
      <button
        type="button"
        aria-pressed={!isVisible}
        aria-label={`${isVisible ? 'Hide' : 'Show'} ${spec.label}`}
        // Must not bubble, or toggling visibility changes selection.
        onClick={(e) => {
          e.stopPropagation();
          togglePartVisibility(spec.id);
        }}
        className={`flex h-5 w-5 flex-none items-center justify-center ${
          isVisible ? 'text-ink/55' : 'text-ink/20'
        }`}
      >
        <Icon name={isVisible ? 'visibility' : 'visibility_off'} size={15} />
      </button>
    </div>
  );
}

function GroupRow({
  group,
  members,
  selectedPartIds,
  hidden,
  canReorder,
  dropPlace,
  onToggleMember,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  group: Group;
  members: PartSpec[];
  selectedPartIds: readonly string[];
  hidden: Set<string>;
  canReorder: boolean;
  dropPlace: 'before' | 'after' | null;
  onToggleMember: (id: string, additive: boolean) => void;
  onDragStart: () => void;
  onDragOver: (place: 'before' | 'after') => void;
  onDrop: (place: 'before' | 'after') => void;
  onDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const selected = new Set(selectedPartIds);
  const inclusion = groupInclusion(group.partIds, selectedPartIds);
  const allSelected = inclusion === 'all';
  const anyVisible = group.partIds.some((id) => !hidden.has(id));

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={allSelected}
        aria-expanded={expanded}
        tabIndex={0}
        onClick={(e) => {
          if (e.shiftKey || e.metaKey || e.ctrlKey) toggleGroupSelection(group.id);
          else selectGroup(group.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectGroup(group.id);
          }
        }}
        onDragOver={(e) => {
          if (!canReorder) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onDragOver(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
        }}
        onDrop={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onDrop(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
        }}
        className={`flex h-7 cursor-pointer items-center gap-1 rounded-md pr-2.5 pl-1 text-[12.5px] font-semibold ${
          allSelected ? 'bg-select/16 text-ink' : 'text-ink/85 hover:bg-white/4'
        } ${
          dropPlace === 'before'
            ? 'border-t-2 border-select'
            : dropPlace === 'after'
              ? 'border-b-2 border-select'
              : ''
        }`}
      >
        {canReorder && (
          <div
            draggable
            role="button"
            aria-label={`Reorder ${group.label}`}
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', group.id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            className="flex h-5 w-5 flex-none cursor-grab items-center justify-center text-ink/35 active:cursor-grabbing"
          >
            <Icon name="grip" size={14} />
          </div>
        )}
        <button
          type="button"
          aria-label={expanded ? 'Collapse group' : 'Expand group'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex h-5 w-5 flex-none items-center justify-center text-[16px] leading-none text-ink/55"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <InlineRename
          value={group.label}
          onRename={(v) => renameGroup(group.id, v)}
          ariaLabel={`Rename ${group.label}`}
          className="min-w-0 flex-1 truncate"
          inputClassName="min-w-0 flex-1 rounded-[4px] border border-select bg-input px-1 text-[12.5px] font-semibold text-ink outline-none"
        />
        <span className="font-mono text-[10.5px] text-ink/35">{group.partIds.length}</span>
        <button
          type="button"
          aria-pressed={!anyVisible}
          aria-label={`${anyVisible ? 'Hide' : 'Show'} ${group.label}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupVisibility(group.id);
          }}
          className={`flex h-5 w-5 flex-none items-center justify-center ${
            anyVisible ? 'text-ink/55' : 'text-ink/20'
          }`}
        >
          <Icon name={anyVisible ? 'visibility' : 'visibility_off'} size={15} />
        </button>
      </div>

      {expanded &&
        members.map((spec) => (
          <PartRow
            key={spec.id}
            spec={spec}
            indent
            isSelected={selected.has(spec.id)}
            isVisible={!hidden.has(spec.id)}
            onClick={(additive) => onToggleMember(spec.id, additive)}
          />
        ))}
    </div>
  );
}

function LibrarySection({
  title,
  presets,
}: {
  title: string;
  presets: readonly PanelPreset[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold tracking-[.04em] text-ink/45 uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((preset) => (
          <OptionCard
            key={preset.id}
            label={preset.label}
            description={preset.description}
            icon={preset.icon}
            dragPayload={`panel:${preset.id}`}
            onClick={() => addCustomPanel(preset.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Library entry point for cabinet assemblies, panels, fronts and hardware. */
function LibraryPanel() {
  const panels = PANEL_PRESETS.filter((preset) => preset.category === 'panel');
  const fronts = PANEL_PRESETS.filter((preset) => preset.category === 'front');
  const hardware = PANEL_PRESETS.filter((preset) => preset.category === 'hardware');

  return (
    <div className="flex flex-col gap-[18px] overflow-y-auto px-3 py-3.5">
      <div>
        <h3 className="mb-2 text-[11px] font-semibold tracking-[.04em] text-ink/45 uppercase">
          Prebuilt Cabinets
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {CABINET_PRESETS.map((preset) => (
            <OptionCard
              key={preset.id}
              label={preset.label}
              description={`${preset.width}×${preset.height}×${preset.depth} mm`}
              icon={preset.icon}
              dragPayload={`cabinet:${preset.id}`}
              onClick={() => addCabinetPreset(preset.id)}
            />
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-ink/30">
          IKEA METOD frame sizes. Heights exclude legs and worktops.
        </p>
      </div>

      <LibrarySection title="Panels" presets={panels} />
      <LibrarySection title="Fronts" presets={fronts} />
      <LibrarySection title="Hardware" presets={hardware} />

      <p className="text-[11px] leading-relaxed text-ink/35">
        Click an item to add it to the scene, or drag it onto the viewport.
      </p>
    </div>
  );
}
