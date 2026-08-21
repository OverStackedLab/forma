export type OrthoView = 'front' | 'side' | 'top';

export const ORTHO_VIEWS: Record<
  OrthoView,
  { look: readonly [number, number, number]; up: readonly [number, number, number] }
> = {
  // Camera looks along `look`; `up` is the screen-up world axis.
  front: { look: [0, 0, -1], up: [0, 1, 0] },
  side: { look: [-1, 0, 0], up: [0, 1, 0] },
  top: { look: [0, -1, 0], up: [0, 0, -1] },
};

const MIN_SPAN_M = 0.4;
const PADDING = 1.25;
const CLEARANCE_M = 2;

/** Width and height of an axis-aligned box as seen in an elevation or plan. */
export function orthoBoxSize(
  view: OrthoView,
  size: { x: number; y: number; z: number },
): { width: number; height: number } {
  if (view === 'front') return { width: size.x, height: size.y };
  if (view === 'side') return { width: size.z, height: size.y };
  return { width: size.x, height: size.z };
}

/** Full vertical frustum height in metres that fits the box at this aspect. */
export function orthoFrustumHeight(
  view: OrthoView,
  size: { x: number; y: number; z: number },
  aspect: number,
): number {
  const { width, height } = orthoBoxSize(view, size);
  const paddedWidth = Math.max(width, MIN_SPAN_M) * PADDING;
  const paddedHeight = Math.max(height, MIN_SPAN_M) * PADDING;
  return Math.max(paddedHeight, paddedWidth / Math.max(aspect, 0.01));
}

/**
 * World offset from the box centre to the camera, sitting just outside the
 * box along the view axis so near/far planes still contain the piece.
 */
export function orthoCameraOffset(
  view: OrthoView,
  size: { x: number; y: number; z: number },
): [number, number, number] {
  const [lx, ly, lz] = ORTHO_VIEWS[view].look;
  const along =
    view === 'front' ? size.z / 2 : view === 'side' ? size.x / 2 : size.y / 2;
  const distance = along + CLEARANCE_M;
  return [
    lx === 0 ? 0 : -lx * distance,
    ly === 0 ? 0 : -ly * distance,
    lz === 0 ? 0 : -lz * distance,
  ];
}
