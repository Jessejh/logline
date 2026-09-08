import { PALETTE } from './palette';
import { QUESTIONS } from './questions';
import type { Answer, FlightResult, LinePoint, Question } from './types';

/**
 * The grading phase: one first-person flight through eight question-gates.
 *
 * Ported from `prototypes/grading-phase.html`. The physics constants below
 * are the prototype's, deliberately unchanged — they are the feel reference.
 * Nothing here scores the player: which cell you pass through decides what
 * the record says, never how well you did.
 */

const FOCAL = 7;
const SPEED = 3.45;
const SPACING = 13.5;
/** Vertical offset so the craft sits above the thumb rather than under it. */
const LIFT = 96;

interface Gate {
  q: Question;
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

export interface FlightHandlers {
  /** Called when the visible prompt changes; null hides it. */
  onQuestion(text: string | null): void;
  /** Called once, shortly after the last gate is passed. */
  onComplete(result: FlightResult): void;
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
  private fontFamily = 'system-ui, sans-serif';

  private plane = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, roll: 0, pitch: 0 };
  private loggedLine: LinePoint[] = [];
  private gates: Gate[] = [];
  private stars: Star[] = [];
  private pops: Pop[] = [];
  private sparks: Spark[] = [];
  private answers: Answer[] = [];

  private zDist = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private finished = false;
  private shownQuestion: string | null = null;
  private readonly reduced: boolean;

  private readonly onResize = () => {
    this.layout();
    this.clampPlane();
  };

