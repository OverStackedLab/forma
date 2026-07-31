import { useUiStore } from '@/store/uiStore';

export function MarqueeRect() {
  const marquee = useUiStore((s) => s.marquee);
  if (!marquee) return null;
  return (
    <div
      className="pointer-events-none absolute z-6 border border-select bg-select/14"
      style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
    />
  );
}
