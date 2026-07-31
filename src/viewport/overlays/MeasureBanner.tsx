import { useUiStore } from '@/store/uiStore';

export function MeasureBanner() {
  const measureActive = useUiStore((s) => s.measureActive);
  if (!measureActive) return null;
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-5 -translate-x-1/2 rounded-[20px] bg-canvas/85 px-3.5 py-1.5 text-[11.5px] text-ink">
      Click two points on the model to measure
    </div>
  );
}