  private readonly onPointer = (e: PointerEvent) => {
    if (!this.running || this.finished) return;
    if (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    this.plane.tx = e.clientX;
    this.plane.ty = e.clientY - LIFT;
    this.clampPlane();
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
    this.cvs.addEventListener('pointerdown', this.onPointer, { passive: false });
    this.cvs.addEventListener('pointermove', this.onPointer, { passive: false });
    addEventListener('resize', this.onResize);
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.cvs.removeEventListener('pointerdown', this.onPointer);
    this.cvs.removeEventListener('pointermove', this.onPointer);
    removeEventListener('resize', this.onResize);
  }

  /* ── layout ── */

  private layout(): void {
    this.DPR = Math.min(devicePixelRatio || 1, 2.5);
    this.W = innerWidth;
    this.H = innerHeight;
    this.cvs.width = Math.round(this.W * this.DPR);
    this.cvs.height = Math.round(this.H * this.DPR);
    this.cvs.style.width = `${this.W}px`;
    this.cvs.style.height = `${this.H}px`;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.GW = Math.min(this.W * 0.86, 420);
    this.GH = Math.min(this.GW * 0.86, this.H * 0.4);
    this.CX = this.W / 2;
    this.CY = this.H * 0.44;
    this.fontFamily = getComputedStyle(document.body).fontFamily || this.fontFamily;
  }

  private reset(): void {
    this.plane.x = this.plane.tx = this.CX;
    this.plane.y = this.plane.ty = this.CY;
    this.plane.vx = this.plane.vy = 0;
    this.plane.roll = this.plane.pitch = 0;
    this.loggedLine = [];
    this.answers = [];
    this.pops = [];
    this.sparks = [];
    this.zDist = 0;
    this.finished = false;
    this.shownQuestion = null;
    this.gates = QUESTIONS.map((q, i) => ({
      q,
      dist: 17 + i * SPACING,
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

  private cellOf(g: Gate): { ix: number; iy: number } {
    const nx = g.q.cols.length;
    const ny = g.q.type === '2d' ? (g.q.rows?.length ?? 1) : 1;
    const { nx: rx, ny: ry } = this.toNorm(this.plane.x, this.plane.y);
    return {
      ix: Math.max(0, Math.min(nx - 1, Math.floor(rx * nx))),
      iy: Math.max(0, Math.min(ny - 1, Math.floor(ry * ny)))
    };
  }

  /* ── update ── */

  private update(dt: number): void {
    const p = this.plane;

    p.vx += (p.tx - p.x) * 30 * dt;
    p.vy += (p.ty - p.y) * 30 * dt;
    const damp = Math.exp(-7.2 * dt);
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Orientation is read off velocity: bank on x, stretch on y. That is the
    // whole 3D read — there is no horizon to anchor it against.
    const tRoll = Math.max(-0.65, Math.min(0.65, p.vx * 0.0028));
    const tPitch = Math.max(-0.45, Math.min(0.45, -p.vy * 0.0022));
    p.roll += (tRoll - p.roll) * 6 * dt;
    p.pitch += (tPitch - p.pitch) * 6 * dt;

    this.zDist += SPEED * dt;

    const { nx, ny } = this.toNorm(p.x, p.y);
    this.loggedLine.push({ nx, ny, z: this.zDist });

    for (const s of this.stars) {
      s.d -= SPEED * dt * 1.2;
      if (s.d < 0.3) {
        s.d = 40;
        s.wx = (Math.random() - 0.5) * this.W * 3;
        s.wy = (Math.random() - 0.5) * this.H * 3;
      }
    }

    for (const g of this.gates) {
      const prev = g.dist;
      g.dist -= SPEED * dt;
      if (g.flash > 0) g.flash -= dt * 1.7;
      if (!g.done && prev > 0 && g.dist <= 0) this.capture(g);
    }
    this.gates = this.gates.filter((g) => g.dist > -3.4);

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

    if (!this.finished && this.gates.length === 0 && this.answers.length === QUESTIONS.length) {
      this.finished = true;
      this.setQuestion(null);
      const result: FlightResult = { answers: this.answers.slice(), line: this.loggedLine.slice() };
      setTimeout(() => this.handlers.onComplete(result), 700);
    }
  }

  private capture(g: Gate): void {
    const { ix, iy } = this.cellOf(g);
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
    this.pops.push({ text: `+ ${g.q.items[ix]}`, x: this.plane.x, y: this.plane.y - 30, t: 0, edge });

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

    this.drawLoggedLine();
    this.drawProjectedLine();

    for (const g of this.gates.slice().sort((a, b) => b.dist - a.dist)) this.drawGate(g);

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
      ctx.font = `500 13px ${this.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y - k * 54);
    }
    ctx.globalAlpha = 1;

    const next = this.gates.filter((g) => !g.done).sort((a, b) => a.dist - b.dist)[0];
    this.setQuestion(next && next.dist < 15.5 ? next.q.q : next ? this.shownQuestion : null);
  }

  /** The record: everywhere the craft has been, converging on the vanishing point. */
  private drawLoggedLine(): void {
    const { ctx, CX, CY } = this;
    const line = this.loggedLine;
    if (line.length < 3) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const len = line.length;
    const start = Math.max(0, len - 400);

    for (let i = start + 1; i < len; i++) {
      const a = line[i - 1];
      const b = line[i];
      const s0 = this.proj((this.zDist - a.z) * 0.25);
      const s1 = this.proj((this.zDist - b.z) * 0.25);
      if (s0 <= 0.01 && s1 <= 0.01) continue;

      const pa = this.fromNorm(a.nx, a.ny);
      const pb = this.fromNorm(b.nx, b.ny);
      const x0 = CX + (pa.x - CX) * s0;
      const y0 = CY + (pa.y - CY) * s0;
      const x1 = CX + (pb.x - CX) * s1;
      const y1 = CY + (pb.y - CY) * s1;

      const age = (i - start) / (len - start);
      const depth = Math.min(1, s1 * 3);
      ctx.globalAlpha = age * depth * 0.55;
      ctx.strokeStyle = PALETTE.trail;
      ctx.lineWidth = Math.max(0.5, s1 * 4) * age;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // The last stretch stays bright and unprojected — it is still "here".
    const tail = Math.max(0, len - 12);
    for (let i = tail + 1; i < len; i++) {
      const k = (i - tail) / (len - tail);
      const pa = this.fromNorm(line[i - 1].nx, line[i - 1].ny);
      const pb = this.fromNorm(line[i].nx, line[i].ny);
      ctx.globalAlpha = k * 0.85;
      ctx.strokeStyle = PALETTE.trailHot;
      ctx.lineWidth = k * 3.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Intention: where the current heading lands you if nothing changes. */
  private drawProjectedLine(): void {
    const { ctx, CX, CY } = this;
    const steps = 28;
    let px = this.plane.x;
    let py = this.plane.y;
    let pvx = this.plane.vx * 0.35;
    let pvy = this.plane.vy * 0.35;

    ctx.lineCap = 'round';
    for (let i = 0; i < steps; i++) {
      const nx = px + pvx * 5 * 0.016;
      const ny = py + pvy * 5 * 0.016;
      const k = 1 - i / steps;
      const s = this.proj(i * 1.2);
      const sx = CX + (nx - CX) * s;
      const sy = CY + (ny - CY) * s;
      const sPrev = this.proj((i - 1) * 1.2 || 0);
      const spx = CX + (px - CX) * sPrev;
      const spy = CY + (py - CY) * sPrev;

      if (i > 0) {
        ctx.globalAlpha = k * k * 0.28;
        ctx.strokeStyle = PALETTE.lamp;
        ctx.lineWidth = Math.max(0.4, k * 2.2 * s);
        ctx.setLineDash([3 * s, 5 * s]);
        ctx.beginPath();
        ctx.moveTo(spx, spy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      px = nx;
      py = ny;
      pvx *= 0.94;
      pvy *= 0.94;
    }
    ctx.globalAlpha = 1;
  }

  private drawCraft(): void {
    const { ctx } = this;
    const { roll, pitch } = this.plane;

    ctx.save();
    ctx.translate(this.plane.x, this.plane.y);

    const wingSpan = 12 * Math.cos(roll);
    const bodyLen = 13 + pitch * 8;
    const bodyBack = 8 - pitch * 4;

    ctx.shadowColor = 'rgba(108,192,208,0.9)';
    ctx.shadowBlur = 26;

    ctx.fillStyle = PALETTE.craft;
    ctx.beginPath();
    ctx.moveTo(0, -bodyLen);
    ctx.lineTo(wingSpan, 1);
    ctx.lineTo(0, bodyBack);
    ctx.lineTo(-wingSpan, 1);
    ctx.closePath();
    ctx.fill();

    // Spine and leading edges are what sell the depth on a flat shape.
    ctx.strokeStyle = 'rgba(74,143,160,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -bodyLen);
    ctx.lineTo(0, bodyBack);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(168,213,216,0.4)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -bodyLen);
    ctx.lineTo(wingSpan, 1);
    ctx.moveTo(0, -bodyLen);
    ctx.lineTo(-wingSpan, 1);
    ctx.stroke();

    ctx.shadowBlur = 0;
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
        const fs = Math.min(14, Math.max(8.5, cw * 0.15));
        ctx.font = `500 ${fs}px ${this.fontFamily}`;
        for (let i = 0; i < nx; i++) {
          ctx.fillText(g.q.cols[i], x0 + i * cw + cw / 2, y0 + h - 12 * s - 2);
        }
      } else if (g.q.xAxis && g.q.yAxis) {
        const fs = Math.min(13, Math.max(8.5, w * 0.035));
        ctx.font = `500 ${fs}px ${this.fontFamily}`;
        ctx.fillText(g.q.yAxis[0], CX, y0 - 8);
        ctx.fillText(g.q.yAxis[1], CX, y0 + h + fs + 5);
        ctx.textAlign = 'right';
        ctx.fillText(g.q.xAxis[0], x0 - 7, CY + fs * 0.36);
        ctx.textAlign = 'left';
        ctx.fillText(g.q.xAxis[1], x0 + w + 7, CY + fs * 0.36);
      }
    }
    ctx.restore();
  }

  private readonly loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.048, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };
}
