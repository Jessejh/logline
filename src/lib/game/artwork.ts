import { gateZ } from './flight';
import { PALETTE } from './palette';
import { QUESTIONS } from './questions';
import type { Answer, LinePoint } from './types';

/**
 * The logged line as a small sculpture: the whole flight laid out in 3D,
 * threaded through the eight gate frames with the chosen cell lit in each.
 * Drag to turn it; it turns itself when left alone.
 *
 * Framework-free like the flight — a canvas and a record in, frames out.
 */

export interface ArtworkInput {
  line: readonly LinePoint[];
  answers: readonly Answer[];
}

/** World units: a gate frame is FRAME_W wide, gates sit GAP apart. */
const FRAME_W = 1.6;
const FRAME_H = FRAME_W * 0.86;
const GAP = 1.0;
const CAM_DIST = 8.6;
const MAX_POINTS = 600;

interface Drawable {
  depth: number;
  draw: () => void;
}

interface Vec {
  x: number;
  y: number;
  z: number;
}

export class Artwork {
  private readonly cvs: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly points: Vec[];
  private readonly answers: readonly Answer[];
  private readonly stars: { x: number; y: number; s: number; p: number }[] = [];

  private W = 0;
  private H = 0;
  private DPR = 1;
  private F = 300;
  private fontFamily = 'system-ui, sans-serif';

  private yaw = -0.85;
  private pitch = 0.38;
  private yawV = 0;
  private pitchV = 0;
  private grabbing = false;
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private idle = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private readonly reduced: boolean;
  private readonly zScale: number;
  private readonly zMid: number;

  private readonly onResize = () => this.layout();

