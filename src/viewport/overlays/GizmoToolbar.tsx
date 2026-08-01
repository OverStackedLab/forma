import { useUiStore, type GizmoMode } from '@/store/uiStore';
import { Icon } from '@/ui/primitives/Icon';

const MODES: { mode: GizmoMode; icon: string; label: string; key: string }[] = [
  { mode: 'select', icon: 'select', label: 'Select', key: 'Q' },
  { mode: 'pan', icon: 'pan', label: 'Pan', key: 'H' },
  { mode: 'translate', icon: 'move', label: 'Move', key: 'G' },
  { mode: 'rotate', icon: 'rotate', label: 'Rotate', key: 'R' },
  { mode: 'scale', icon: 'scale', label: 'Scale', key: 'S' },
];

function buttonClass(active: boolean): string {
  return [
    'flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-canvas',
    active ? 'border-accent bg-accent' : 'border-canvas/12 bg-white/60',
  ].join(' ');
}

export function GizmoToolbar() {
  const gizmoMode = useUiStore((s) => s.gizmoMode);
  const gridVisible = useUiStore((s) => s.gridVisible);
  const snapEnabled = useUiStore((s) => s.snapEnabled);
  const setGizmoMode = useUiStore((s) => s.setGizmoMode);
  const toggleGrid = useUiStore((s) => s.toggleGrid);
  const toggleSnap = useUiStore((s) => s.toggleSnap);

  return (
    <div className="absolute top-3 left-3 z-5 flex items-center gap-1.5">
      {MODES.map(({ mode, icon, label, key }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={gizmoMode === mode}
          aria-label={`${label} (${key})`}
          title={`${label} — ${key}`}
          className={buttonClass(gizmoMode === mode)}
          onClick={() => setGizmoMode(mode)}
        >
          <Icon name={icon} size={18} />
        </button>
      ))}

      <div className="mx-1 h-5 w-px bg-canvas/15" />

      <button
        type="button"
        aria-pressed={gridVisible}
        aria-label="Toggle grid"
        title="Grid"
        className={buttonClass(gridVisible)}
        onClick={toggleGrid}
      >
        <Icon name="grid" size={18} />
      </button>
      <button
        type="button"
        aria-pressed={snapEnabled}
        aria-label="Toggle snapping"
        title="Snap"
        className={buttonClass(snapEnabled)}
        onClick={toggleSnap}
      >
        <Icon name="snap" size={18} />
      </button>
    </div>
  );
}
