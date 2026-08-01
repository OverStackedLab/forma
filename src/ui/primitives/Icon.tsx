import {
  Box,
  ChevronDown,
  Circle,
  Columns2,
  DoorClosed,
  Download,
  Eye,
  EyeOff,
  Grid3x3,
  Hand,
  History,
  Magnet,
  MousePointer2,
  Move,
  PanelLeft,
  RectangleHorizontal,
  Redo2,
  RotateCw,
  Rows3,
  Ruler,
  Scaling,
  Scissors,
  Sparkles,
  Undo2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons come from lucide-react — a single stroke-based icon set, imported per
 * glyph so the bundle only pays for the ~26 icons actually used. Kept behind a
 * name lookup (rather than importing the component directly at each call
 * site) so the rest of the app doesn't couple to a specific icon library.
 */
const ICONS: Record<string, LucideIcon> = {
  // Toolbar / global
  undo: Undo2,
  redo: Redo2,
  measure: Ruler,
  history: History,
  close: X,
  chevron_down: ChevronDown,
  download: Download,
  save_file: Download,
  open_file: Upload,

  // View mode tabs
  model: Box,
  cutlist: Scissors,
  render: Sparkles,

  // Gizmo toolbar
  select: MousePointer2,
  pan: Hand,
  move: Move,
  rotate: RotateCw,
  scale: Scaling,
  grid: Grid3x3,
  snap: Magnet,

  // Assembly tree
  visibility: Eye,
  visibility_off: EyeOff,

  // Library panels
  panel_shelf: Rows3,
  panel_flat: PanelLeft,
  panel_back: RectangleHorizontal,
  panel_divider: Columns2,
  panel_door: DoorClosed,
  panel_knob: Circle,
  cabinet: Box,
};

export type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 18, className = '' }: IconProps) {
  const LucideIconComponent = ICONS[name];
  if (!LucideIconComponent) return null;
  return (
    <LucideIconComponent
      aria-hidden="true"
      size={size}
      strokeWidth={2}
      className={`shrink-0 ${className}`}
    />
  );
}
