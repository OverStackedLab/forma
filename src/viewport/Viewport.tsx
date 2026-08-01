import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { addCustomPanel, commitTransforms } from '@/store/actions';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import type { Transform } from '@/domain/types';
import { combinedWorldBounds, worldBoundsExcludingHalos } from './bounds';
import { CameraController } from './CameraController';
import { GizmoController } from './GizmoController';
import { MeasureController } from './MeasureController';
import { ModelBuilder } from './ModelBuilder';
import { PickController } from './PickController';
import { SceneManager } from './SceneManager';
import { SelectionOverlay } from './SelectionOverlay';
import { snapSelectionToNearbyFaces } from './faceSnap';
import { setViewportApi } from './viewportApi';
import { MarqueeRect } from './overlays/MarqueeRect';
import { MeasureBanner } from './overlays/MeasureBanner';
import { GizmoToolbar } from './overlays/GizmoToolbar';
import { ViewportHint } from './overlays/ViewportHint';
import { RenderBar } from './overlays/RenderBar';
import { FrameButton } from './overlays/FrameButton';

/**
 * World-space bounds of a selection in millimetres, with selection halos
 * excluded so they don't inflate the reported size by 4.5%.
 */
function measureBounds(builder: ModelBuilder, ids: readonly string[]) {
  const box = combinedWorldBounds(ids.map((id) => builder.getRoot(id)));
  if (!box) return null;
  const size = box.getSize(new Vector3());
  return {
    w: Math.round(size.x * 1000),
    h: Math.round(size.y * 1000),
    d: Math.round(size.z * 1000),
  };
}

/**
 * Drops each part straight down (or up) so its own world-space bounding box
 * rests on y=0, independent of the others — mirroring how a gizmo drag
 * mutates the live object first and is committed after. Parts already on the
 * floor (within a hair) are left out of the result.
 */
