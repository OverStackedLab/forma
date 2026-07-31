import { useMemo, useState } from 'react';
import { PANEL_PRESETS } from '@/domain/catalog';
import type { Group, PartSpec } from '@/domain/types';
import {
  addCustomPanel,
  renameGroup,
  renamePart,
  selectAll,
  selectGroup,
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

/** Groups are rendered at the position of their first surviving member. */
function buildTreeItems(specs: readonly PartSpec[], groups: readonly Group[]): TreeItem[] {
  const groupOfPart = new Map<string, Group>();
  for (const g of groups) for (const id of g.partIds) groupOfPart.set(id, g);

  const items: TreeItem[] = [];
  const emitted = new Set<string>();
  for (const spec of specs) {
    const group = groupOfPart.get(spec.id);
    if (!group) {
      items.push({ kind: 'part', spec });
      continue;
    }
    if (emitted.has(group.id)) continue;
    emitted.add(group.id);
    const members = group.partIds
      .map((id) => specs.find((s) => s.id === id))
      .filter((s): s is PartSpec => Boolean(s));
    items.push({ kind: 'group', group, members });
  }
  return items;
}

/** Every part is a library panel, individually or gathered into a saved group. */
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
              onToggleMember={(id, additive) =>
                additive ? toggleSelection(id) : setSelection([id])
              }
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
  onToggleMember,
}: {
  group: Group;
  members: PartSpec[];
  selectedPartIds: readonly string[];
  hidden: Set<string>;
  onToggleMember: (id: string, additive: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const selected = new Set(selectedPartIds);
  const isGroupSelected =
    group.partIds.length === selectedPartIds.length && group.partIds.every((id) => selected.has(id));
  const anyVisible = group.partIds.some((id) => !hidden.has(id));

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isGroupSelected}
        aria-expanded={expanded}
        tabIndex={0}
        onClick={(e) => {
          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            const ui = useUiStore.getState();
            const next = isGroupSelected
              ? ui.selectedPartIds.filter((id) => !group.partIds.includes(id))
              : [...new Set([...ui.selectedPartIds, ...group.partIds])];
            ui.setSelection(next);
          } else {
            selectGroup(group.id);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectGroup(group.id);
          }
        }}
        className={`flex h-7 cursor-pointer items-center gap-1 rounded-md pr-2.5 pl-1 text-[12.5px] font-semibold ${
          isGroupSelected ? 'bg-select/16 text-ink' : 'text-ink/85 hover:bg-white/4'
        }`}
      >
        <button
          type="button"
          aria-label={expanded ? 'Collapse group' : 'Expand group'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex h-5 w-4 flex-none items-center justify-center text-[10px] text-ink/55"
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

/** The panel library is the only way to add geometry to the scene. */
function LibraryPanel() {
  return (
    <div className="flex flex-col gap-[18px] overflow-y-auto px-3 py-3.5">
      <div className="grid grid-cols-2 gap-1.5">
        {PANEL_PRESETS.map((p) => (
          <OptionCard
            key={p.id}
            label={p.label}
            icon={p.icon}
            dragPayload={`panel:${p.id}`}
            onClick={() => addCustomPanel(p.id)}
          />
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-ink/35">
        Click a panel to add it to the scene, or drag it onto the viewport.
      </p>
    </div>
  );
}
