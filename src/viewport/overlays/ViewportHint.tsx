export function ViewportHint() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px] text-canvas/50">
      Drag to orbit · Shift-drag to box select · G/R/S transform · H pan · F frame · ⌘D duplicate ·
      ⌘A select all · Del delete
    </div>
  );
}
