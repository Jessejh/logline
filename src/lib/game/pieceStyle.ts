/**
 * What the piece is made of: the paper, the ink and the two paints.
 *
 * A style changes the material, never the reading. Every one of them has to
 * render a flight that held its line and a flight that ranged wide as two kinds
 * of finished picture, because that is the rule the piece exists to keep and a
 * style that broke it would be selling a better day rather than a different
 * paper.
 *
 * Live, like `PALETTE`: an equipped style overwrites these fields and the piece
 * reads them while drawing, so nothing has to be threaded through the screens.
 */

export interface PieceStyle {
  /** Paper on a flight taken in one breath, and on one that kept stopping. */
  cool: string;
  warm: string;
  /** The mark, as `r, g, b`. Never pure black on paper, never pure white on ink. */
  ink: string;
  /** The two paints a fast throw separates into. */
  paints: [string, string];
  /**
   * How the answer colours meet the paper. `multiply` sinks pigment into a
   * light sheet; on a dark ground it would only ever subtract its way to
   * nothing, so a dark style prints in `screen` instead.
   */
  blend: 'multiply' | 'screen';
  /** How much of the sheet's tooth shows. */
  grain: number;
  /** How much colour the ground carries at rest. */
  chroma: number;
}

export const BASE_STYLE: Readonly<PieceStyle> = {
  cool: '#e8ecef',
  warm: '#f4ecdd',
  ink: '20, 26, 34',
  paints: ['#123f6e', '#a33a2b'],
  blend: 'multiply',
  grain: 0.038,
  chroma: 0.6
};

/** The style actually drawn with. Mutated in place by `applyStyle`. */
export const STYLE: PieceStyle = { ...BASE_STYLE, paints: [...BASE_STYLE.paints] };

export function applyStyle(overrides: Partial<PieceStyle> = {}): void {
  Object.assign(STYLE, BASE_STYLE, overrides);
}

/** `r, g, b` as numbers, for mixing. */
export function inkParts(): [number, number, number] {
  const [r, g, b] = STYLE.ink.split(',').map((v) => parseFloat(v));
  return [r || 0, g || 0, b || 0];
}