  private readonly onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.cvs.setPointerCapture(e.pointerId);
    } catch {
      /* tracking still works without capture */
    }
    this.grabbing = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yawV = this.pitchV = 0;
    this.idle = 0;
  };

  private readonly onMove = (e: PointerEvent) => {
    if (!this.grabbing || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yawV = dx * 0.55;
    this.pitchV = dy * 0.55;
    this.yaw += dx * 0.009;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + dy * 0.009));
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.grabbing = false;
  };

  constructor(canvas: HTMLCanvasElement, input: ArtworkInput) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.cvs = canvas;
    this.ctx = ctx;
    this.answers = input.answers;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Gate spacing in the record is SPACING world units; here it is GAP.
    const span = Math.max(1, gateZ(1) - gateZ(0));
    this.zScale = GAP / span;
    const n = Math.max(1, Math.min(QUESTIONS.length, input.answers.length || QUESTIONS.length));
    this.zMid = (gateZ(0) + gateZ(n - 1)) / 2;

    const line = input.line;
    const stride = Math.max(1, Math.ceil(line.length / MAX_POINTS));
    this.points = [];
    for (let i = 0; i < line.length; i += stride) this.points.push(this.toWorld(line[i]));
    const lastPt = line[line.length - 1];
    if (lastPt && (line.length - 1) % stride !== 0) this.points.push(this.toWorld(lastPt));

    for (let i = 0; i < 140; i++) {
      this.stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 0.7 + 0.3, p: Math.random() * 6.3 });
    }
  }

  private toWorld(p: LinePoint): Vec {
    return {
      x: (p.nx - 0.5) * FRAME_W,
      y: (0.5 - p.ny) * FRAME_H,
      z: (p.z - this.zMid) * this.zScale
    };
  }

  start(): void {
    this.layout();
    this.cvs.addEventListener('pointerdown', this.onDown, { passive: false });
    this.cvs.addEventListener('pointermove', this.onMove, { passive: false });
    this.cvs.addEventListener('pointerup', this.onUp);
    this.cvs.addEventListener('pointercancel', this.onUp);
    addEventListener('resize', this.onResize);
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.cvs.removeEventListener('pointerdown', this.onDown);
    this.cvs.removeEventListener('pointermove', this.onMove);
    this.cvs.removeEventListener('pointerup', this.onUp);
    this.cvs.removeEventListener('pointercancel', this.onUp);
    removeEventListener('resize', this.onResize);
  }

  private layout(): void {
    this.DPR = Math.min(devicePixelRatio || 1, 2.5);
    this.W = innerWidth;
    this.H = innerHeight;
    this.cvs.width = Math.round(this.W * this.DPR);
    this.cvs.height = Math.round(this.H * this.DPR);
    this.cvs.style.width = `${this.W}px`;
    this.cvs.style.height = `${this.H}px`;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.F = Math.min(this.W, this.H * 0.72) * 0.95;
    this.fontFamily = getComputedStyle(document.body).fontFamily || this.fontFamily;
  }

  private update(dt: number): void {
    this.time += dt;
    if (this.grabbing) return;
    this.idle += dt;
    // Momentum from the last drag, then a slow turn of its own once settled.
    this.yaw += this.yawV * 0.009 * 60 * dt;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + this.pitchV * 0.009 * 60 * dt));
    const decay = Math.exp(-3.2 * dt);
    this.yawV *= decay;
    this.pitchV *= decay;
    if (!this.reduced) {
      const ease = Math.min(1, Math.max(0, (this.idle - 1.5) / 2));
      this.yaw += 0.22 * ease * dt;
      this.pitch += (0.38 - this.pitch) * 0.4 * ease * dt;
    }
  }

  /** World to screen through the orbiting camera. Returns null behind the camera. */
  private project(v: Vec): { x: number; y: number; k: number; depth: number } | null {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const x1 = v.x * cy + v.z * sy;
    const z1 = -v.x * sy + v.z * cy;
    const y2 = v.y * cp - z1 * sp;
    const z2 = v.y * sp + z1 * cp;
    const depth = CAM_DIST - z2;
    if (depth < 0.3) return null;
    const k = this.F / depth;
    return { x: this.W / 2 + x1 * k, y: this.H * 0.47 - y2 * k, k, depth };
  }

  private draw(): void {
    const { ctx, W, H } = this;
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.47, Math.max(W, H) * 0.6);
    glow.addColorStop(0, 'rgba(123,107,154,0.09)');
    glow.addColorStop(0.6, 'rgba(45,107,122,0.04)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Stars drift a touch against the turn, for depth behind the piece.
    const px = (this.yaw * 30) % W;
    const py = this.pitch * 20;
    ctx.fillStyle = PALETTE.star;
    for (const s of this.stars) {
      const x = (((s.x * W - px) % W) + W) % W;
      const y = (((s.y * H - py) % H) + H) % H;
      ctx.globalAlpha = (0.25 + 0.35 * Math.sin(this.time * 0.8 + s.p) ** 2) * s.s;
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + s.s * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const items: Drawable[] = [];
    this.collectFrames(items);
    this.collectLine(items);
    items.sort((a, b) => b.depth - a.depth);
    for (const it of items) it.draw();
    ctx.globalAlpha = 1;
  }

  private collectFrames(items: Drawable[]): void {
    const { ctx } = this;
    const n = Math.min(QUESTIONS.length, this.answers.length || QUESTIONS.length);
    for (let i = 0; i < n; i++) {
      const q = QUESTIONS[i];
      const a = this.answers[i];
      const z = (gateZ(i) - this.zMid) * this.zScale;
      const corner = (nx: number, ny: number) =>
        this.project({ x: (nx - 0.5) * FRAME_W, y: (0.5 - ny) * FRAME_H, z });
      const c = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
      const centre = this.project({ x: 0, y: 0, z });
      if (!centre || c.some((p) => p === null)) continue;
      // Seen end-on the frames stack up; let their names step back then.
      const nextC = i + 1 < n ? this.project({ x: 0, y: 0, z: z + GAP }) : null;
      const gap = nextC ? Math.hypot(nextC.x - centre.x, nextC.y - centre.y) : 99;
      const roomy = Math.min(1, Math.max(0, (gap - 16) / 28));
      const cs = c as NonNullable<(typeof c)[number]>[];

      const cols = q.cols.length;
      const rows = q.type === '2d' ? (q.rows?.length ?? 1) : 1;
      const ix = a ? Math.max(0, Math.min(cols - 1, a.ix)) : -1;
      const iy = a ? Math.max(0, Math.min(rows - 1, a.iy)) : -1;
      const cell =
        ix >= 0
          ? [
              corner(ix / cols, iy / rows),
              corner((ix + 1) / cols, iy / rows),
              corner((ix + 1) / cols, (iy + 1) / rows),
              corner(ix / cols, (iy + 1) / rows)
            ]
          : null;
      const cellMid = ix >= 0 ? corner((ix + 0.5) / cols, (iy + 0.5) / rows) : null;

      items.push({
        depth: centre.depth,
        draw: () => {
          const near = Math.min(1, Math.max(0.15, centre.k / (this.F / CAM_DIST)));
          ctx.lineWidth = Math.max(0.5, 1.1 * near);
          ctx.strokeStyle = PALETTE.ice;
          ctx.globalAlpha = 0.28 * near;
          ctx.beginPath();
          ctx.moveTo(cs[0].x, cs[0].y);
          for (let j = 1; j < 4; j++) ctx.lineTo(cs[j].x, cs[j].y);
          ctx.closePath();
          ctx.stroke();

          // Faint grid so the frame reads as a gate, not a window.
          ctx.globalAlpha = 0.1 * near;
          ctx.beginPath();
          for (let j = 1; j < cols; j++) {
            const t = corner(j / cols, 0);
            const b = corner(j / cols, 1);
            if (t && b) {
              ctx.moveTo(t.x, t.y);
              ctx.lineTo(b.x, b.y);
            }
          }
          for (let j = 1; j < rows; j++) {
            const l = corner(0, j / rows);
            const r = corner(1, j / rows);
            if (l && r) {
              ctx.moveTo(l.x, l.y);
              ctx.lineTo(r.x, r.y);
            }
          }
          ctx.stroke();

          if (cell && !cell.some((p) => p === null)) {
            const cc = cell as NonNullable<(typeof cell)[number]>[];
            ctx.globalAlpha = 0.34 * near;
            ctx.fillStyle = PALETTE.lamp;
            ctx.beginPath();
            ctx.moveTo(cc[0].x, cc[0].y);
            for (let j = 1; j < 4; j++) ctx.lineTo(cc[j].x, cc[j].y);
            ctx.closePath();
            ctx.fill();
          }

          if (a && cellMid && near > 0.45 && roomy > 0.05) {
            const fs = Math.min(12, Math.max(8, 9 * near));
            ctx.globalAlpha = Math.min(0.9, (near - 0.3) * 1.4) * roomy;
            ctx.fillStyle = '#dfc090';
            ctx.font = `500 ${fs}px ${this.fontFamily}`;
            ctx.textAlign = 'center';
            // Alternate above and below so neighbouring names don't collide.
            const dy = i % 2 === 0 ? -(6 * near + 4) : 10 * near + 6;
            ctx.fillText(a.item, cellMid.x, cellMid.y + dy);
          }
        }
      });
    }
  }

  private collectLine(items: Drawable[]): void {
    const { ctx } = this;
    const pts = this.points;
    if (pts.length < 2) return;
    const proj = pts.map((p) => this.project(p));
    const n = pts.length;
    const unit = this.F / CAM_DIST;

    // Runs of a few segments share one stroke, so translucent joints don't
    // bead, while depth sorting against the frames stays close enough.
    const RUN = 6;
    for (let i0 = 0; i0 < n - 1; i0 += RUN) {
      const i1 = Math.min(n - 1, i0 + RUN);
      const run: NonNullable<(typeof proj)[number]>[] = [];
      let depth = 0;
      for (let i = i0; i <= i1; i++) {
        const q = proj[i];
        if (!q) break;
        run.push(q);
        depth += q.depth;
      }
      if (run.length < 2) continue;
      depth /= run.length;
      const t = (i0 + i1) / 2 / n;
      const mid = run[Math.floor(run.length / 2)];
      items.push({
        depth,
        draw: () => {
          const near = Math.min(1.6, mid.k / unit);
          const color = t > 0.94 ? PALETTE.lamp : t > 0.8 ? PALETTE.trailHot : PALETTE.trail;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(run[0].x, run[0].y);
          for (let j = 1; j < run.length; j++) ctx.lineTo(run[j].x, run[j].y);
          // Glow underneath, then the line itself.
          ctx.globalAlpha = 0.12 * near;
          ctx.lineWidth = (5 + 4 * t) * near;
          ctx.stroke();
          ctx.globalAlpha = Math.min(1, (0.45 + 0.5 * t) * near);
          ctx.lineWidth = (1.1 + 1.6 * t) * near;
          ctx.stroke();
        }
      });
    }

    // Start and end marks.
    const first = proj[0];
    const lastP = proj[n - 1];
    if (first) {
      items.push({
        depth: first.depth,
        draw: () => {
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = PALETTE.trail;
          ctx.beginPath();
          ctx.arc(first.x, first.y, 1.6 * Math.min(1.6, first.k / unit), 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    if (lastP) {
      items.push({
        depth: lastP.depth - 0.01,
        draw: () => {
          const r = 2.6 * Math.min(1.6, lastP.k / unit);
          const pulse = 0.7 + 0.3 * Math.sin(this.time * 3);
          ctx.globalAlpha = 0.35 * pulse;
          ctx.fillStyle = PALETTE.lamp;
          ctx.beginPath();
          ctx.arc(lastP.x, lastP.y, r * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(lastP.x, lastP.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
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
