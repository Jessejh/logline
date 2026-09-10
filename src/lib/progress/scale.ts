/**
 * Where an answer sat on its question's scale, as one colour.
 *
 * ## Why this is not red-to-green
 *
 * Red and green would say *bad* and *good*, and nothing here is allowed to say
 * that. It is not squeamishness: the journal is only worth keeping if the
 * answers in it are honest, and an encoding that calls one end of a scale the
 * better end is an argument to give that answer tomorrow. "Sore" to "Alive" is
 * a real axis, but which end anyone wants to be at on a given day is theirs to
 * decide, not the app's to colour in.
 *
 * So this is a **sequential ramp in one hue** — the standard encoding for
 * magnitude, and the only kind that carries no verdict. Four steps rising in
 * lightness against the near-black screen, all at hue 207°, the app's own teal.
 * Lighter means further along the scale, never better; the two ends of every
 * calendar are labelled in the question's own words, so the reader supplies the
 * meaning.
 *
 * The labels are what finish the job. Lighter is "Deep" under one question and
 * "Restless" under another — desirable in the first and not obviously so in the
 * second — so brightness cannot settle into meaning *good* across the screen.
 *
 * ## Why these four values
 *
 * Solved, not picked, and then checked. Lightness is monotonic — L* 41, 60, 78,
 * 95 — which is what makes the ramp readable as an order at all. Adjacent steps
 * are at worst ΔE 15.6 apart for normal vision and 13.7 under protanopia, so no
 * two are confusable; and the darkest still holds 3.22:1 against the background,
 * which is what keeps a low answer plainly a filled cell rather than an empty
 * one.
 */

/** Low end of the scale to high end. One hue, rising lightness. */
const RAMP = ['#156b72', '#339ea8', '#89ccd3', '#dbf6f8'];

/** Ink that reads on a given step: the two light ones need dark text. */
const DARK_INK = '#08272b';
const LIGHT_INK = '#cfeef2';

function lerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const mix = (shift: number) =>
    Math.round((((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t));
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

/** 0..1 for a column index on a scale of `steps` columns. */
function position(ix: number, steps: number): number {
  if (steps <= 1) return 0;
  return Math.max(0, Math.min(1, ix / (steps - 1)));
}

/**
 * The colour for a column index. Every question is four columns wide, which
 * lands on the four steps exactly; a wider scale samples between them rather
 * than inventing a step.
 */
export function scaleColor(ix: number, steps: number): string {
  const at = position(ix, steps) * (RAMP.length - 1);
  const low = Math.floor(at);
  const high = Math.min(RAMP.length - 1, low + 1);
  if (low === high) return RAMP[low];
  return lerp(RAMP[low], RAMP[high], at - low);
}

export function scaleInk(ix: number, steps: number): string {
  return position(ix, steps) >= 0.5 ? DARK_INK : LIGHT_INK;
}

/** The whole ramp, low to high — for a legend. */
export function scaleSwatches(steps: number): string[] {
  return Array.from({ length: steps }, (_, i) => scaleColor(i, steps));
}
