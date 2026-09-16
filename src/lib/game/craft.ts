import { withAlpha, type Palette } from './palette';

/**
 * The craft's mesh, in one place so the flight and the workshop preview draw
 * the same object. The shop is a promise about how the flight will look; the
 * only way to keep that promise honest is for both to run this code.
 *
 * A paper biplane: two long folded wings braced apart by struts and wires,
 * on a dart of a body. Every surface is a flat facet with a crease down it and
 * a hard edge — the shape is folded, never moulded, which is what keeps it
 * reading as paper rather than as an aircraft. Nothing here is curved.
 *
 * Why two wings. One wing gave the craft a single silhouette that said very
 * little about which way it was banking until the bank was already large. A
 * stacked pair shears as it rolls — the upper wing slides across the lower one
 * — so the smallest input has something visible to move, which is most of what
 * makes a control feel connected. The struts between them are the part that
 * shears, and they cost four lines.
 *
 * Modelled nose-forward on the origin, roughly 43 units nose to tail, and
 * drawn into whatever transform the caller has set up.
 */

export interface CraftPose {
  roll: number;
  pitch: number;
  yaw: number;
  /** Hinge angle of each wing, radians above level. */
  wingL: number;
  wingR: number;
}

export const CRAFT_REST: CraftPose = { roll: 0, pitch: 0, yaw: 0, wingL: 0.18, wingR: 0.18 };

/**
 * Half the span of the widest wing, and the nose-to-tail length, in model
 * units. Callers fit the mesh into a box with these rather than with a
 * hardcoded guess, so lengthening a wing cannot quietly crop it out of a
 * workshop thumbnail.
 */
export const CRAFT_SPAN = 30;
export const CRAFT_LENGTH = 43;

type P = [number, number];

/** Where the body ends, front and back. */
const NOSE_Z = 31;
const TAIL_Z = -12;
/** Where a wing is hinged, out from the centre line. */
const ROOT_X = 3.6;
/** Half-span of each wing, hinge included. */
const LOWER_SPAN = 28;
const UPPER_SPAN = 30;
/** How high the upper wing is carried, and how far forward it is staggered. */
const UPPER_Y = 11.5;

/**
 * The upper wing is braced against the lower one by four struts, so it cannot
 * flex anything like as far. Tying it to the same hinge angle at a fraction of
 * the travel is what makes the pair read as one braced structure instead of as
 * two wings that happen to be stacked.
 */
function braced(hinge: number): number {
  return 0.03 + hinge * 0.7;
}

/** The pose's rotation and projection, as one function of model space. */
function projector(pose: CraftPose): (x: number, y: number, z: number) => P {
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  // The camera rides above and behind, which is the whole reason the wings
  // show their bank at all.
  const camT = 0.5;
  const ct = Math.cos(camT);
  const st = Math.sin(camT);

  // Local frame: x right, y up, z forward. Roll, then pitch, then yaw.
  return (x: number, y: number, z: number): P => {
    const x1 = x * cr + y * sr;
    const y1 = -x * sr + y * cr;
    const y2 = y1 * cp + z * sp;
    const z2 = z * cp - y1 * sp;
    const x3 = x1 * cy + z2 * sy;
    const z3 = -x1 * sy + z2 * cy;
    const k = 1 / (1 + z3 * 0.012);
    return [x3 * k, -(y2 * ct + z3 * st) * k];
  };
}

/**
 * A point on one wing: `d` out along the hinged span from the root, at depth
 * `z`. Both wings and both struts are laid out through this, so a wing folding
 * up carries everything attached to it.
 */
