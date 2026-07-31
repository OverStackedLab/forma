import {
  Box,
  Circle,
  Columns2,
  Download,
  Eye,
  EyeOff,
  Grid3x3,
  Hand,
  History,
  Magnet,
  Minus,
  MousePointer2,
  Move,
  PanelLeft,
  RectangleEllipsis,
  RectangleHorizontal,
  Redo2,
  RotateCw,
  Rows3,
  Ruler,
  Scaling,
  Scissors,
  SeparatorVertical,
  Sparkles,
  Table2,
  Triangle,
  Undo2,
  Waypoints,
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
  download: Download,

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

  // Leg styles
  leg_tapered: Triangle,
  leg_straight: SeparatorVertical,
  leg_hairpin: Waypoints,

  // Handle styles
  handle_bar: Minus,
  handle_knob: Circle,
  handle_recessed: RectangleEllipsis,

  // Base styles
  base_legs: Table2,
  base_plinth: RectangleHorizontal,

  // Library panels
  panel_shelf: Rows3,
  panel_flat: PanelLeft,
  panel_back: RectangleHorizontal,
  panel_divider: Columns2,
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
