import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DisplayUnit } from '@/domain/units';
import { DEFAULT_GRID_SIZE_M, type GridSizeM } from '@/domain/workspace';

export type ViewMode = 'model' | 'cutlist' | 'render';
export type GizmoMode = 'select' | 'pan' | 'translate' | 'rotate' | 'scale';
export type LeftTab = 'assembly' | 'library';
export type RightTab = 'properties' | 'materials';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type Marquee = { x: number; y: number; w: number; h: number };
export type Toast = { id: string; message: string };
/** Measure points are three.js world coordinates (metres). */
export type MeasurePoint = { x: number; y: number; z: number };

export type UiStore = {
  selectedPartIds: string[];
  gizmoMode: GizmoMode;
  viewMode: ViewMode;
  leftTab: LeftTab;
  rightTab: RightTab;
  gridVisible: boolean;
  snapEnabled: boolean;
  measureActive: boolean;
  measurePoints: MeasurePoint[];
  marquee: Marquee | null;
  historyOpen: boolean;
  toast: Toast | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  /** A display preference, not document data — not undoable, not versioned. */
  displayUnit: DisplayUnit;
  /** Viewport grid extent in metres. A view setting, like displayUnit — not part of the design. */
  gridSizeM: GridSizeM;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleMeasure: () => void;
  addMeasurePoint: (point: MeasurePoint) => void;
  setMarquee: (marquee: Marquee | null) => void;
  toggleHistory: () => void;
  showToast: (message: string) => void;
  dismissToast: (id: string) => void;
  setSaveStatus: (status: SaveStatus, at?: number) => void;
  setDisplayUnit: (unit: DisplayUnit) => void;
  setGridSize: (gridSizeM: GridSizeM) => void;
};

let toastSeq = 0;

export const useUiStore = create<UiStore>()(
  subscribeWithSelector((set) => ({
    selectedPartIds: [],
    gizmoMode: 'select',
    viewMode: 'model',
    leftTab: 'assembly',
    rightTab: 'properties',
    gridVisible: true,
    snapEnabled: true,
    measureActive: false,
    measurePoints: [],
    marquee: null,
    historyOpen: false,
    toast: null,
    saveStatus: 'idle',
    lastSavedAt: null,
    displayUnit: 'mm',
    gridSizeM: DEFAULT_GRID_SIZE_M,

    setSelection: (ids) => set({ selectedPartIds: ids, rightTab: 'properties' }),
    toggleSelection: (id) =>
      set((s) => ({
        selectedPartIds: s.selectedPartIds.includes(id)
          ? s.selectedPartIds.filter((x) => x !== id)
          : [...s.selectedPartIds, id],
        rightTab: 'properties',
      })),
    clearSelection: () => set({ selectedPartIds: [] }),
    setGizmoMode: (gizmoMode) => set({ gizmoMode, measureActive: false }),
    setViewMode: (viewMode) => set({ viewMode }),
    setLeftTab: (leftTab) => set({ leftTab }),
    setRightTab: (rightTab) => set({ rightTab }),
    toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    toggleMeasure: () =>
      set((s) => ({
        measureActive: !s.measureActive,
        measurePoints: [],
        gizmoMode: 'select',
      })),
    // A third click starts a fresh measurement.
    addMeasurePoint: (point) =>
      set((s) => ({
        measurePoints: s.measurePoints.length >= 2 ? [point] : [...s.measurePoints, point],
      })),
    setMarquee: (marquee) => set({ marquee }),
    toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
    showToast: (message) => set({ toast: { id: `t${++toastSeq}`, message } }),
    dismissToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
    setSaveStatus: (saveStatus, at) =>
      set((s) => ({ saveStatus, lastSavedAt: at ?? s.lastSavedAt })),
    setDisplayUnit: (displayUnit) => set({ displayUnit }),
    setGridSize: (gridSizeM) => set({ gridSizeM }),
  })),
);

/** Drops ids that no longer exist — called after undo, redo and version restore. */
export function pruneSelection(liveIds: readonly string[]): void {
  const live = new Set(liveIds);
  const { selectedPartIds } = useUiStore.getState();
  const next = selectedPartIds.filter((id) => live.has(id));
  if (next.length !== selectedPartIds.length) useUiStore.setState({ selectedPartIds: next });
}
