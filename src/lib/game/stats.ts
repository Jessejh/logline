import type { LinePoint } from './types';

/**
 * What the flying itself was like, as numbers.
 *
 * These describe *how* the craft was moved, never *where* it ended up, so
 * nothing here can be read as an answer or ranked against another day. That
 * matters: the piece is drawn from these, and the moment one of them means
 * "better" the app has started scoring the grading phase through the back door
 * and teaching people how to fly — which would bend the answers with it.
 * Wandering and going straight are two temperaments, and both have to render
 * as something worth keeping.
 *
 * Computed on the full-resolution line. `compressLine` thins the record to 160
 * points before it is stored, which flattens exactly the small corrections
 * these measure, so the numbers are taken first and travel with the entry.
 *
 * Pure: points in, values out. No storage, no DOM, no framework.
 */

/**
 * A gap in the clock wider than this, across points that are adjacent in
 * distance, is the thumb having come off. Points land about every 17ms while
 * flying, so this is roughly fifteen frames of nothing.
 */
const PAUSE_MIN = 0.25;

export interface FlightStats {
  /** Distance travelled inside the gate frame, in frame widths. */
  path: number;
  /** Straight-line distance from first point to last, in frame widths. */
  span: number;
  /** `path / span`. 1 is a dead straight run; higher wandered more. */
  tortuosity: number;
  /** Total heading change, radians. Separates one long arc from many wiggles. */
  turning: number;
  /** Mean sideways speed, frame widths per unit of forward travel. */
  meanLateral: number;
  /** The fastest single sideways move, same units. */
  peakLateral: number;
  /** Fraction of the frame's area the flight's bounding box covered, 0..1. */
  extent: number;
  /** Seconds spent hovering with the thumb up. 0 when the record has no clock. */
  paused: number;
  /** Number of distinct pauses. */
  pauses: number;
  /** Seconds from first point to last, hovering included. 0 without a clock. */
  duration: number;
  /**
   * `paused / duration`, 0..1. Low is a flight taken in one breath; high is one
   * that kept stopping. Neither is the better number.
   */
  stillness: number;
  /** True when the record carried a clock and the pause figures are real. */
  timed: boolean;
}

export function emptyStats(): FlightStats {
  return {
    path: 0,
    span: 0,
    tortuosity: 1,
    turning: 0,
    meanLateral: 0,
    peakLateral: 0,
    extent: 0,
    paused: 0,
    pauses: 0,
    duration: 0,
    stillness: 0,
    timed: false
  };
}

/** Where the flight stopped, and for how long, in the order they happened. */
export interface Pause {
  /** Index of the point the craft was sitting on. */
  index: number;
  nx: number;
  ny: number;
  seconds: number;
}

export function findPauses(line: readonly LinePoint[]): Pause[] {
  const out: Pause[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (a.t === undefined || b.t === undefined) continue;
    const gap = b.t - a.t;
    if (gap > PAUSE_MIN) out.push({ index: i - 1, nx: a.nx, ny: a.ny, seconds: gap });
  }
  return out;
}

export function computeStats(line: readonly LinePoint[]): FlightStats {
  const stats = emptyStats();
  if (line.length < 2) return stats;

  let path = 0;
  let turning = 0;
  let peak = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let prevAngle: number | null = null;
  let forward = 0;

  for (let i = 0; i < line.length; i++) {
    const p = line[i];
    if (p.nx < minX) minX = p.nx;
    if (p.nx > maxX) maxX = p.nx;
    if (p.ny < minY) minY = p.ny;
    if (p.ny > maxY) maxY = p.ny;
    if (i === 0) continue;

    const q = line[i - 1];
    const dx = p.nx - q.nx;
    const dy = p.ny - q.ny;
    const step = Math.hypot(dx, dy);
    path += step;

    const dz = Math.max(1e-6, p.z - q.z);
    forward += dz;
    peak = Math.max(peak, step / dz);

    // A heading only means something once the craft has actually moved; taking
    // one off a near-zero step would read as violent turning while hovering.
    if (step > 1e-4) {
      const angle = Math.atan2(dy, dx);
      if (prevAngle !== null) {
        let d = angle - prevAngle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        turning += Math.abs(d);
      }
      prevAngle = angle;
    }
  }

  const first = line[0];
  const last = line[line.length - 1];
  const span = Math.hypot(last.nx - first.nx, last.ny - first.ny);

  stats.path = path;
  stats.span = span;
  stats.tortuosity = span > 1e-3 ? path / span : path > 1e-3 ? 12 : 1;
  stats.turning = turning;
  stats.meanLateral = forward > 0 ? path / forward : 0;
  stats.peakLateral = peak;
  stats.extent = Math.max(0, Math.min(1, (maxX - minX) * (maxY - minY)));

  const timed = first.t !== undefined && last.t !== undefined;
  if (timed) {
    const pauses = findPauses(line);
    stats.timed = true;
    stats.pauses = pauses.length;
    stats.paused = pauses.reduce((n, p) => n + p.seconds, 0);
    stats.duration = Math.max(0, (last.t as number) - (first.t as number));
    stats.stillness = stats.duration > 0 ? Math.min(1, stats.paused / stats.duration) : 0;
  }

  return stats;
}

/**
 * Sideways speed at each point, in frame widths per unit of forward travel,
 * smoothed a little so a single noisy sample doesn't spike the line's width.
 */
export function lateralSpeeds(line: readonly LinePoint[]): number[] {
  const raw = new Array<number>(line.length).fill(0);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const dz = Math.max(1e-6, b.z - a.z);
    raw[i] = Math.hypot(b.nx - a.nx, b.ny - a.ny) / dz;
  }
  if (raw.length > 1) raw[0] = raw[1];

  const out = new Array<number>(raw.length).fill(0);
  for (let i = 0; i < raw.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      sum += raw[j];
      n++;
    }
    out[i] = sum / n;
  }
  return out;
}
