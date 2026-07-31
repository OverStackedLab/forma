import { useUiStore } from '@/store/uiStore';
import { viewportApi } from '../viewportApi';

export function FrameButton() {
  const selectedPartIds = useUiStore((s) => s.selectedPartIds);
  return (
    <button
      type="button"
      className="absolute top-3 right-3 z-5 h-[30px] rounded-[7px] border border-canvas/15 bg-white/60 px-3 text-[11.5px] font-semibold text-canvas"
      onClick={() => viewportApi()?.frameSelection(selectedPartIds)}
    >
      Frame
    </button>
  );
}
