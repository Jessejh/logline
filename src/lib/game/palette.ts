/**
 * Canvas colours. The DOM half of the app reads the same values as custom
 * properties in `src/app.css` — keep the two in step.
 *
 * `PALETTE` is live: an equipped skin overwrites its fields via `applyPalette`
 * and every canvas reads the new values on the next frame, because all three
 * renderers look colours up while drawing rather than capturing them at import.
 * Skins deliberately reach the canvas only — the screens outside the flight
 * keep the base palette so a bought skin can never make text hard to read.
 */

export interface Palette {
  void: string;
  deep: string;
  teal: string;
  ice: string;
  lamp: string;
  violet: string;
  trail: string;
  trailHot: string;
  craft: string;
  star: string;
  label: string;
  /** The craft's halo. */
  craftGlow: string;
  /** The two stops of the wash behind everything, nearest first. */
  glowA: string;
  glowB: string;
}

export const BASE_PALETTE: Readonly<Palette> = {
  void: '#050810',
  deep: '#0c1228',
  teal: '#2d6b7a',
  ice: '#a8d5d8',
  lamp: '#e8b87a',
  violet: '#7b6b9a',
  trail: '#4a8fa0',
  trailHot: '#6dc0d0',
  craft: '#d8eef2',
  star: '#c8dde0',
  label: '#8fb8c2',
  craftGlow: 'rgba(108,192,208,0.9)',
  glowA: 'rgba(123,107,154,0.06)',
  glowB: 'rgba(45,107,122,0.04)'
};

/** The colours actually drawn with. Mutated in place by `applyPalette`. */
export const PALETTE: Palette = { ...BASE_PALETTE };

/** Reset to base, then lay the given overrides on top. */
export function applyPalette(overrides: Partial<Palette> = {}): void {
  Object.assign(PALETTE, BASE_PALETTE, overrides);
}

/**
 * The same colour at a given alpha. Lets the canvas keep its per-element
 * fades while the underlying hue comes from whatever skin is equipped,
 * instead of the fades being frozen into hardcoded rgba literals.
 * Accepts `#rgb`, `#rrggbb` and `rgb()/rgba()`; anything else is returned
 * unchanged rather than throwing mid-frame.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    if (full.length !== 6) return color;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return color;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return color;
  const [r, g, b] = m[1].split(',').map((v) => parseFloat(v));
  if ([r, g, b].some((v) => Number.isNaN(v))) return color;
  return `rgba(${r},${g},${b},${a})`;
}
