import { withAlpha, type Palette } from './palette';

/**
 * The craft's mesh, in one place so the flight and the workshop preview draw
 * the same object. The shop is a promise about how the flight will look; the
 * only way to keep that promise honest is for both to run this code.
 *
 * Modelled at the prototype's size — roughly 40 units nose to tail, centred on
 * the origin — and drawn into whatever transform the caller has set up.
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

type P = [number, number];

/**
 * The body, wings and fin, centred on the current origin. Leaves fill and
 * stroke styles dirty; callers draw exhaust and halo around this.
 */
export function drawCraftBody(ctx: CanvasRenderingContext2D, pose: CraftPose, palette: Palette): void {
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const camT = 0.5;
  const ct = Math.cos(camT);
  const st = Math.sin(camT);

  // Local frame: x right, y up, z forward. Roll, then pitch, then yaw.
  const pt = (x: number, y: number, z: number): P => {
    const x1 = x * cr + y * sr;
    const y1 = -x * sr + y * cr;
    const y2 = y1 * cp + z * sp;
    const z2 = z * cp - y1 * sp;
    const x3 = x1 * cy + z2 * sy;
    const z3 = -x1 * sy + z2 * cy;
    const k = 1 / (1 + z3 * 0.012);
    return [x3 * k, -(y2 * ct + z3 * st) * k];
  };

  const nose = pt(0, 0, 29);
  const tail = pt(0, 0, -11);
  const finTop = pt(0, 8, -9);
  const finFwd = pt(0, 1, 2);
  const wl = 21;
  const rootL = pt(-3.5, 0, 7);
  const rootLb = pt(-3.5, 0, -8);
  const tipL = pt(-wl * Math.cos(pose.wingL), wl * Math.sin(pose.wingL), -5);
  const rootR = pt(3.5, 0, 7);
  const rootRb = pt(3.5, 0, -8);
  const tipR = pt(wl * Math.cos(pose.wingR), wl * Math.sin(pose.wingR), -5);

  const wing = (root: P, rootB: P, tip: P, lift: number) => {
    const shade = 0.72 + 0.28 * Math.max(0, Math.sin(lift) + 0.4);
    ctx.fillStyle = withAlpha(palette.craft, Math.min(1, shade));
    ctx.beginPath();
    ctx.moveTo(root[0], root[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(rootB[0], rootB[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.craft, 0.45);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(root[0], root[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
  };
  // Far wing first so the near one overlaps it under bank.
  if (pose.roll >= 0) {
    wing(rootL, rootLb, tipL, pose.wingL);
    wing(rootR, rootRb, tipR, pose.wingR);
  } else {
    wing(rootR, rootRb, tipR, pose.wingR);
    wing(rootL, rootLb, tipL, pose.wingL);
  }

  ctx.fillStyle = palette.craft;
  ctx.beginPath();
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(rootR[0], rootR[1]);
  ctx.lineTo(tail[0], tail[1]);
  ctx.lineTo(rootL[0], rootL[1]);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = withAlpha(palette.craft, 0.85);
  ctx.beginPath();
  ctx.moveTo(tail[0], tail[1]);
  ctx.lineTo(finTop[0], finTop[1]);
  ctx.lineTo(finFwd[0], finFwd[1]);
  ctx.closePath();
  ctx.fill();

  // Spine and leading edges are what sell the depth on a flat shape.
  const shadow = ctx.shadowBlur;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = withAlpha(palette.trail, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(tail[0], tail[1]);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(palette.ice, 0.4);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(rootR[0], rootR[1]);
  ctx.moveTo(nose[0], nose[1]);
  ctx.lineTo(rootL[0], rootL[1]);
  ctx.stroke();
  ctx.shadowBlur = shadow;
}

/** Where the exhaust leaves the hull, for the flame the flight draws. */
export function craftTail(pose: CraftPose): P {
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const z = -11;
  const y2 = z * sp;
  const z2 = z * cp;
  const x3 = z2 * sy;
  const z3 = z2 * cy;
  const k = 1 / (1 + z3 * 0.012);
  return [x3 * k, -(y2 * Math.cos(0.5) + z3 * Math.sin(0.5)) * k];
}
