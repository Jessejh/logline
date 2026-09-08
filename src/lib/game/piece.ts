import { findPauses, lateralSpeeds, type FlightStats } from './stats';
import type { Answer, LinePoint } from './types';
import { visibleHeight, visibleWidth } from '../viewport';

/**
 * The flight seen flat: the whole record collapsed onto the gate plane, with
 * the depth thrown away.
 *
 * The 3D object threads the line through eight frames, which reads the
 * *answers* well but needs turning before "did I wander today" becomes visible
 * at all. Dropping z makes that the first thing you see — a short mark, or a
 * tangle — and leaves two clean layers with two separate meanings:
 *
 *   the ground is what you answered,   the line is how you moved.
 *
 * ## The rule this file exists to keep
 *
 * Neither end of any scale is the better one. A flight taken in one straight
 * breath and a flight that wandered everywhere have to be two kinds of good
 * picture — restraint rendered as deliberate, not as an empty one. The moment
 * calm looks like failure the app has begun scoring the grading phase, and a
 * player who wants a nicer picture will start flying for it, which bends the
 * answers underneath. So movement does not add beauty here; it changes school.
 * Sparse and few-coloured, or dense and layered — both are finished pieces.
 *
 * The same discipline covers the palette: the four hues are picked to sit at
 * about the same lightness and chroma, so no cell is prettier to land in than
 * its neighbour.
 */

export interface PieceInput {
  line: readonly LinePoint[];
  answers: readonly Answer[];
  stats: FlightStats;
  /** Shown small under the piece. */
  caption?: string;
}

/**
 * One hue per column of a gate, deliberately equal in weight — see the note
 * above. Roughly matched in lightness and chroma so that no answer is a
 * prettier answer.
 */
const HUES = ['#4fb3ad', '#8f9ee0', '#dcae6b', '#d98a9c'];

/** Paper at rest, and paper on a day that kept stopping. */
const COOL_GROUND = '#dfe2e4';
const WARM_GROUND = '#e9e1d2';

/** Ink. Never pure black — it sits on paper, not on a screen. */
const INK = '20, 26, 34';

/** Frame widths of travel that count as a full day of moving. */
const BUSY_FULL = 6;

/** Seconds of one pause that count as a long one. */
const PAUSE_FULL = 6;

const REVEAL_SECONDS = 2.6;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = clamp01(t);
  const r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
  const g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
  const bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
  return `rgb(${r},${g},${bl})`;
}