function computeFloorSnapTransforms(
  builder: ModelBuilder,
  ids: readonly string[],
): Record<string, Transform> | null {
  const EPSILON = 1e-6;
  const next: Record<string, Transform> = {};

  for (const id of ids) {
    const root = builder.getRoot(id);
    if (!root) continue;

    const box = worldBoundsExcludingHalos(root);
    if (!box) continue;

    const dy = -box.min.y;
    if (Math.abs(dy) < EPSILON) continue;

    root.position.y += dy;
    next[id] = {
      position: root.position.toArray() as [number, number, number],
      quaternion: root.quaternion.toArray() as [number, number, number, number],
      scale: root.scale.toArray() as [number, number, number],
    };
  }

  return Object.keys(next).length ? next : null;
}

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureLabelRef = useRef<HTMLDivElement>(null);
  const viewMode = useUiStore((s) => s.viewMode);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new SceneManager(container);
    const builder = new ModelBuilder(scene.partsGroup);
    const overlay = new SelectionOverlay(builder);
    const camera = new CameraController(scene, builder);
    const measure = new MeasureController(scene);
    measure.setLabelElement(measureLabelRef.current);

    const gizmo = new GizmoController(scene, builder, (transforms) => {
      const state = useUiStore.getState();
      const next =
        state.snapEnabled && state.gizmoMode === 'translate'
          ? snapSelectionToNearbyFaces(builder, Object.keys(transforms), transforms)
          : transforms;
      commitTransforms(next);
    });

    const pick = new PickController(scene, builder, {
      isMeasureActive: () => {
        const state = useUiStore.getState();
        return state.viewMode === 'model' && state.measureActive;
      },
      isPanMode: () => useUiStore.getState().gizmoMode === 'pan',
      isGizmoDragging: () => gizmo.isDragging,
      onSelect: (partId, additive) => {
        const ui = useUiStore.getState();
        if (additive) ui.toggleSelection(partId);
        else ui.setSelection([partId]);
      },
      onClearSelection: () => useUiStore.getState().clearSelection(),
      onMarqueeChange: (marquee) => useUiStore.getState().setMarquee(marquee),
      onMarqueeCommit: (ids, additive) => {
        const ui = useUiStore.getState();
        if (!ids.length) {
          if (!additive) ui.clearSelection();
          return;
        }
        const next = additive ? [...new Set([...ui.selectedPartIds, ...ids])] : ids;
        ui.setSelection(next);
        ui.showToast(`${ids.length} part${ids.length > 1 ? 's' : ''} selected`);
      },
      onMeasurePoint: (point) =>
        useUiStore.getState().addMeasurePoint({ x: point.x, y: point.y, z: point.z }),
      onDropPanel: (presetId, point) => addCustomPanel(presetId, point ?? undefined),
    });

    // Rebuild discipline: geometry first, then visibility (already applied
    // inside sync), then the selection highlight, then the gizmo attachment.
    // Render is a clean presentation view: no halos, no gizmo, so neither ends
    // up baked into the exported PNG.
    const decorated = () => {
      const ui = useUiStore.getState();
      return ui.viewMode === 'render' ? [] : ui.selectedPartIds;
    };

    const syncScene = () => {
      const doc = useDocumentStore.getState();
      const ui = useUiStore.getState();
      builder.sync({
        overrides: doc.overrides,
        customParts: doc.customParts,
        transforms: doc.transforms,
        hiddenIds: doc.hiddenIds,
        defaultMaterialId: doc.defaultMaterialId,
        defaultColorId: doc.defaultColorId,
      });
      overlay.apply(decorated());
      gizmo.sync(ui.gizmoMode, decorated());
    };

    syncScene();
    gizmo.setSnapEnabled(useUiStore.getState().snapEnabled);
    const syncPresentationVisibility = () => {
      const state = useUiStore.getState();
      const editing = state.viewMode !== 'render';
      scene.setGridVisible(editing && state.gridVisible);
      measure.setVisible(editing);
    };
    syncPresentationVisibility();

    const unsubDoc = useDocumentStore.subscribe(syncScene);

    const unsubSelection = useUiStore.subscribe(
      (s) => s.selectedPartIds,
      () => {
        overlay.apply(decorated());
        gizmo.sync(useUiStore.getState().gizmoMode, decorated());
      },
    );
    const unsubGizmoMode = useUiStore.subscribe(
      (s) => s.gizmoMode,
      (mode) => {
        gizmo.sync(mode, decorated());
        scene.setPanMode(mode === 'pan');
      },
    );
    const unsubViewMode = useUiStore.subscribe(
      (s) => s.viewMode,
      () => {
        overlay.apply(decorated());
        gizmo.sync(useUiStore.getState().gizmoMode, decorated());
        syncPresentationVisibility();
        scene.resize();
      },
    );
    const unsubSnap = useUiStore.subscribe(
      (s) => s.snapEnabled,
      (enabled) => gizmo.setSnapEnabled(enabled),
    );
    const unsubGrid = useUiStore.subscribe(
      (s) => s.gridVisible,
      () => syncPresentationVisibility(),
    );
    const unsubMeasure = useUiStore.subscribe(
      (s) => s.measurePoints,
      (points) => measure.setPoints(points),
    );

    const unsubFrame = scene.onBeforeRender(() => {
      camera.update();
      measure.updateLabel();
    });

    setViewportApi({
      frameSelection: (ids) =>
        ids.length ? camera.frameSelection(ids) : camera.frameAll(),
      frameAll: () => camera.frameAll(),
      goToPreset: (preset) => camera.goTo(preset),
      exportImage: () => {
        scene.renderNow();
        return scene.renderer.domElement.toDataURL('image/png');
      },
      selectionSize: (ids) => measureBounds(builder, ids),
      computeFloorSnap: (ids) => computeFloorSnapTransforms(builder, ids),
    });

    return () => {
      setViewportApi(null);
      unsubDoc();
      unsubSelection();
      unsubGizmoMode();
      unsubViewMode();
      unsubSnap();
      unsubGrid();
      unsubMeasure();
      unsubFrame();
      pick.dispose();
      gizmo.dispose();
      measure.dispose();
      overlay.dispose();
      camera.dispose();
      builder.dispose();
      scene.dispose();
    };
  }, []);

  // Sidebars hiding in Render mode resizes the container; SceneManager's
  // ResizeObserver picks that up on its own.
  return (
    <div
      ref={containerRef}
      className="relative min-w-0 flex-1 overflow-hidden bg-[linear-gradient(160deg,#E9E5DC_0%,#C9C3B6_100%)]"
    >
      {viewMode !== 'render' && (
        <>
          <GizmoToolbar />
          <FrameButton />
          <MeasureBanner />
          <ViewportHint />
        </>
      )}
      {viewMode === 'render' && <RenderBar />}
      <MarqueeRect />
      <div
        ref={measureLabelRef}
        className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-[130%] rounded-[5px] border border-select/40 bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-select"
      />
    </div>
  );
}
