import { CRAFT_REST, drawCraftBody } from './craft';
import { BASE_PALETTE, withAlpha, type Palette } from './palette';

/**
 * A still of what a skin actually looks like, for the workshop list. Each one
 * draws the thing it changes with the renderers the flight uses, so the
 * picture beside a price is the flight's own output rather than an
 * illustration of it that can quietly go out of date.
 *
 * Takes colours, not an upgrade: `src/lib/game/` stays ignorant of what is
 * for sale, and the caller decides which palette a preview stands for.
 */

export type PreviewKind = 'craft' | 'gates' | 'sky';

const STARS = [
  [0.12, 0.22, 0.5],
  [0.31, 0.68, 0.85],
  [0.53, 0.14, 0.6],
  [0.71, 0.44, 1],
  [0.86, 0.75, 0.55],
  [0.22, 0.86, 0.7],
  [0.62, 0.9, 0.45],
  [0.94, 0.28, 0.8],
  [0.44, 0.36, 0.4],
  [0.05, 0.55, 0.65]
];

/** The same colour, its alpha multiplied and clamped. */
function scaleAlpha(color: string, by: number): string {
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return color;
  const parts = m[1].split(',').map((v) => parseFloat(v));
  const a = parts.length > 3 ? parts[3] : 1;
  return withAlpha(color, Math.min(1, a * by));
}

export function drawUpgradePreview(
  canvas: HTMLCanvasElement,
  kind: PreviewKind,
  overrides: Partial<Palette>
): void {
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

  const pal: Palette = { ...BASE_PALETTE, ...overrides };

  ctx.fillStyle = pal.void;
  ctx.fillRect(0, 0, w, h);

  // In flight the wash covers a whole screen and builds up over that distance.
  // At thumbnail size the same alphas are invisible, and a sky you cannot tell
  // from the one you already have is not worth a price tag, so the sky's own
  // preview carries the wash at the strength the flight arrives at.
  const lift = kind === 'sky' ? 4.2 : 1.6;
  const wash = ctx.createRadialGradient(w * 0.35, h * 0.4, 0, w * 0.5, h * 0.5, w * 0.9);
  wash.addColorStop(0, scaleAlpha(pal.glowA, lift));
  wash.addColorStop(0.55, scaleAlpha(pal.glowB, lift));
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // The sky is mostly what is behind everything, so its own preview leans on
  // the stars while the other two keep them faint enough to sit behind.
  const starA = kind === 'sky' ? 1 : 0.45;
  ctx.fillStyle = pal.star;
  for (const [sx, sy, mag] of STARS) {
    ctx.globalAlpha = mag * 0.75 * starA;
    ctx.beginPath();
    ctx.arc(sx * w, sy * h, (kind === 'sky' ? 1.5 : 1.1) * mag, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (kind === 'gates') drawGatePreview(ctx, w, h, pal);
  if (kind === 'craft') drawCraftPreview(ctx, w, h, pal);
}

/** One four-cell frame with its wall lit, seen straight on. */
function drawGatePreview(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  const gw = w * 0.76;
  const gh = h * 0.56;
  const x0 = (w - gw) / 2;
  const y0 = (h - gh) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, gw, gh);
  ctx.clip();

  const sheet = ctx.createLinearGradient(0, y0, 0, y0 + gh);
  sheet.addColorStop(0, withAlpha(pal.ice, 0.03));
  sheet.addColorStop(0.5, withAlpha(pal.teal, 0.12));
  sheet.addColorStop(1, withAlpha(pal.ice, 0.03));
  ctx.fillStyle = sheet;
  ctx.fillRect(x0, y0, gw, gh);

  const gap = Math.max(2.5, gh / 9);
  ctx.strokeStyle = withAlpha(pal.trailHot, 0.2);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let y = y0 + gap * 0.5; y < y0 + gh; y += gap) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + gw, y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = withAlpha(pal.ice, 0.35);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(x0 + (i * gw) / 4, y0);
    ctx.lineTo(x0 + (i * gw) / 4, y0 + gh);
  }
  ctx.stroke();

  ctx.strokeStyle = withAlpha(pal.ice, 0.85);
  ctx.lineWidth = 1.4;
  ctx.shadowColor = withAlpha(pal.ice, 0.7);
  ctx.shadowBlur = 7;
  ctx.strokeRect(x0, y0, gw, gh);
  ctx.shadowBlur = 0;
}

/** The hull at rest, banked a little so both wings and the fin show. */
function drawCraftPreview(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  ctx.save();
  ctx.translate(w / 2, h * 0.54);
  // The mesh is ~40 units nose to tail; fit it across the thumbnail.
  ctx.scale(Math.min(w / 46, h / 30), Math.min(w / 46, h / 30));
  ctx.shadowColor = pal.craftGlow;
  ctx.shadowBlur = 9;
  drawCraftBody(ctx, { ...CRAFT_REST, roll: 0.22, pitch: -0.12 }, pal);
  ctx.restore();
}
