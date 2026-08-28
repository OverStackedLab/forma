import { formatShortcut } from '@/ui/shortcuts';

export function ViewportHint() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px] text-canvas/50">
      Drag to orbit · Shift-drag to box select · Shift-move for grid · G/R/S transform · arrows
      nudge · H pan · F frame · {formatShortcut('mod+D')} duplicate ·{' '}
      {formatShortcut('mod+A')} select all · Del delete
    </div>
  );
}
