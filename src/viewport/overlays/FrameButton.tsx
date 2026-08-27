import { useUiStore } from '@/store/uiStore';
import type { CameraPreset } from '../CameraController';
import { viewportApi } from '../viewportApi';

const VIEWS: { id: CameraPreset; label: string }[] = [
  { id: 'angle', label: '3D' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
];

const buttonClass =
  'h-[30px] rounded-[7px] border border-canvas/15 bg-white/60 px-3 text-[11.5px] font-semibold text-canvas';

export function FrameButton() {
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);
  return (
    <div className="absolute top-3 right-3 z-5 flex items-center gap-1.5">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className={buttonClass}
          onClick={() => viewportApi()?.goToPreset(view.id)}
        >
          {view.label}
        </button>
      ))}
      <button
        type="button"
        className={buttonClass}
        onClick={() => viewportApi()?.frameSelection(selectedPartIds)}
      >
        Frame
      </button>
    </div>
  );
}
