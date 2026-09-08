import { PALETTE } from './palette';
import type { LinePoint } from './types';

/**
 * The logged line, flattened into a signature: distance flown runs left to
 * right, steering position runs bottom to top. This shape is the journal
 * entry — the same drawing appears under the summary and in the journal list.
 */
export function drawMiniature(canvas: HTMLCanvasElement, line: readonly LinePoint[]): void {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.clientWidth;
  const h = rect.height || canvas.clientHeight;
  if (!w || !h) return;

  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (line.length < 3) return;

  const pad = 10;
  const z0 = line[0].z;
  const z1 = line[line.length - 1].z;
  const span = Math.max(z1 - z0, 0.0001);
  const at = (p: LinePoint) => ({
    x: pad + ((p.z - z0) / span) * (w - pad * 2),
    y: pad + (1 - Math.min(1, Math.max(0, p.nx))) * (h - pad * 2)
  });

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < line.length; i++) {
    const k = i / line.length;
    const a = at(line[i - 1]);
    const b = at(line[i]);
    ctx.globalAlpha = 0.25 + k * 0.6;
    ctx.strokeStyle = k > 0.92 ? PALETTE.trailHot : PALETTE.trail;
    ctx.lineWidth = 0.8 + k * 1.7;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // A lamp dot marks where the flight ended.
  const end = at(line[line.length - 1]);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = PALETTE.lamp;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
