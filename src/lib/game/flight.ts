import { PALETTE } from './palette';
import { QUESTIONS } from './questions';
import type { Answer, FlightResult, LinePoint, Question } from './types';
import { visibleHeight, visibleWidth } from '../viewport';

/**
 * The grading phase: one first-person flight through eight question-gates.
 *
 * Ported from `prototypes/grading-phase.html`. The steering constants below
 * are the prototype's, deliberately unchanged — they are the feel reference.
 * Where this file has since moved away from the prototype (hold-to-fly, the
 * trail drawn behind the craft, the mirror, the winged craft) is listed in
 * `docs/DESIGN.md` under "Divergences from the prototype".
 *
 * Nothing here scores the player: which cell you pass through decides what
 * the record says, never how well you did.
 */

const FOCAL = 7;
const SPEED = 3.45;
const SPACING = 13.5;
const FIRST_GATE = 17;

/**
 * Screen px of steering per px of thumb travel. Above 1 so a comfortable
 * thumb arc covers the whole grid without stretching for the far corners;
 * low enough that the craft still reads as following the finger.
 */
const STEER_GAIN = 1.35;
/**
 * How big the craft is drawn. The mesh is modelled at the prototype's size;
 * this brings it closer to the camera so it is legible at arm's length.
 */
const CRAFT_SCALE = 1.5;

/** How long a passed gate is kept around — the mirror watches it recede. */
const KEEP_BEHIND = 48;
/** Depth compression of the trail behind the craft in the main view. */
const TRAIL_K = 0.55;
/** How far the trail can come toward the camera before it has faded out. */
const TRAIL_REACH = FOCAL * 0.74;
/** Camera height above the flight plane, in screen px at the craft's depth. */
const CAM_UP = 150;
/** How far ahead the aim is simulated, in seconds. Steering settles well before. */
const AIM_HORIZON = 2.0;

/** World distance of gate `i` from the start of the flight. */
export function gateZ(i: number): number {
  return FIRST_GATE + i * SPACING;
}

interface Gate {
  q: Question;
  /** Fixed world position; `dist` is recomputed from it every frame. */
  z: number;
  dist: number;
  done: boolean;
  pick: { ix: number; iy: number } | null;
  flash: number;
}

interface Star {
  wx: number;
  wy: number;
  d: number;
  s: number;
}

interface Pop {
  text: string;
  x: number;
  y: number;
  t: number;
  edge: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  edge: boolean;
}

interface Aim {
  gate: Gate | null;
  /** Screen position the craft will hold when it reaches the gate. */
  x: number;
  y: number;
  ix: number;
  iy: number;
  /** The simulated path from here to there, with depth ahead of the craft. */
  path: { x: number; y: number; d: number }[];
}

export interface FlightHandlers {
  /** Called when the visible prompt changes; null hides it. */
  onQuestion(text: string | null): void;
  /** Called once, shortly after the last gate is passed. */
  onComplete(result: FlightResult): void;
  /** Called when the thumb goes down or lifts. The craft only moves while held. */
  onHold?(held: boolean): void;
}

export class Flight {
  private readonly cvs: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly handlers: FlightHandlers;

  private W = 0;
  private H = 0;
  private DPR = 1;
  private GW = 0;
  private GH = 0;
  private CX = 0;
  private CY = 0;
  private safeTop = 0;
  private mirror = { x: 0, y: 0, w: 0, h: 0 };
  private fontFamily = 'system-ui, sans-serif';

