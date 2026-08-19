/**
 * Procedural oak grain used by the Oak finish — both the 3D PBR map and the
 * finish-picker swatch. Kept canvas-based so the app stays asset-free.
 */

const SIZE = 512;

let cachedDataUrl: string | null = null;

/** Paints a warm oak plank with lengthwise grain onto an existing 2D context. */
export function paintOakGrain(ctx: CanvasRenderingContext2D, size = SIZE): void {
  const gradient = ctx.createLinearGradient(0, 0, size, 0);
  gradient.addColorStop(0, '#b88955');
  gradient.addColorStop(0.35, '#c9a06a');
  gradient.addColorStop(0.55, '#d4b07a');
  gradient.addColorStop(0.8, '#c09762');
  gradient.addColorStop(1, '#b48552');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 70; i++) {
    const x = (i / 70) * size + (pseudo(i, 1) - 0.5) * 10;
    const amplitude = 4 + pseudo(i, 2) * 10;
    const frequency = 0.012 + pseudo(i, 3) * 0.02;
    const phase = pseudo(i, 4) * Math.PI * 2;
    const alpha = 0.04 + pseudo(i, 5) * 0.1;
    const shade = pseudo(i, 6) > 0.5 ? 40 : 210;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${shade}, ${shade - 20}, ${shade - 40}, ${alpha})`;
    ctx.lineWidth = 0.8 + pseudo(i, 7) * 2.4;
    for (let y = 0; y <= size; y += 4) {
      const px = x + Math.sin(y * frequency + phase) * amplitude;
      if (y === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }

  // Soft pore flecks for melamine oak-effect character.
  for (let i = 0; i < 400; i++) {
    const x = pseudo(i, 8) * size;
    const y = pseudo(i, 9) * size;
    const r = 0.4 + pseudo(i, 10) * 1.2;
    ctx.fillStyle = `rgba(70, 45, 20, ${0.04 + pseudo(i, 11) * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 2.2, r, pseudo(i, 12) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createOakGrainCanvas(size = SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) paintOakGrain(ctx, size);
  return canvas;
}

/** Cached data URL for UI swatches — same grain as the 3D map. */
export function oakGrainDataUrl(): string {
  if (cachedDataUrl) return cachedDataUrl;
  cachedDataUrl = createOakGrainCanvas(128).toDataURL('image/png');
  return cachedDataUrl;
}

/** Deterministic 0–1 hash so the grain is stable across reloads. */
function pseudo(i: number, salt: number): number {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
