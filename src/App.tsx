import { lazy, Suspense, useEffect, useState } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { clearHistory } from '@/store/history';
import {
  loadDisplayUnit,
  loadDocument,
  loadGridSize,
  startAutosave,
  startDisplayUnitSync,
  startGridSizeSync,
} from '@/store/persistence';
import { useUiStore } from '@/store/uiStore';
import { CutList } from '@/ui/CutList';
import { HistoryPanel } from '@/ui/HistoryPanel';
import { LeftSidebar } from '@/ui/LeftSidebar';
import { RightSidebar } from '@/ui/RightSidebar';
import { StatusBar } from '@/ui/StatusBar';
import { Toast } from '@/ui/Toast';
import { Toolbar } from '@/ui/Toolbar';
import { useKeyboardShortcuts } from '@/ui/useKeyboardShortcuts';

// three.js is ~600 kB; the Cut List path should not pay for it up front.
const Viewport = lazy(() => import('@/viewport/Viewport').then((m) => ({ default: m.Viewport })));

/** Restore autosave and prefs before the first paint so the viewport can frame them. */
function restoreSession(): void {
  const saved = loadDocument();
  if (saved) {
    useDocumentStore.getState().hydrate(saved);
    // A restored document is the baseline, not an undoable step.
    clearHistory();
  }
  const savedUnit = loadDisplayUnit();
  if (savedUnit) useUiStore.getState().setDisplayUnit(savedUnit);
  const savedGrid = loadGridSize();
  if (savedGrid) useUiStore.getState().setGridSize(savedGrid);
}

export function App() {
  const viewMode = useUiStore((s) => s.viewMode);
  const leftSidebarOpen = useUiStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen);
  useKeyboardShortcuts();
  useState(() => {
    restoreSession();
    return null;
  });

  useEffect(() => {
    const stopAutosave = startAutosave();
    const stopUnitSync = startDisplayUnitSync();
    const stopGridSync = startGridSizeSync();
    return () => {
      stopAutosave();
      stopUnitSync();
      stopGridSync();
    };
  }, []);

  const showSidebars = viewMode !== 'render';

  return (
    <div className="flex h-full flex-col bg-canvas font-sans text-ink">
      <Toolbar />

      <div className="relative flex min-h-0 flex-1">
        {showSidebars && leftSidebarOpen && <LeftSidebar />}

        <Suspense fallback={<ViewportFallback />}>
          <Viewport />
        </Suspense>

        {showSidebars && rightSidebarOpen && <RightSidebar />}

        {viewMode === 'cutlist' && <CutList />}
        <HistoryPanel />
        <Toast />
      </div>

      <StatusBar />
    </div>
  );
}

function ViewportFallback() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center bg-[linear-gradient(160deg,#E9E5DC_0%,#C9C3B6_100%)]">
      <span className="font-mono text-[11px] text-canvas/50">Loading viewport…</span>
    </div>
  );
}