  private plane = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: 0,
    /** Hinge angle of each wing, radians above level, and its rate. */
    wingL: 0.1,
    wingR: 0.1,
    wingLv: 0,
    wingRv: 0
  };
  private held = false;
  private pointerId: number | null = null;
  /** Where the thumb went down, and where the craft was aimed at the time. */
  private grabX = 0;
  private grabY = 0;
  private grabTx = 0;
  private grabTy = 0;
  /** Last seen thumb position, so a resize can re-anchor without a jump. */
  private lastPx = 0;
  private lastPy = 0;
  private loggedLine: LinePoint[] = [];
  private lastLoggedZ = -1;
  private gates: Gate[] = [];
  private stars: Star[] = [];
  private pops: Pop[] = [];
  private sparks: Spark[] = [];
  private answers: Answer[] = [];
  private aim: Aim = { gate: null, x: 0, y: 0, ix: 0, iy: 0, path: [] };

  private zDist = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private finished = false;
  private shownQuestion: string | null = null;
  private readonly reduced: boolean;

  private readonly onResize = () => {
    this.layout();
    this.clampPlane();
    // A rotation, or chrome sliding in and out, moves the grid out from under
    // the thumb. Re-anchor on the spot so the next drag carries on from where
    // the craft now is rather than snapping by the difference.
    this.grabX = this.lastPx;
    this.grabY = this.lastPy;
    this.grabTx = this.plane.tx;
    this.grabTy = this.plane.ty;
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    if (!this.running || this.finished) return;
    if (this.pointerId !== null && this.pointerId !== e.pointerId) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.cvs.setPointerCapture(e.pointerId);
    } catch {
      /* not every browser hands out capture for touch; tracking still works */
    }
    this.setHeld(true);
    this.anchor(e);
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.running || this.finished) return;
    if (this.pointerId !== null && this.pointerId !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) return;
    e.preventDefault();
    this.steerTo(e);
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (this.pointerId !== null && this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.setHeld(false);
  };

  constructor(canvas: HTMLCanvasElement, handlers: FlightHandlers) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.cvs = canvas;
    this.ctx = ctx;
    this.handlers = handlers;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  start(): void {
    this.layout();
    this.reset();
    this.cvs.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.cvs.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.cvs.addEventListener('pointerup', this.onPointerUp);
    this.cvs.addEventListener('pointercancel', this.onPointerUp);
    addEventListener('resize', this.onResize);
    // Chrome sliding in and out resizes the visual viewport without firing a
    // window resize, so the canvas would keep the stale height.
    visualViewport?.addEventListener('resize', this.onResize);
    this.running = true;
    this.last = performance.now();
    this.handlers.onHold?.(false);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.cvs.removeEventListener('pointerdown', this.onPointerDown);
    this.cvs.removeEventListener('pointermove', this.onPointerMove);
    this.cvs.removeEventListener('pointerup', this.onPointerUp);
    this.cvs.removeEventListener('pointercancel', this.onPointerUp);
    removeEventListener('resize', this.onResize);
    visualViewport?.removeEventListener('resize', this.onResize);
  }

  /* ── input ── */

  /**
   * Steering is relative to where the thumb went down, not to where it is.
   *
   * The prototype set the target to the touch point outright, which meant a
   * touch anywhere but under the craft threw it across the screen — press near
   * the top edge and it warped up there. Anchoring instead means putting a
   * thumb down changes nothing, and the craft turns only as far as the thumb
   * travels. It also frees the player to reach from wherever the hand already
   * is, which absolute steering never allowed.
   */
  private anchor(e: PointerEvent): void {
    this.grabX = this.lastPx = e.clientX;
    this.grabY = this.lastPy = e.clientY;
    this.grabTx = this.plane.tx;
    this.grabTy = this.plane.ty;
  }

  private steerTo(e: PointerEvent): void {
    this.lastPx = e.clientX;
    this.lastPy = e.clientY;
    const rawX = this.grabTx + (e.clientX - this.grabX) * STEER_GAIN;
    const rawY = this.grabTy + (e.clientY - this.grabY) * STEER_GAIN;
    const mx = this.GW / 2 - 10;
    const my = this.GH / 2 - 10;
    const x = Math.max(this.CX - mx, Math.min(this.CX + mx, rawX));
    const y = Math.max(this.CY - my, Math.min(this.CY + my, rawY));

    // Drag past an edge and the overshoot is folded back into the anchor, so
    // the craft picks the thumb up again the instant it turns around instead
    // of lagging by however far it was pushed into the wall.
    this.grabX += (rawX - x) / STEER_GAIN;
    this.grabY += (rawY - y) / STEER_GAIN;

    this.plane.tx = x;
    this.plane.ty = y;
  }

  private setHeld(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    if (held) {
      // A small flap as the wings take the load.
      this.plane.wingLv += 1.6;
      this.plane.wingRv += 1.6;
    }
    this.handlers.onHold?.(held);
  }

  /* ── layout ── */

  private layout(): void {
    this.DPR = Math.min(devicePixelRatio || 1, 2.5);
    // The visual viewport, not the layout one: with a URL bar showing the two
    // differ by the height of the bar, and drawing to the larger of them puts
    // the mirror and the question underneath it.
    this.W = visibleWidth();
    this.H = visibleHeight();
    this.cvs.width = Math.round(this.W * this.DPR);
    this.cvs.height = Math.round(this.H * this.DPR);
    this.cvs.style.width = `${this.W}px`;
    this.cvs.style.height = `${this.H}px`;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.GW = Math.min(this.W * 0.86, 420);
    this.GH = Math.min(this.GW * 0.86, this.H * 0.4);
    this.CX = this.W / 2;
    this.CY = this.H * 0.44;
    const root = getComputedStyle(document.documentElement);
    this.safeTop = parseFloat(root.getPropertyValue('--app-inset')) || 0;
    this.fontFamily = getComputedStyle(document.body).fontFamily || this.fontFamily;

    // The mirror hangs from the top edge, the way one hangs from a windscreen.
    const mw = Math.min(this.W * 0.42, 176);
    const mh = Math.round(mw * 0.33);
    this.mirror = { x: this.CX - mw / 2, y: this.safeTop + 10, w: mw, h: mh };
  }

  private reset(): void {
    const p = this.plane;
    p.x = p.tx = this.CX;
    p.y = p.ty = this.CY;
    p.vx = p.vy = 0;
    p.roll = p.pitch = p.yaw = 0;
    p.throttle = 0;
    p.wingL = p.wingR = 0.1;
    p.wingLv = p.wingRv = 0;
    this.held = false;
    this.pointerId = null;
    this.grabX = this.grabTx = p.tx;
    this.grabY = this.grabTy = p.ty;
    this.loggedLine = [];
    this.lastLoggedZ = -1;
    this.answers = [];
    this.pops = [];
    this.sparks = [];
    this.zDist = 0;
    this.time = 0;
    this.finished = false;
    this.shownQuestion = null;
    this.gates = QUESTIONS.map((q, i) => ({
      q,
      z: gateZ(i),
      dist: gateZ(i),
      done: false,
      pick: null,
      flash: 0
    }));
    this.stars = [];
    const n = this.reduced ? 80 : 220;
    for (let i = 0; i < n; i++) {
      this.stars.push({
        wx: (Math.random() - 0.5) * this.W * 3,
        wy: (Math.random() - 0.5) * this.H * 3,
        d: Math.random() * 40 + 0.5,
        s: Math.random() * 0.6 + 0.4
      });
    }
  }

  private clampPlane(): void {
    const mx = this.GW / 2 - 10;
    const my = this.GH / 2 - 10;
    this.plane.tx = Math.max(this.CX - mx, Math.min(this.CX + mx, this.plane.tx));
    this.plane.ty = Math.max(this.CY - my, Math.min(this.CY + my, this.plane.ty));
  }

  /* ── the gate frame, in both directions ── */

  private toNorm(x: number, y: number): { nx: number; ny: number } {
    return {
      nx: (x - (this.CX - this.GW / 2)) / this.GW,
      ny: (y - (this.CY - this.GH / 2)) / this.GH
    };
  }

  private fromNorm(nx: number, ny: number): { x: number; y: number } {
    return {
      x: this.CX - this.GW / 2 + nx * this.GW,
      y: this.CY - this.GH / 2 + ny * this.GH
    };
  }

  private proj(d: number): number {
    return FOCAL / (FOCAL + Math.max(d, -3.5));
  }

  private cellAt(g: Gate, x: number, y: number): { ix: number; iy: number } {
    const nx = g.q.cols.length;
    const ny = g.q.type === '2d' ? (g.q.rows?.length ?? 1) : 1;
    const { nx: rx, ny: ry } = this.toNorm(x, y);
    return {
      ix: Math.max(0, Math.min(nx - 1, Math.floor(rx * nx))),
      iy: Math.max(0, Math.min(ny - 1, Math.floor(ry * ny)))
    };
  }

  /* ── update ── */

  private update(dt: number): void {
    const p = this.plane;
    this.time += dt;

    // Forward motion is the thumb: down to fly, up to hover and think. Once
    // the last answer is in, the craft glides out on its own.
    const auto = this.answers.length === QUESTIONS.length;
    const want = this.held || auto ? 1 : 0;
    p.throttle += (want - p.throttle) * (want > p.throttle ? 4.5 : 3.4) * dt;
    if (Math.abs(want - p.throttle) < 0.004) p.throttle = want;
    const speed = SPEED * p.throttle;

    const ovy = p.vy;
    p.vx += (p.tx - p.x) * 30 * dt;
    p.vy += (p.ty - p.y) * 30 * dt;
    const damp = Math.exp(-7.2 * dt);
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const ay = (p.vy - ovy) / dt;

    // Orientation is read off velocity: bank on x, stretch on y. That is the
    // whole 3D read — there is no horizon to anchor it against.
    const tRoll = Math.max(-0.65, Math.min(0.65, p.vx * 0.0028));
    const tPitch = Math.max(-0.45, Math.min(0.45, -p.vy * 0.0022));
    const tYaw = Math.max(-0.5, Math.min(0.5, p.vx * 0.0016));
    const prevRoll = p.roll;
    p.roll += (tRoll - p.roll) * 6 * dt;
    p.pitch += (tPitch - p.pitch) * 6 * dt;
    p.yaw += (tYaw - p.yaw) * 5 * dt;
    this.wings(dt, ay, (p.roll - prevRoll) / dt);

    this.zDist += speed * dt;

    // The record only grows while the craft moves; hovering leaves no mark.
    if (this.zDist - this.lastLoggedZ > 0.004) {
      const { nx, ny } = this.toNorm(p.x, p.y);
      this.loggedLine.push({ nx, ny, z: this.zDist });
      this.lastLoggedZ = this.zDist;
    }

    for (const s of this.stars) {
      s.d -= speed * dt * 1.2;
      if (s.d < 0.3) {
        s.d = 40;
        s.wx = (Math.random() - 0.5) * this.W * 3;
        s.wy = (Math.random() - 0.5) * this.H * 3;
      }
    }

    for (const g of this.gates) {
      const prev = g.dist;
      g.dist = g.z - this.zDist;
      if (g.flash > 0) g.flash -= dt * 1.7;
      if (!g.done && prev > 0 && g.dist <= 0) this.capture(g);
    }
    this.gates = this.gates.filter((g) => g.dist > -KEEP_BEHIND);

    for (const pop of this.pops) pop.t += dt;
    this.pops = this.pops.filter((pop) => pop.t < 2.3);

    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.exp(-2.4 * dt);
      s.vy *= Math.exp(-2.4 * dt);
    }
    this.sparks = this.sparks.filter((s) => s.t < 1.1);

    this.updateAim();

    const lastGate = this.gates[this.gates.length - 1];
    if (!this.finished && auto && (!lastGate || lastGate.dist < -3.4)) {
      this.finished = true;
      this.setHeld(false);
      this.setQuestion(null);
      const result: FlightResult = { answers: this.answers.slice(), line: this.loggedLine.slice() };
      setTimeout(() => this.handlers.onComplete(result), 700);
    }
  }

  /**
   * Each wing is a stiff hinge at the body. Lift bends both up, rolling
   * bends the dropping wing up and the rising one down, and power opens
   * the dihedral a little. Hovering lets them settle and breathe.
   */
  private wings(dt: number, ay: number, rollRate: number): void {
    const p = this.plane;
    const load = Math.max(-0.3, Math.min(0.5, -ay * 0.00035));
    const rest = 0.08 + p.throttle * 0.14 + (1 - p.throttle) * Math.sin(this.time * 2.2) * 0.04;
    const asym = Math.max(-0.3, Math.min(0.3, rollRate * 0.22));
    const k = 90;
    const c = 9;
    const tl = rest + load - asym;
    const tr = rest + load + asym;
    p.wingLv += ((tl - p.wingL) * k - p.wingLv * c) * dt;
    p.wingRv += ((tr - p.wingR) * k - p.wingRv * c) * dt;
    p.wingL += p.wingLv * dt;
    p.wingR += p.wingRv * dt;
  }

  /**
   * Where the craft will be when the next gate arrives, found by running the
   * same steering forward with the thumb held still. This drives both the
   * projected line and the lit cell on the gate.
   */
  private updateAim(): void {
    const p = this.plane;
    const gate = this.gates.filter((g) => !g.done && g.dist > -0.2).sort((a, b) => a.dist - b.dist)[0] ?? null;
    const horizon = gate ? Math.max(0.05, gate.dist / SPEED) : 1.2;
    const simT = Math.min(horizon, AIM_HORIZON);
    const step = 1 / 60;
    let x = p.x;
    let y = p.y;
    let vx = p.vx;
    let vy = p.vy;
    const path: Aim['path'] = [{ x, y, d: 0 }];
    for (let t = 0; t < simT; t += step) {
      vx += (p.tx - x) * 30 * step;
      vy += (p.ty - y) * 30 * step;
      const damp = Math.exp(-7.2 * step);
      vx *= damp;
      vy *= damp;
      x += vx * step;
      y += vy * step;
      path.push({ x, y, d: (t + step) * SPEED });
    }
    if (horizon > simT) path.push({ x, y, d: horizon * SPEED });

    const cell = gate ? this.cellAt(gate, x, y) : { ix: 0, iy: 0 };
    this.aim = { gate, x, y, ix: cell.ix, iy: cell.iy, path };
  }

  private capture(g: Gate): void {
    const { ix, iy } = this.cellAt(g, this.plane.x, this.plane.y);
    g.done = true;
    g.pick = { ix, iy };
    g.flash = 1;

    const nx = g.q.cols.length;
    const edge = ix === 0 || ix === nx - 1;
    const refined = ix >= nx / 2;
    const label =
      g.q.type === '2d' && g.q.xAxis && g.q.yAxis && g.q.rows
        ? `${g.q.xAxis[ix < nx / 2 ? 0 : 1]} / ${g.q.yAxis[iy < g.q.rows.length / 2 ? 0 : 1]}`
        : g.q.cols[ix];

    this.answers.push({ q: g.q.q, label, item: g.q.items[ix], edge, refined, ix, iy });
    this.pops.push({ text: `+ ${g.q.items[ix]}`, x: this.plane.x, y: this.plane.y - 44, t: 0, edge });

    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 140;
      this.sparks.push({
        x: this.plane.x,
        y: this.plane.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        edge
      });
    }

    // The wings flick as the gate passes.
    this.plane.wingLv += 2.4;
    this.plane.wingRv += 2.4;

    // Android only — iOS Safari has no vibration API at all.
    navigator.vibrate?.(14);
  }

  private setQuestion(text: string | null): void {
    if (text === this.shownQuestion) return;
    this.shownQuestion = text;
    this.handlers.onQuestion(text);
  }

  /* ── draw ── */

  private draw(): void {
    const { ctx, W, H, CX, CY } = this;

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(CX * 0.7, CY * 0.6, 0, CX, CY, Math.max(W, H) * 0.7);
    glow.addColorStop(0, 'rgba(123,107,154,0.06)');
    glow.addColorStop(0.5, 'rgba(45,107,122,0.04)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const s of this.stars) {
      const k = this.proj(s.d);
      if (k <= 0) continue;
      const x = CX + s.wx * k;
      const y = CY + s.wy * k;
      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
      ctx.globalAlpha = Math.min(0.7, k * 1.1) * s.s;
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.4, k * 1.8) * s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const g of this.gates.slice().sort((a, b) => b.dist - a.dist)) {
      if (g.dist > -3.4) this.drawGate(g);
    }

    this.drawProjectedLine();
    this.drawLoggedLine();

    for (const s of this.sparks) {
      ctx.globalAlpha = (1 - s.t / 1.1) * 0.8;
      ctx.fillStyle = s.edge ? PALETTE.lamp : PALETTE.ice;
      ctx.fillRect(s.x - 1.3, s.y - 1.3, 2.6, 2.6);
    }
    ctx.globalAlpha = 1;

    this.drawCraft();

    for (const pop of this.pops) {
      const k = pop.t / 2.3;
      ctx.globalAlpha = k < 0.12 ? k / 0.12 : Math.max(0, (1 - k) * 1.5);
      ctx.fillStyle = pop.edge ? PALETTE.lamp : '#bfe0e2';
      ctx.font = `500 16px ${this.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y - k * 54);
    }
    ctx.globalAlpha = 1;

    this.drawMirror();

    const next = this.gates.filter((g) => !g.done).sort((a, b) => a.dist - b.dist)[0];
    this.setQuestion(next && next.dist < 15.5 ? next.q.q : next ? this.shownQuestion : null);
  }

  /**
   * The record, seen from a camera riding above and behind the craft: the
   * line leaves the tail, drops away beneath the viewer and slips off the
   * bottom of the screen. The mirror shows where it goes from there.
   */
  private drawLoggedLine(): void {
    const { ctx, CX, CY } = this;
    const line = this.loggedLine;
    if (line.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Each band is one continuous stroke; overlapping translucent segments
    // would otherwise bead at every joint.
    const bands = [
      { to: 0.9, alpha: 0.85, width: 2.6, color: PALETTE.trailHot },
      { to: 1.8, alpha: 0.7, width: 3.0, color: PALETTE.trail },
      { to: 2.8, alpha: 0.55, width: 3.6, color: PALETTE.trail },
      { to: 3.8, alpha: 0.4, width: 4.4, color: PALETTE.trail },
      { to: 4.6, alpha: 0.25, width: 5.2, color: PALETTE.trail },
      { to: TRAIL_REACH, alpha: 0.12, width: 6, color: PALETTE.trail }
    ];
    const at = (i: number): [number, number, number] => {
      const db = (this.zDist - line[i].z) * TRAIL_K;
      const s = FOCAL / (FOCAL - Math.min(db, TRAIL_REACH));
      const p = this.fromNorm(line[i].nx, line[i].ny);
      return [CX + (p.x - CX) * s, CY + (p.y - CY) * s + CAM_UP * (s - 1), db];
    };

    let i = line.length - 1;
    for (const band of bands) {
      if (i < 0) break;
      ctx.globalAlpha = band.alpha;
      ctx.strokeStyle = band.color;
      ctx.lineWidth = band.width;
      ctx.beginPath();
      let [x, y, db] = at(i);
      ctx.moveTo(x, y);
      let drawn = false;
      while (i > 0 && db < band.to) {
        i--;
        [x, y, db] = at(i);
        ctx.lineTo(x, y);
        drawn = true;
      }
      if (drawn) ctx.stroke();
      if (db >= TRAIL_REACH || i <= 0) break;
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Intention: the path the craft will actually fly if the thumb stays put,
   * ending in a reticle on the gate it is about to pass through.
   */
  private drawProjectedLine(): void {
    const { ctx, CX, CY } = this;
    const { path, gate } = this.aim;
    if (path.length < 2) return;

    ctx.lineCap = 'round';
    ctx.strokeStyle = PALETTE.lamp;
    let prev = path[0];
    let ps = 1;
    for (let i = 1; i < path.length; i++) {
      const pt = path[i];
      const s = this.proj(pt.d);
      const x0 = CX + (prev.x - CX) * ps;
      const y0 = CY + (prev.y - CY) * ps;
      const x1 = CX + (pt.x - CX) * s;
      const y1 = CY + (pt.y - CY) * s;
      ctx.globalAlpha = 0.12 + 0.3 * s;
      ctx.lineWidth = Math.max(0.5, 2.2 * s);
      ctx.setLineDash([4 * s + 1, 6 * s + 2]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      prev = pt;
      ps = s;
    }
    ctx.setLineDash([]);

    if (gate) {
      // A reticle on the gate plane, at the spot the craft will pass through.
      const s = this.proj(Math.max(0, gate.dist));
      const x = CX + (this.aim.x - CX) * s;
      const y = CY + (this.aim.y - CY) * s;
      const r = 4 + 10 * s;
      const pulse = 0.75 + 0.25 * Math.sin(this.time * 5);
      ctx.globalAlpha = (0.35 + 0.5 * s) * pulse;
      ctx.strokeStyle = PALETTE.trailHot;
      ctx.lineWidth = Math.max(0.8, 1.4 * s);
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.5);
      ctx.lineTo(x - r, y - r);
      ctx.lineTo(x - r * 0.5, y - r);
      ctx.moveTo(x + r * 0.5, y - r);
      ctx.lineTo(x + r, y - r);
      ctx.lineTo(x + r, y - r * 0.5);
      ctx.moveTo(x + r, y + r * 0.5);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x + r * 0.5, y + r);
      ctx.moveTo(x - r * 0.5, y + r);
      ctx.lineTo(x - r, y + r);
      ctx.lineTo(x - r, y + r * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The craft is a small 3D mesh: a diamond body, a fin, and two wings hinged
   * at the root. Seen from a camera above and behind, so the nose sits high
   * on screen and the wings show their bank.
   */
  private drawCraft(): void {
    const { ctx } = this;
    const p = this.plane;
    const bob = (1 - p.throttle) * Math.sin(this.time * 2.1) * 2.5;

    const cr = Math.cos(p.roll);
    const sr = Math.sin(p.roll);
    const cp = Math.cos(p.pitch);
    const sp = Math.sin(p.pitch);
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);
    const camT = 0.5;
    const ct = Math.cos(camT);
    const st = Math.sin(camT);

    // Local frame: x right, y up, z forward. Roll, then pitch, then yaw.
    const pt = (x: number, y: number, z: number): [number, number] => {
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
    const tipL = pt(-wl * Math.cos(p.wingL), wl * Math.sin(p.wingL), -5);
    const rootR = pt(3.5, 0, 7);
    const rootRb = pt(3.5, 0, -8);
    const tipR = pt(wl * Math.cos(p.wingR), wl * Math.sin(p.wingR), -5);

    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(CRAFT_SCALE, CRAFT_SCALE);

    // Exhaust while there is power on.
    if (p.throttle > 0.03) {
      const flame = p.throttle * (0.8 + 0.2 * Math.sin(this.time * 37));
      const g = ctx.createRadialGradient(tail[0], tail[1], 0, tail[0], tail[1], 16 + 10 * flame);
      g.addColorStop(0, `rgba(232,184,122,${0.55 * flame})`);
      g.addColorStop(1, 'rgba(232,184,122,0)');
      ctx.fillStyle = g;
      ctx.fillRect(tail[0] - 30, tail[1] - 30, 60, 60);
      ctx.strokeStyle = `rgba(255,220,170,${0.7 * flame})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tail[0], tail[1]);
      ctx.lineTo(tail[0], tail[1] + 5 + 9 * flame);
      ctx.stroke();
    }

    ctx.shadowColor = 'rgba(108,192,208,0.9)';
    ctx.shadowBlur = 26;

    const wing = (root: [number, number], rootB: [number, number], tip: [number, number], lift: number) => {
      const shade = 0.72 + 0.28 * Math.max(0, Math.sin(lift) + 0.4);
      ctx.fillStyle = `rgba(184,216,224,${Math.min(1, shade)})`;
      ctx.beginPath();
      ctx.moveTo(root[0], root[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(rootB[0], rootB[1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(168,213,216,0.45)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(root[0], root[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.stroke();
    };
    // Far wing first so the near one overlaps it under bank.
    if (p.roll >= 0) {
      wing(rootL, rootLb, tipL, p.wingL);
      wing(rootR, rootRb, tipR, p.wingR);
    } else {
      wing(rootR, rootRb, tipR, p.wingR);
      wing(rootL, rootLb, tipL, p.wingL);
    }

    ctx.fillStyle = PALETTE.craft;
    ctx.beginPath();
    ctx.moveTo(nose[0], nose[1]);
    ctx.lineTo(rootR[0], rootR[1]);
    ctx.lineTo(tail[0], tail[1]);
    ctx.lineTo(rootL[0], rootL[1]);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(200,228,234,0.85)';
    ctx.beginPath();
    ctx.moveTo(tail[0], tail[1]);
    ctx.lineTo(finTop[0], finTop[1]);
    ctx.lineTo(finFwd[0], finFwd[1]);
    ctx.closePath();
    ctx.fill();

    // Spine and leading edges are what sell the depth on a small shape.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(74,143,160,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nose[0], nose[1]);
    ctx.lineTo(tail[0], tail[1]);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(168,213,216,0.4)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(nose[0], nose[1]);
    ctx.lineTo(rootR[0], rootR[1]);
    ctx.moveTo(nose[0], nose[1]);
    ctx.lineTo(rootL[0], rootL[1]);
    ctx.stroke();

    ctx.restore();
  }

  private drawGate(g: Gate): void {
    const { ctx, CX, CY } = this;
    const s = this.proj(g.dist);
    if (s <= 0.02) return;

    let a = 1;
    if (g.dist > 20) a = Math.max(0, (26 - g.dist) / 6);
    if (g.dist < 0) a = Math.max(0, 1 + g.dist / 3.4);
    if (a <= 0.01) return;

    const w = this.GW * s;
    const h = this.GH * s;
    const x0 = CX - w / 2;
    const y0 = CY - h / 2;
    const nx = g.q.cols.length;
    const ny = g.q.type === '2d' ? (g.q.rows?.length ?? 1) : 1;
    const cw = w / nx;
    const ch = h / ny;
    const near = Math.min(1, Math.max(0, (14 - g.dist) / 9));
    const aimed = this.aim.gate === g;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);

    ctx.save();
    ctx.globalAlpha = a;

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const isEdge = i === 0 || i === nx - 1 || (ny > 1 && (j === 0 || j === ny - 1));
        const picked = g.pick?.ix === i && g.pick?.iy === j;
        let fill = isEdge ? 'rgba(232,184,122,0.05)' : 'rgba(45,107,122,0.04)';
        if (picked && g.flash > 0) fill = `rgba(232,184,122,${0.3 * g.flash})`;
        ctx.fillStyle = fill;
        ctx.fillRect(x0 + i * cw, y0 + j * ch, cw, ch);
      }
    }

    // The cell the current heading lands in. Same colour at every position —
    // it says "here", never "better".
    if (aimed && !g.done) {
      const ax = x0 + this.aim.ix * cw;
      const ay = y0 + this.aim.iy * ch;
      ctx.fillStyle = `rgba(168,213,216,${0.08 + 0.1 * near + 0.04 * pulse})`;
      ctx.fillRect(ax, ay, cw, ch);
      ctx.strokeStyle = `rgba(109,192,208,${0.45 + 0.4 * near})`;
      ctx.lineWidth = Math.max(0.8, 1.6 * s);
      ctx.strokeRect(ax + 1, ay + 1, cw - 2, ch - 2);
    }

    ctx.lineWidth = Math.max(0.5, s);
    ctx.strokeStyle = `rgba(120,175,190,${0.18 + 0.25 * near})`;
    ctx.beginPath();
    for (let i = 1; i < nx; i++) {
      ctx.moveTo(x0 + i * cw, y0);
      ctx.lineTo(x0 + i * cw, y0 + h);
    }
    for (let j = 1; j < ny; j++) {
      ctx.moveTo(x0, y0 + j * ch);
      ctx.lineTo(x0 + w, y0 + j * ch);
    }
    ctx.stroke();

    ctx.lineWidth = Math.max(0.8, 2 * s);
    ctx.strokeStyle = `rgba(168,213,216,${0.28 + 0.4 * near})`;
    ctx.shadowColor = 'rgba(45,107,122,0.8)';
    ctx.shadowBlur = 14 * s;
    ctx.strokeRect(x0, y0, w, h);
    ctx.shadowBlur = 0;

    const la = near * a;
    if (la > 0.06 && g.dist > -0.5) {
      ctx.globalAlpha = la;
      ctx.fillStyle = PALETTE.label;
      ctx.textAlign = 'center';
      if (g.q.type === '1d') {
        // Big enough to read at arm's length, then pulled back down if the
        // widest label would run into its neighbour — the floor is there for
        // legibility, not to let the row collide while the gate is still far.
        let fs = Math.min(19, Math.max(11.5, cw * 0.2));
        ctx.font = `600 ${fs * 1.12}px ${this.fontFamily}`;
        let widest = 0;
        for (const c of g.q.cols) widest = Math.max(widest, ctx.measureText(c).width);
        if (widest > cw - 6) fs *= (cw - 6) / widest;

        for (let i = 0; i < nx; i++) {
          const hit = aimed && !g.done && this.aim.ix === i;
          ctx.fillStyle = hit ? '#e6f2f2' : PALETTE.label;
          ctx.font = `${hit ? 600 : 500} ${hit ? fs * 1.12 : fs}px ${this.fontFamily}`;
          ctx.fillText(g.q.cols[i], x0 + i * cw + cw / 2, y0 + h - 14 * s - 4);
        }
      } else if (g.q.xAxis && g.q.yAxis) {
        const fs = Math.min(17, Math.max(11, w * 0.045));
        ctx.font = `500 ${fs}px ${this.fontFamily}`;
        ctx.fillText(g.q.yAxis[0], CX, y0 - 8);
        ctx.fillText(g.q.yAxis[1], CX, y0 + h + fs + 5);
        ctx.textAlign = 'right';
        ctx.fillText(g.q.xAxis[0], x0 - 7, CY + fs * 0.36);
        ctx.textAlign = 'left';
        ctx.fillText(g.q.xAxis[1], x0 + w + 7, CY + fs * 0.36);

        // Name the aimed cell so a 2D answer reads as an answer, not a spot.
        if (aimed && !g.done && s > 0.45) {
          const rows = g.q.rows?.length ?? 1;
          const text = `${g.q.xAxis[this.aim.ix < nx / 2 ? 0 : 1]} · ${g.q.yAxis[this.aim.iy < rows / 2 ? 0 : 1]}`;
          const cfs = Math.min(15, Math.max(10, cw * 0.185));
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e6f2f2';
          ctx.font = `600 ${cfs}px ${this.fontFamily}`;
          ctx.fillText(text, x0 + this.aim.ix * cw + cw / 2, y0 + this.aim.iy * ch + ch / 2 + cfs * 0.36);
        }
      }
    }
    ctx.restore();
  }

  /**
   * The rear-view mirror: the trail and the gates already passed, receding
   * to a vanishing point. Mirrored left-to-right, as a mirror would be.
   */
  private drawMirror(): void {
    const { ctx } = this;
    const { x: mx, y: my, w: mw, h: mh } = this.mirror;
    if (mw <= 0) return;

    const cx = mx + mw / 2;
    const cy = my + mh * 0.4;
    const scale = mw * 0.8;
    const drop = mh * 0.42;
    const MK = 0.7;
    const rr = 6;

    const rounded = () => {
      ctx.beginPath();
      ctx.moveTo(mx + rr, my);
      ctx.lineTo(mx + mw - rr, my);
      ctx.quadraticCurveTo(mx + mw, my, mx + mw, my + rr);
      ctx.lineTo(mx + mw, my + mh - rr);
      ctx.quadraticCurveTo(mx + mw, my + mh, mx + mw - rr, my + mh);
      ctx.lineTo(mx + rr, my + mh);
      ctx.quadraticCurveTo(mx, my + mh, mx, my + mh - rr);
      ctx.lineTo(mx, my + rr);
      ctx.quadraticCurveTo(mx, my, mx + rr, my);
      ctx.closePath();
    };

    // Screen position of a point on the flight plane, `db` units behind.
    const at = (nx: number, ny: number, db: number): [number, number, number] => {
      const s = FOCAL / (FOCAL + db * MK);
      return [cx + (0.5 - nx) * scale * s, cy + ((ny - 0.5) * scale * 0.86 + drop) * s, s];
    };

    ctx.save();
    rounded();
    ctx.clip();

    const bg = ctx.createLinearGradient(0, my, 0, my + mh);
    bg.addColorStop(0, '#0a1020');
    bg.addColorStop(1, '#060a14');
    ctx.fillStyle = bg;
    ctx.fillRect(mx, my, mw, mh);

    // A faint glow at the vanishing point, where everything ends up.
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, mw * 0.3);
    vg.addColorStop(0, 'rgba(123,107,154,0.18)');
    vg.addColorStop(1, 'rgba(123,107,154,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(mx, my, mw, mh);

    // Passed gates, farthest first, with the chosen cell lit.
    const passed = this.gates.filter((g) => g.done && g.dist < 0).sort((a, b) => a.dist - b.dist);
    for (const g of passed) {
      const db = -g.dist;
      const [x0, y0, s] = at(0, 0, db);
      const [x1, y1] = at(1, 1, db);
      if (s < 0.05) continue;
      const fade = Math.min(1, s * 2.2);
      ctx.globalAlpha = 0.35 * fade;
      ctx.strokeStyle = PALETTE.ice;
      ctx.lineWidth = Math.max(0.5, 1.2 * s);
      ctx.strokeRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
      if (g.pick) {
        const nx = g.q.cols.length;
        const ny = g.q.type === '2d' ? (g.q.rows?.length ?? 1) : 1;
        const [ax0, ay0] = at(g.pick.ix / nx, g.pick.iy / ny, db);
        const [ax1, ay1] = at((g.pick.ix + 1) / nx, (g.pick.iy + 1) / ny, db);
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = PALETTE.lamp;
        ctx.fillRect(Math.min(ax0, ax1), ay0, Math.abs(ax1 - ax0), ay1 - ay0);
      }
    }

    // The trail, in three depth bands so the whole record stays cheap to draw.
    const line = this.loggedLine;
    if (line.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const bands = [
        { max: 12, stride: 1, alpha: 0.85, width: 2.2, color: PALETTE.trailHot },
        { max: 45, stride: 3, alpha: 0.55, width: 1.4, color: PALETTE.trail },
        { max: 400, stride: 8, alpha: 0.3, width: 0.8, color: PALETTE.trail }
      ];
      let i = line.length - 1;
      for (const band of bands) {
        if (i < 0) break;
        ctx.globalAlpha = band.alpha;
        ctx.strokeStyle = band.color;
        ctx.lineWidth = band.width;
        ctx.beginPath();
        let started = false;
        for (; i >= 0; i -= band.stride) {
          const db = this.zDist - line[i].z;
          if (db > band.max) break;
          const [x, y] = at(line[i].nx, line[i].ny, db);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (started) ctx.stroke();
      }
    }

    ctx.restore();

    // The frame.
    ctx.save();
    rounded();
    ctx.strokeStyle = 'rgba(168,213,216,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private readonly loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.048, (now - this.last) / 1000);
    this.last = now;
    if (dt > 0) this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };
}
