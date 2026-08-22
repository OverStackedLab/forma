import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { gizmoPartIds } from '@/domain/parts';
import {
  addCabinetPreset,
  addCustomPanel,
  commitTransforms,
  resizeCabinetFromGizmo,
} from '@/store/actions';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { combinedWorldBounds } from './bounds';
import { CameraController } from './CameraController';
import { GizmoController } from './GizmoController';
import { MeasureController } from './MeasureController';
import { ModelBuilder } from './ModelBuilder';
import { SelectionDimensions } from './SelectionDimensions';
import { PickController } from './PickController';
import { SceneManager } from './SceneManager';
import { SelectionOverlay } from './SelectionOverlay';
import { computeFloorSnapTransforms } from './floorSnap';
import { computeGroupResizeTransforms } from './groupResize';
import { computeAlignTransforms } from './align';
import { computeSnapTogetherTransforms } from './snapTogether';
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

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureLabelRef = useRef<HTMLDivElement>(null);
  const gapLabelsRef = useRef<HTMLDivElement>(null);
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
    const dimensions = new SelectionDimensions(scene);
    dimensions.setLabelRoot(gapLabelsRef.current);

    const gizmo = new GizmoController(scene, builder, (transforms, context) => {
      if (
        context.mode === 'scale' &&
        context.groupScale &&
        resizeCabinetFromGizmo(Object.keys(transforms), context.groupScale)
      ) return;
      commitTransforms(transforms);
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
        const selectedIds = [...new Set(ids)];
        if (!selectedIds.length) {
          if (!additive) ui.clearSelection();
          return;
        }
        const next = additive ? [...new Set([...ui.selectedPartIds, ...selectedIds])] : selectedIds;
        ui.setSelection(next);
        ui.showToast(`${selectedIds.length} part${selectedIds.length > 1 ? 's' : ''} selected`);
      },
      onMeasurePoint: (point) =>
        useUiStore.getState().addMeasurePoint({ x: point.x, y: point.y, z: point.z }),
      onDropLibraryItem: (kind, presetId, placement) => {
        if (kind === 'cabinet') addCabinetPreset(presetId, placement ?? undefined);
        else addCustomPanel(presetId, placement ?? undefined);
      },
    });

    // Rebuild discipline: geometry first, then visibility (already applied
    // inside sync), then the selection highlight, then the gizmo attachment.
    // Render is a clean presentation view: no halos, no gizmo, so neither ends
    // up baked into the exported PNG.
    const decorated = () => {
      const ui = useUiStore.getState();
      return ui.viewMode === 'render' ? [] : ui.selectedPartIds;
    };

    const gizmoSelection = () => {
      const ui = useUiStore.getState();
      if (ui.viewMode === 'render') return [];
      return gizmoPartIds(useDocumentStore.getState().groups, ui.selectedPartIds);
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
        defaultHardwareFinishId: doc.defaultHardwareFinishId,
      });
      overlay.apply(decorated());
      gizmo.sync(ui.gizmoMode, gizmoSelection());
    };

    syncScene();
    gizmo.setSnapEnabled(useUiStore.getState().snapEnabled);
    // Viewport is lazy-loaded, so App has normally hydrated the preference by
    // now — but that ordering is incidental, hence the subscription below too.
    scene.setGridSize(useUiStore.getState().gridSizeM);
    const syncPresentationVisibility = () => {
      const state = useUiStore.getState();
      const editing = state.viewMode !== 'render';
      scene.setGridVisible(editing && state.gridVisible);
      measure.setVisible(editing);
      dimensions.setVisible(editing);
    };
    syncPresentationVisibility();

    const unsubDoc = useDocumentStore.subscribe(syncScene);

    const unsubSelection = useUiStore.subscribe(
      (s) => s.selectedPartIds,
      () => {
        overlay.apply(decorated());
        gizmo.sync(useUiStore.getState().gizmoMode, gizmoSelection());
      },
    );
    const unsubGizmoMode = useUiStore.subscribe(
      (s) => s.gizmoMode,
      (mode) => {
        gizmo.sync(mode, gizmoSelection());
        scene.setPanMode(mode === 'pan');
      },
    );
    const unsubViewMode = useUiStore.subscribe(
      (s) => s.viewMode,
      () => {
        overlay.apply(decorated());
        gizmo.sync(useUiStore.getState().gizmoMode, gizmoSelection());
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
    const unsubGridSize = useUiStore.subscribe(
      (s) => s.gridSizeM,
      (size) => scene.setGridSize(size),
    );
    const unsubMeasure = useUiStore.subscribe(
      (s) => s.measurePoints,
      (points) => measure.setPoints(points),
    );

    const unsubFrame = scene.onBeforeRender(() => {
      camera.update();
      measure.updateLabel();
      const ui = useUiStore.getState();
      const doc = useDocumentStore.getState();
      dimensions.sync(
        builder,
        ui.viewMode === 'render' ? [] : ui.selectedPartIds,
        doc.groups,
      );
      dimensions.updateLabels();
    });

    const refreshGizmo = () => gizmo.sync(useUiStore.getState().gizmoMode, gizmoSelection());
    setViewportApi({
      frameSelection: (ids) => {
        if (ids.length) camera.frameSelection(ids);
        else camera.frameAll();
        refreshGizmo();
      },
      frameAll: () => {
        camera.frameAll();
        refreshGizmo();
      },
      goToPreset: (preset) => {
        camera.goTo(preset);
        refreshGizmo();
      },
      exportImage: () => {
        scene.renderNow();
        return scene.renderer.domElement.toDataURL('image/png');
      },
      selectionSize: (ids) => measureBounds(builder, ids),
      computeFloorSnap: (ids) => computeFloorSnapTransforms(builder, ids),
      computeGroupResize: (ids, axis, targetMillimetres) =>
        computeGroupResizeTransforms(builder, ids, axis, targetMillimetres),
      computeSnapTogether: (targetIds, movingIds) =>
        computeSnapTogetherTransforms(builder, targetIds, movingIds),
      computeAlign: (targetIds, movingIds, edge) =>
        computeAlignTransforms(builder, targetIds, movingIds, edge),
    });

    return () => {
      setViewportApi(null);
      unsubDoc();
      unsubSelection();
      unsubGizmoMode();
      unsubViewMode();
      unsubSnap();
      unsubGrid();
      unsubGridSize();
      unsubMeasure();
      unsubFrame();
      pick.dispose();
      gizmo.dispose();
      measure.dispose();
      dimensions.dispose();
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
      <div ref={gapLabelsRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
