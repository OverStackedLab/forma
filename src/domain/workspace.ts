/**
 * Viewport scale. The grid is the user's sense of how big the world is, so
 * every scene number that depends on world size is derived from it here —
 * one pure function, no three.js, no React.
 *
 * All lengths in this module are three.js world units (metres), not the
 * millimetres used everywhere a user can see a number. This is scene setup,
 * on the far side of the mm boundary, not document data.
 */

/** Grid sizes offered in the UI, in metres. 20 m exactly covers the ±10 m part-position clamp. */
export const GRID_SIZES_M = [2, 4, 10, 20] as const;

export type GridSizeM = (typeof GRID_SIZES_M)[number];

/** The size every derived number below is calibrated against: at 4 m, k = 1. */
export const DEFAULT_GRID_SIZE_M: GridSizeM = 4;

/** 100 mm cells at every grid size — matching the gizmo's 0.1 translate snap. */
const CELL_SIZE_M = 0.1;

/**
 * The longest of CameraController's fixed viewpoint presets, measured from its
 * own orbit target ('angle', at 3.841). The presets are content framing for a
 * piece of furniture and deliberately do not scale with the grid, so the orbit
 * ceiling must never fall below them: OrbitControls would clamp the camera
 * back every frame while the eased flight lerped it out again, and the flight
 * would never reach its arrival epsilon.
 */
const PRESET_REACH_M = 4;

/** Parts are millimetre-scale whatever the grid is, so the floor never scales. */
const MIN_ORBIT_DISTANCE_M = 1.2;

/** Perspective far plane never drops below the value the 4 m scene shipped with. */
const MIN_CAMERA_FAR_M = 50;

export type ViewportScale = {
  /** The grid size this scale was derived from, in metres. */
  gridSizeM: number;
  /** GridHelper divisions — grid size / cell size. */
  divisions: number;
  /** Closest the orbit camera may come to its target. */
  minDistance: number;
  /** Furthest the orbit camera may go from its target. */
  maxDistance: number;
  /** Floor for a Frame flight's distance; equals minDistance so flights can arrive. */
  frameMinDistance: number;
  /** Ceiling for a Frame flight's distance. */
  frameClamp: number;
  /** Half-width of the key light's orthographic shadow frustum. */
  shadowExtent: number;
  /** Far plane of the key light's shadow camera. */
  shadowFar: number;
  /** Edge length of the square shadow-catcher / drop-target ground plane. */
  groundSize: number;
  /** Perspective camera far plane. */
  cameraFar: number;
};

export function isGridSizeM(value: unknown): value is GridSizeM {
  return (GRID_SIZES_M as readonly unknown[]).includes(value);
}

/** A grid size from unknown input (localStorage, a stale build), or the default. */
export function coerceGridSize(value: unknown): GridSizeM {
  const n = typeof value === 'string' ? Number(value) : value;
  return isGridSizeM(n) ? n : DEFAULT_GRID_SIZE_M;
}

/**
 * Every scale-dependent viewport number, derived from one grid size.
 *
 * The spine is a single factor k = gridSizeM / 4, so at the default 4 m grid
 * every value below is exactly the literal the scene shipped with and the
 * default look is unchanged.
 *
 * Two families behave differently on purpose:
 *
 *  - Camera *reach* (maxDistance, frameClamp) scales both ways — a smaller
 *    grid should mean a tighter zoom envelope. maxDistance is floored at the
 *    camera presets' own reach so a preset flight is never clamped short.
 *  - Scene *coverage* (ground, shadow frustum, far plane) only ever grows.
 *    Parts may sit anywhere within the ±10 m position clamp regardless of
 *    grid size, so shrinking coverage would drop their shadows and shrink the
 *    ground plane that library drag-drops are raycast against.
 */
export function viewportScale(gridSizeM: number): ViewportScale {
  const size = coerceGridSize(gridSizeM);
  const k = size / DEFAULT_GRID_SIZE_M;

  const minDistance = MIN_ORBIT_DISTANCE_M;
  const maxDistance = Math.max(7 * k, PRESET_REACH_M);

  return {
    gridSizeM: size,
    divisions: Math.round(size / CELL_SIZE_M),
    minDistance,
    maxDistance,
    frameMinDistance: minDistance,
    // Clamped into the orbit envelope so a Frame flight always has a
    // reachable destination at every grid size.
    frameClamp: Math.min(Math.max(6 * k, minDistance), maxDistance),
    shadowExtent: Math.max(3.5 * k, 3.5),
    shadowFar: Math.max(12 * k, 12),
    groundSize: Math.max(12 * k, 12),
    // Must clear maxDistance plus the *full* grid diagonal, because the user
    // can pan the orbit target to a corner and then zoom out: 1.75g + 1.414g
    // = 3.164g < 4g for every g, with the 50 floor covering the small grids.
    cameraFar: Math.max(MIN_CAMERA_FAR_M, size * 4),
  };
}
