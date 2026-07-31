import { useUiStore } from '@/store/uiStore';
import { downloadDataUrl } from '@/ui/download';
import type { CameraPreset } from '../CameraController';
import { viewportApi } from '../viewportApi';

const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'angle', label: '¾ Angle' },
  { id: 'top', label: 'Top' },
];

export function RenderBar() {
  const showToast = useUiStore((s) => s.showToast);

  const handleExport = () => {
    const url = viewportApi()?.exportImage();
    if (!url) return;
    downloadDataUrl(url, 'sideboard-render.png');
    showToast('Image exported');
  };

  return (
    <div className="absolute bottom-5 left-1/2 z-5 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-canvas/85 p-2">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="h-[34px] rounded-[7px] bg-white/6 px-3.5 text-[11.5px] font-semibold text-ink hover:bg-white/12"
          onClick={() => viewportApi()?.goToPreset(p.id)}
        >
          {p.label}
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-white/12" />
      <button
        type="button"
        className="h-[34px] rounded-[7px] bg-accent px-3.5 text-[11.5px] font-bold text-canvas"
        onClick={handleExport}
      >
        Export Image
      </button>
    </div>
  );
}
