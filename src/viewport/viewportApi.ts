import type { Transform } from '@/domain/types';
import type { CameraPreset } from './CameraController';

/** One bound of the first selection that the second selection should match. */
export type AlignEdge = 'left' | 'right' | 'center-x' | 'front' | 'back' | 'top' | 'bottom';

/**
 * A tiny imperative surface onto the single live viewport, so toolbar and
 * render-bar buttons can drive the camera and export a PNG without threading
 * refs through the whole tree.
 */
export type ViewportApi = {
  frameSelection: (ids: readonly string[]) => void;
  frameAll: () => void;
  goToPreset: (preset: CameraPreset) => void;
  exportImage: () => string | null;
  /** Combined world bounding box of a selection, in millimetres. */
  selectionSize: (ids: readonly string[]) => { w: number; h: number; d: number } | null;
  /** Mutates the live scene and returns the resulting transforms, ready to commit. */
  computeFloorSnap: (ids: readonly string[]) => Record<string, Transform> | null;
  /** Resizes every member and its spacing around a shared group pivot. */
  computeGroupResize: (
    ids: readonly string[],
    axis: 'x' | 'y' | 'z',
    targetMillimetres: number,
  ) => Record<string, Transform> | null;
  /** Moves the second rigid selection unit to the nearest face of the first. */
  computeSnapTogether: (
    targetIds: readonly string[],
    movingIds: readonly string[],
  ) => Record<string, Transform> | null;
  /** Matches one bound of the second rigid unit to the first, leaving other axes still. */
  computeAlign: (
    targetIds: readonly string[],
    movingIds: readonly string[],
    edge: AlignEdge,
  ) => Record<string, Transform> | null;
};

let current: ViewportApi | null = null;
const listeners = new Set<() => void>();

export function setViewportApi(api: ViewportApi | null): void {
  current = api;
  listeners.forEach((listener) => listener());
}

export function viewportApi(): ViewportApi | null {
  return current;
}

/** Lets React consumers update when the lazy viewport becomes ready or unmounts. */
export function subscribeViewportApi(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