function span(
  pt: (x: number, y: number, z: number) => P,
  side: number,
  hinge: number,
  rootY: number,
  d: number,
  z: number
): P {
  return pt(side * (ROOT_X + d * Math.cos(hinge)), rootY + d * Math.sin(hinge), z);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * One folded wing: a tapered, swept quad creased along its length. The crease
 * splits it into a leading facet and a trailing one at different weights,
 * which is the fold — a single flat tone reads as a cut-out.
 */
function drawWing(
  ctx: CanvasRenderingContext2D,
  pt: (x: number, y: number, z: number) => P,
  palette: Palette,
  side: number,
  hinge: number,
  rootY: number,
  length: number,
  chord: { rootF: number; rootB: number; tipF: number; tipB: number },
  weight: number
): void {
  const at = (u: number, z: number) => span(pt, side, hinge, rootY, u * length, z);
  const rootF = at(0, chord.rootF);
  const rootB = at(0, chord.rootB);
  const tipF = at(1, chord.tipF);
  const tipB = at(1, chord.tipB);
  const creaseRoot = at(0, (chord.rootF + chord.rootB) / 2);
  const creaseTip = at(1, (chord.tipF + chord.tipB) / 2);

  // Lit from above and ahead: a wing folded up catches more, one folded down
  // turns away. Small, because the read has to survive any equipped skin.
  const lit = 0.74 + 0.26 * Math.max(0, Math.min(1, 0.5 + Math.sin(hinge) * 1.2));

  const facet = (a: P, b: P, c: P, d: P, alpha: number) => {
    ctx.fillStyle = withAlpha(palette.craft, Math.min(1, alpha * lit * weight));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  };
  facet(rootF, tipF, creaseTip, creaseRoot, 1);
  facet(creaseRoot, creaseTip, tipB, rootB, 0.72);

  const shadow = ctx.shadowBlur;
  ctx.shadowBlur = 0;
  // The leading edge is the hard one; the crease is a fold, so it is fainter.
  ctx.strokeStyle = withAlpha(palette.ice, 0.5 * weight);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(rootF[0], rootF[1]);
  ctx.lineTo(tipF[0], tipF[1]);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(palette.trail, 0.4 * weight);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(creaseRoot[0], creaseRoot[1]);
  ctx.lineTo(creaseTip[0], creaseTip[1]);
  ctx.stroke();
  ctx.shadowBlur = shadow;
}

const LOWER_CHORD = { rootF: 7, rootB: -9, tipF: -2.5, tipB: -10 };
const UPPER_CHORD = { rootF: 13, rootB: -2, tipF: 4, tipB: -3.5 };

/**
 * The body, both wings, the struts between them and the tail, centred on the
 * current origin. Leaves fill and stroke styles dirty; callers draw exhaust,
 * wake and halo around this.
 */
export function drawCraftBody(ctx: CanvasRenderingContext2D, pose: CraftPose, palette: Palette): void {
  const pt = projector(pose);
  const lowerL = pose.wingL;
  const lowerR = pose.wingR;
  const upperL = braced(pose.wingL);
  const upperR = braced(pose.wingR);
  const lowerLen = LOWER_SPAN - ROOT_X;
  const upperLen = UPPER_SPAN - ROOT_X;

  const nose = pt(0, 0, NOSE_Z);
  const tail = pt(0, 0, TAIL_Z);
  const shoulderL = pt(-ROOT_X, 0, 7);
  const shoulderR = pt(ROOT_X, 0, 7);
  const hipL = pt(-ROOT_X, 0, -9);
  const hipR = pt(ROOT_X, 0, -9);

  const lower = (side: number, hinge: number) =>
    drawWing(ctx, pt, palette, side, hinge, 0, lowerLen, LOWER_CHORD, 0.92);
  const upper = (side: number, hinge: number) =>
    drawWing(ctx, pt, palette, side, hinge, UPPER_Y, upperLen, UPPER_CHORD, 1);

  // Far side first so the near one overlaps it under bank. The lower pair goes
  // down before the body, the upper pair after it: seen from above, the top
  // wing lies over the fuselage and the bottom one under it, and drawing them
  // in that order is the only thing saying which is which.
  if (pose.roll >= 0) {
    lower(-1, lowerL);
    lower(1, lowerR);
  } else {
    lower(1, lowerR);
    lower(-1, lowerL);
  }

  // The body: a folded dart, two facets either side of the centre crease. The
  // difference between them is small and is doing all the work of saying the
  // shape has a ridge rather than being a flat diamond.
  const half = (shoulder: P, hip: P, alpha: number) => {
    ctx.fillStyle = withAlpha(palette.craft, alpha);
    ctx.beginPath();
    ctx.moveTo(nose[0], nose[1]);
    ctx.lineTo(shoulder[0], shoulder[1]);
    ctx.lineTo(hip[0], hip[1]);
    ctx.lineTo(tail[0], tail[1]);
    ctx.closePath();
    ctx.fill();
  };
  // Under bank the rising side turns its face to the light.
  const leanL = 0.88 + 0.12 * Math.max(0, Math.min(1, 0.5 - pose.roll));
  const leanR = 0.88 + 0.12 * Math.max(0, Math.min(1, 0.5 + pose.roll));
  half(shoulderL, hipL, Math.min(1, leanL));
  half(shoulderR, hipR, Math.min(1, leanR));

  // Tailplane and fin: the paper dart's own tail, folded down flat.
  const stabL = pt(-9, 1.5, -10.5);
  const stabR = pt(9, 1.5, -10.5);
  const stabRoot = pt(0, 1.5, -3);
  ctx.fillStyle = withAlpha(palette.craft, 0.7);
  ctx.beginPath();
  ctx.moveTo(stabRoot[0], stabRoot[1]);
  ctx.lineTo(stabL[0], stabL[1]);
  ctx.lineTo(tail[0], tail[1]);
  ctx.lineTo(stabR[0], stabR[1]);
  ctx.closePath();
  ctx.fill();

  const finTop = pt(0, 8, -10);
  const finFwd = pt(0, 1, 1);
  ctx.fillStyle = withAlpha(palette.craft, 0.85);
  ctx.beginPath();
  ctx.moveTo(tail[0], tail[1]);
  ctx.lineTo(finTop[0], finTop[1]);
  ctx.lineTo(finFwd[0], finFwd[1]);
  ctx.closePath();
  ctx.fill();

  const shadow = ctx.shadowBlur;
  ctx.shadowBlur = 0;

  // Struts and wires. Cabane struts carry the upper wing off the body; an
  // interplane strut and a crossed wire hold the pair apart outboard. These
  // are what shear as the craft rolls, and they are four lines.
  const strut = (a: P, b: P, alpha: number, width: number) => {
    ctx.strokeStyle = withAlpha(palette.ice, alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const bay = (side: number, hinge: number, up: number) => {
    const u = 0.62;
    const lowF = span(pt, side, hinge, 0, lowerLen * u, lerp(LOWER_CHORD.rootF, LOWER_CHORD.tipF, u));
    const lowB = span(pt, side, hinge, 0, lowerLen * u, lerp(LOWER_CHORD.rootB, LOWER_CHORD.tipB, u));
    const upF = span(pt, side, up, UPPER_Y, upperLen * u, lerp(UPPER_CHORD.rootF, UPPER_CHORD.tipF, u));
    const upB = span(pt, side, up, UPPER_Y, upperLen * u, lerp(UPPER_CHORD.rootB, UPPER_CHORD.tipB, u));
    const cabLow = pt(side * ROOT_X, 0, 4);
    const cabUp = span(pt, side, up, UPPER_Y, 0, UPPER_CHORD.rootB + 3);
    strut(cabLow, cabUp, 0.4, 0.8);
    strut(lowF, upF, 0.42, 0.8);
    strut(lowB, upB, 0.3, 0.6);
    strut(lowF, upB, 0.16, 0.5);
  };
  bay(-1, lowerL, upperL);
  bay(1, lowerR, upperR);
  ctx.shadowBlur = shadow;

  if (pose.roll >= 0) {
    upper(-1, upperL);
    upper(1, upperR);
  } else {
    upper(1, upperR);
    upper(-1, upperL);
  }

  // The spine is what sells the depth on a flat shape, so it goes on last,
  // over everything the upper wing just covered.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = withAlpha(palette.trail, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(tail[0], tail[1]);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(palette.ice, 0.45);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(shoulderR[0], shoulderR[1]);
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(shoulderL[0], shoulderL[1]);
  ctx.stroke();
  ctx.shadowBlur = shadow;
}

/** Where the exhaust leaves the hull, for the flame the flight draws. */
export function craftTail(pose: CraftPose): P {
  return projector(pose)(0, 0, TAIL_Z);
}

/**
 * The four wingtips, upper pair first, for the vortices the flight streams off
 * them. Model space, so the caller scales them the same way it scales the body.
 */
export function craftTips(pose: CraftPose): [P, P, P, P] {
  const pt = projector(pose);
  const lowerLen = LOWER_SPAN - ROOT_X;
  const upperLen = UPPER_SPAN - ROOT_X;
  const chord = (c: { tipF: number; tipB: number }) => (c.tipF + c.tipB) / 2;
  return [
    span(pt, -1, braced(pose.wingL), UPPER_Y, upperLen, chord(UPPER_CHORD)),
    span(pt, 1, braced(pose.wingR), UPPER_Y, upperLen, chord(UPPER_CHORD)),
    span(pt, -1, pose.wingL, 0, lowerLen, chord(LOWER_CHORD)),
    span(pt, 1, pose.wingR, 0, lowerLen, chord(LOWER_CHORD))
  ];
}
