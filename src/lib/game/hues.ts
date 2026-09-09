/**
 * The colours a gate offers, and where they come from.
 *
 * Two rules shape every one of these.
 *
 * **Within a gate, the four are identical in weight.** Same lightness, same
 * chroma, differing only in hue angle. The four cells of a gate are the choice
 * a player is actually making, so if one of them were the prettier colour the
 * app would be paying for an answer in the only currency this design cannot
 * hand out. Between gates the weight may drift — nobody chooses between two
 * gates — and it has to, because sRGB will not give every hue the same chroma
 * at the same lightness.
 *
 * **Which cell holds which colour is random, every gate, every flight.** Fixed
 * hues per column meant "Deep sleep is the teal one" was learnable, and anyone
 * who wanted teal in their picture had a reason to sleep well on paper. Random
 * assignment removes the reason rather than balancing it: there is nothing to
 * learn, so there is nothing to farm. The cost is that the piece's ground no
 * longer says *which* answer was taken — see `docs/DESIGN.md`.
 *
 * The character of the set rides how the flight is going, not what it answers:
 * a flight that keeps stopping draws four neighbours, quiet and close; one
 * taken fast and without pause throws them across the wheel.
 */

const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

function labToRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const a = C * Math.cos((hDeg * Math.PI) / 180);
  const b = C * Math.sin((hDeg * Math.PI) / 180);
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (108 / 841) * (t - 4 / 29));
  const X = inv(fx) * Xn;
  const Y = inv(fy) * Yn;
  const Z = inv(fz) * Zn;
  return [
    X * 3.2406 + Y * -1.5372 + Z * -0.4986,
    X * -0.9689 + Y * 1.8758 + Z * 0.0415,
    X * 0.0557 + Y * -0.204 + Z * 1.057
  ];
}

function inGamut(L: number, C: number, h: number): boolean {
  return labToRgb(L, C, h).every((v) => v >= -0.001 && v <= 1.001);
}

/** The most chroma this hue can hold at this lightness and still be a colour. */
function reach(L: number, h: number): number {
  let lo = 0;
  let hi = 150;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, mid, h)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function hex(L: number, C: number, h: number): string {
  const gamma = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return (
    '#' +
    labToRgb(L, C, h)
      .map((c) => Math.round(gamma(c) * 255)
        .toString(16)
        .padStart(2, '0'))
      .join('')
  );
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * `wild` is 0 for a flight that keeps stopping and 1 for one taken fast and
 * unbroken. It decides how far apart the four sit and how loud they are; it
 * never decides which cell gets which.
 */
export function gateHues(
  cells: number,
  wild: number,
  base: number,
  rnd: () => number = Math.random
): string[] {
  const w = clamp01(wild);
  // Four neighbours when calm, a wide fan when not. Kept narrower than the
  // whole wheel because the flight also turns this base between gates: eight
  // gates each dealing independently from the full circle put every hue on the
  // piece at once, and eight unrelated hues multiplied into one sheet come out
  // grey. A family, turning as the flight goes on, stays colour.
  const spread = 18 + 72 * w;
  // Quiet colours sit a little lighter; loud ones carry more of their own dark.
  const L = 71 - 7 * w;

  const angles: number[] = [];
  for (let i = 0; i < cells; i++) {
    const at = cells === 1 ? 0.5 : i / (cells - 1);
    angles.push((base + (at - 0.5) * spread + 360) % 360);
  }

  // One chroma for all four, and it has to be one every one of them can hold.
  const want = 32 + 30 * w;
  const ceiling = Math.min(...angles.map((h) => reach(L, h)));
  const C = Math.min(want, ceiling * 0.95);

  const out = angles.map((h) => hex(L, C, h));

  // Fisher-Yates, so the cell that holds a colour is not the cell that earned it.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