function rgbaFromHex(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

interface Bloom {
  x: number;
  y: number;
  hue: string;
  weight: number;
}

export class Piece {
  private readonly cvs: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: PieceInput;
  private readonly speeds: number[];
  private readonly pauses: ReturnType<typeof findPauses>;
  private readonly reduced: boolean;

  private W = 0;
  private H = 0;
  private DPR = 1;
  private box = { x: 0, y: 0, w: 0, h: 0 };
  /** Magnification and centring that fit the mark to its frame. */
  private fit = { k: 1, cx: 0.5, cy: 0.5 };
  private fontFamily = 'system-ui, sans-serif';
  private grain: HTMLCanvasElement | null = null;

  /** 0..1 while the line draws itself in, then pinned at 1. */
  private reveal = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  /** How much the craft was moved, 0..1. Sets the school, not the score. */
  private readonly busy: number;
  /** How much of the flight was spent hovering, 0..1. */
  private readonly stillness: number;

  private readonly onResize = () => {
    this.layout();
    this.draw();
  };

  constructor(canvas: HTMLCanvasElement, input: PieceInput) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.cvs = canvas;
    this.ctx = ctx;
    this.input = input;
    this.speeds = lateralSpeeds(input.line);
    this.pauses = findPauses(input.line);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.busy = clamp01(input.stats.path / BUSY_FULL);
    this.stillness = clamp01(input.stats.stillness);
  }

  start(): void {
    this.layout();
    addEventListener('resize', this.onResize);
    visualViewport?.addEventListener('resize', this.onResize);
    this.reveal = this.reduced ? 1 : 0;
    this.running = true;
    this.last = performance.now();
    if (this.reveal >= 1) this.draw();
    else this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    visualViewport?.removeEventListener('resize', this.onResize);
  }

  /** Draw the line in again from the start. */
  replay(): void {
    if (this.reduced) return;
    this.reveal = 0;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  private layout(): void {
    this.DPR = Math.min(devicePixelRatio || 1, 2.5);
    this.W = visibleWidth();
    this.H = visibleHeight();
    this.cvs.width = Math.round(this.W * this.DPR);
    this.cvs.height = Math.round(this.H * this.DPR);
    this.cvs.style.width = `${this.W}px`;
    this.cvs.style.height = `${this.H}px`;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.fontFamily = getComputedStyle(document.body).fontFamily || this.fontFamily;

    // A quiet flight gets a little more paper around it, but only a little.
    // Emptiness with a speck in the middle is an unfinished canvas, not
    // minimalism — the restraint has to be in the mark, not in its absence.
    const margin = this.W * (0.11 - 0.03 * this.busy);
    const side = Math.min(this.W - margin * 2, this.H * 0.56);
    this.box = {
      x: (this.W - side) / 2,
      y: this.H * 0.46 - side / 2,
      w: side,
      h: side
    };
    this.measureFit();
    this.grain = null;
  }

  /**
   * The mark always fills its frame.
   *
   * Drawn at a fixed scale, a flight that held its line is a ten-pixel dash
   * adrift in a square, which reads as nothing happening rather than as
   * something deliberate. Fitting the record's own bounds means a straight
   * flight arrives as one large confident stroke — unmistakably straight, and
   * worth looking at. How far the craft actually ranged is still legible: it is
   * carried by the *shape* of the mark and by how the ground is arranged, which
   * is where it belongs, rather than by the mark being too small to see.
   *
   * The magnification is capped so a nearly motionless flight is not blown up
   * into a portrait of its own noise.
   */
  private measureFit(): void {
    const line = this.input.line;
    if (line.length === 0) {
      this.fit = { k: 1, cx: 0.5, cy: 0.5 };
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of line) {
      if (p.nx < minX) minX = p.nx;
      if (p.nx > maxX) maxX = p.nx;
      if (p.ny < minY) minY = p.ny;
      if (p.ny > maxY) maxY = p.ny;
    }
    const extent = Math.max(maxX - minX, maxY - minY, 0.02);
    this.fit = {
      k: Math.min(7, 0.86 / extent),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2
    };
  }

  private at(nx: number, ny: number): { x: number; y: number } {
    const { k, cx, cy } = this.fit;
    return {
      x: this.box.x + (0.5 + (nx - cx) * k) * this.box.w,
      y: this.box.y + (0.5 + (ny - cy) * k) * this.box.h
    };
  }

  /**
   * One bloom per gate, in the hue of the column that was taken.
   *
   * Where it sits depends on how much there was to go on. A flight that ranged
   * about puts each bloom where the craft actually was as that gate went by, so
   * the colour is laid down at the place the answer was given. A flight that
   * held its line has no such geometry — every gate happened at nearly the same
   * spot — and placing eight blooms on top of each other mixes them to a brown
   * smudge, which is the ugliest possible reading of a calm day.
   *
   * So the placement slides toward a formal ring as the movement falls away.
   * Where there is a shape to follow, follow it; where there is none, compose
   * instead. Restraint comes out ordered rather than empty, and no two hues are
   * forced to muddy each other.
   */
  private blooms(): Bloom[] {
    const { line, answers } = this.input;
    if (line.length === 0) return [];
    const out: Bloom[] = [];
    const n = answers.length;
    const organic = clamp01(this.busy * 1.6);
    const ringR = 0.29;

    for (let i = 0; i < n; i++) {
      const a = answers[i];
      // Answers land in gate order, so the record divides evenly between them.
      const idx = Math.min(line.length - 1, Math.round(((i + 1) / n) * (line.length - 1)));
      const p = line[idx];

      // Clockwise from the top, so the ring reads in the order they were asked.
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const formalX = 0.5 + Math.cos(angle) * ringR;
      const formalY = 0.5 + Math.sin(angle) * ringR;

      const flown = this.at(p.nx, p.ny);
      const formal = {
        x: this.box.x + formalX * this.box.w,
        y: this.box.y + formalY * this.box.h
      };
      out.push({
        x: formal.x + (flown.x - formal.x) * organic,
        y: formal.y + (flown.y - formal.y) * organic,
        hue: HUES[Math.max(0, Math.min(HUES.length - 1, a.ix))],
        weight: 1
      });
    }
    return out;
  }

  private makeGrain(): HTMLCanvasElement {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) return c;
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 74;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  private draw(): void {
    const { ctx, W, H } = this;
    const { stats } = this.input;

    // A day that kept stopping warms the paper; one taken in a single breath
    // leaves it cool and graphic. Two tempers of the same material.
    const ground = mixHex(COOL_GROUND, WARM_GROUND, this.stillness);
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);

    this.drawGround();
    this.drawLine();
    this.drawPauses();
    this.drawMarks();
    this.drawGrain();
    this.drawFrame();
    void stats;
  }

  /** The wash of answer-hues the line sits on. */
  private drawGround(): void {
    const { ctx } = this;
    const blooms = this.blooms();
    if (blooms.length === 0) return;

    // Pausing is what makes the colour come up. Never stopping leaves a piece
    // that is cooler and more graphic rather than a piece that is washed out —
    // the floor is high enough that colour is always properly present.
    const chroma = 0.34 + 0.42 * this.stillness;
    // A tight flight keeps its colour close; a wandering one spreads it.
    const spread = this.box.w * (0.3 + 0.34 * this.busy);

    ctx.save();
    // Held inside the frame, so the result reads as something printed on a
    // sheet. Unclipped, the blooms tint the whole screen and the border stops
    // meaning anything.
    ctx.beginPath();
    ctx.rect(this.box.x, this.box.y, this.box.w, this.box.h);
    ctx.clip();
    // Multiply, so the hues sink into the paper like pigment rather than
    // sitting on it as chalk. Alpha-blended pastels on a light ground go
    // chalky and, where they overlap, grey.
    ctx.globalCompositeOperation = 'multiply';
    for (const b of blooms) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, spread * b.weight);
      g.addColorStop(0, rgbaFromHex(b.hue, chroma));
      g.addColorStop(0.55, rgbaFromHex(b.hue, chroma * 0.32));
      g.addColorStop(1, rgbaFromHex(b.hue, 0));
      ctx.fillStyle = g;
      ctx.fillRect(
        b.x - spread * b.weight,
        b.y - spread * b.weight,
        spread * b.weight * 2,
        spread * b.weight * 2
      );
    }
    ctx.restore();
  }

  /**
   * The record as ink.
   *
   * Points are laid down at equal intervals of *forward* travel, so holding the
   * craft still sideways piles many of them on one spot. Drawing every segment
   * at a low alpha lets that pile up on its own: the mark goes dark and solid
   * exactly where the flight settled, and stays a thin dry trace where it swept
   * through. Nothing computes the density — it accumulates.
   */
  private drawLine(): void {
    const { ctx } = this;
    const line = this.input.line;
    if (line.length < 2) return;

    const shown = Math.max(2, Math.floor(line.length * this.reveal));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const scale = this.box.w / 340;
    // Sideways speed that counts as fast, taken from this flight rather than a
    // constant, so a calm day still shows its own quick moments.
    const fastAt = Math.max(0.02, this.input.stats.peakLateral * 0.55);
    const BANDS = 5;

    // Runs of similar speed are stroked as one path. Segment-by-segment strokes
    // at low alpha bead at every joint, where two round caps overlap and the
    // alpha doubles — the record ends up looking like a string of pearls
    // instead of a drawn line.
    let start = 0;
    let band = -1;
    const flush = (from: number, to: number, b: number) => {
      if (to - from < 1 || b < 0) return;
      const speed = (b + 0.5) / BANDS;
      // Slow is a wide soft deposit, fast a drier trace — but the range is kept
      // narrow. Normalising speed inside each flight means a busy day reads as
      // fast everywhere, and letting that thin the whole mark to a whisper
      // would make the liveliest days the faintest pictures.
      const width = (1.1 + 1.9 * (1 - speed)) * scale;
      const alpha = 0.17 + 0.15 * (1 - speed);

      ctx.beginPath();
      const p0 = this.at(line[from].nx, line[from].ny);
      ctx.moveTo(p0.x, p0.y);
      for (let i = from + 1; i <= to; i++) {
        const p = this.at(line[i].nx, line[i].ny);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = `rgba(${INK},${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();

      // Moving fast drags the mark apart into colour, the way a quick pull
      // separates pigment. This is the "wilder the faster" — it rides the speed
      // of the hand, never the answer that was taken.
      if (speed > 0.3) {
        const off = (speed - 0.3) * 9 * scale;
        const fringe = 0.5 * (speed - 0.3);
        ctx.lineWidth = Math.max(0.5, width * 0.65);
        for (const [hue, dir] of [
          [HUES[2], 1],
          [HUES[0], -1]
        ] as const) {
          ctx.beginPath();
          let moved = false;
          for (let i = from; i <= to; i++) {
            const prev = line[Math.max(from, i - 1)];
            const cur = line[i];
            const dx = cur.nx - prev.nx;
            const dy = cur.ny - prev.ny;
            const len = Math.hypot(dx, dy) || 1;
            const p = this.at(cur.nx, cur.ny);
            const ox = (-dy / len) * off * dir;
            const oy = (dx / len) * off * dir;
            if (!moved) {
              ctx.moveTo(p.x + ox, p.y + oy);
              moved = true;
            } else {
              ctx.lineTo(p.x + ox, p.y + oy);
            }
          }
          ctx.strokeStyle = rgbaFromHex(hue, fringe);
          ctx.stroke();
        }
      }
    };

    for (let i = 1; i < shown; i++) {
      const b = Math.min(BANDS - 1, Math.floor(clamp01(this.speeds[i] / fastAt) * BANDS));
      if (band === -1) {
        band = b;
        start = i - 1;
      } else if (b !== band) {
        // Overlap by one segment so the bands join without a visible seam.
        flush(start, i - 1, band);
        band = b;
        start = i - 1;
      }
    }
    flush(start, shown - 1, band);
  }

  /**
   * Every place the thumb came off. These are the whole reason the record
   * carries a clock: a held breath before answering is the most human thing in
   * the flight, and until now it left nothing behind at all.
   */
  private drawPauses(): void {
    if (this.pauses.length === 0) return;
    const { ctx } = this;
    const line = this.input.line;
    const shown = Math.floor(line.length * this.reveal);
    const scale = this.box.w / 340;

    for (const pause of this.pauses) {
      if (pause.index > shown) continue;
      const { x, y } = this.at(pause.nx, pause.ny);
      const weight = clamp01(pause.seconds / PAUSE_FULL);
      const r = (5 + 20 * weight) * scale;

      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      g.addColorStop(0, `rgba(${INK},${0.1 + 0.12 * weight})`);
      g.addColorStop(1, `rgba(${INK},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(${INK},${0.16 + 0.3 * weight})`;
      ctx.lineWidth = 0.8 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawMarks(): void {
    const { ctx } = this;
    const line = this.input.line;
    if (line.length < 2) return;
    const scale = this.box.w / 340;
    const shown = Math.max(1, Math.floor(line.length * this.reveal)) - 1;

    const first = this.at(line[0].nx, line[0].ny);
    ctx.fillStyle = `rgba(${INK},0.5)`;
    ctx.beginPath();
    ctx.arc(first.x, first.y, 2.2 * scale, 0, Math.PI * 2);
    ctx.fill();

    const endPoint = line[Math.min(line.length - 1, shown)];
    const end = this.at(endPoint.nx, endPoint.ny);
    ctx.fillStyle = `rgba(${INK},0.9)`;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 3.4 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGrain(): void {
    const { ctx, W, H } = this;
    if (!this.grain) this.grain = this.makeGrain();
    const pattern = ctx.createPattern(this.grain, 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  private drawFrame(): void {
    const { ctx } = this;
    const b = this.box;
    ctx.strokeStyle = `rgba(${INK},0.16)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, Math.round(b.w), Math.round(b.h));

    const caption = this.input.caption;
    if (!caption) return;
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(${INK},0.55)`;
    ctx.font = `500 13px ${this.fontFamily}`;
    ctx.fillText(caption, b.x, b.y + b.h + 24);

    // A plain reading of the flight, on its own line — the two collide on a
    // narrow phone if they share one. Descriptive, never a mark out of ten.
    const s = this.input.stats;
    const parts: string[] = [];
    parts.push(s.path < 1.2 ? 'held a line' : s.path < 3.5 ? 'moved about' : 'ranged wide');
    if (s.timed) {
      parts.push(
        s.pauses === 0
          ? 'flown without stopping'
          : `${s.pauses} ${s.pauses === 1 ? 'pause' : 'pauses'}`
      );
    }
    ctx.fillStyle = `rgba(${INK},0.36)`;
    ctx.font = `400 12.5px ${this.fontFamily}`;
    ctx.fillText(parts.join(' · '), b.x, b.y + b.h + 43);
  }

  private readonly loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.048, (now - this.last) / 1000);
    this.last = now;
    // Eases out, so the line arrives rather than stopping dead.
    this.reveal = Math.min(1, this.reveal + dt / REVEAL_SECONDS);
    const eased = 1 - (1 - this.reveal) ** 2;
    const held = this.reveal;
    this.reveal = eased;
    this.draw();
    this.reveal = held;
    if (this.reveal >= 1) {
      this.reveal = 1;
      this.draw();
      // Finished pieces do not animate; stop the loop rather than idle on it.
      this.running = false;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}
