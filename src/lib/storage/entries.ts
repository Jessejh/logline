import { computeStats, findPauses, type FlightStats } from '../game/stats';
import type { Answer, FlightResult, LinePoint } from '../game/types';
import { all, ENTRIES, put, remove } from './db';

/**
 * 2 added a clock on each line point and the flight statistics. 3 replaced the
 * material each cell dropped with the colour it gives up — older answers carry
 * neither, and `colorOf` resolves their colour from the question instead.
 */
export const ENTRY_VERSION = 3;

export interface Entry {
  /** Unique per flight, not per day — flying twice keeps both records. */
  id: string;
  /** Epoch milliseconds at completion. */
  ts: number;
  /** Local calendar day, YYYY-MM-DD, for grouping. */
  day: string;
  answers: Answer[];
  line: LinePoint[];
  /**
   * How the flight was flown. Taken from the full-resolution line before it is
   * thinned, because compression flattens the small corrections these measure.
   * Absent on records written before version 2 — recompute from `line` for
   * those and accept that the fine detail, and the clock, are gone.
   */
  stats?: FlightStats;
  version: number;
}

/** Points kept per record. Enough to preserve the shape, small enough that a
 *  year of entries fits the localStorage fallback quota. */
const MAX_POINTS = 160;

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * Uniformly thin the flight trail, always keeping the first and last point.
 *
 * Any point that a pause happened at is kept whatever the stride says. Thinning
 * is blind to the clock, so a plain every-Nth pass would drop one side of a gap
 * and take the pause with it — and pauses are the sparsest, most fragile thing
 * in the record.
 */
export function compressLine(line: readonly LinePoint[]): LinePoint[] {
  if (line.length === 0) return [];
  const stride = Math.max(1, Math.ceil(line.length / MAX_POINTS));
  const keep = new Set<number>();
  for (let i = 0; i < line.length; i += stride) keep.add(i);
  keep.add(0);
  keep.add(line.length - 1);
  for (const pause of findPauses(line)) {
    keep.add(pause.index);
    keep.add(Math.min(line.length - 1, pause.index + 1));
  }
  return [...keep]
    .sort((a, b) => a - b)
    .map((i) => {
      const p = line[i];
      const out: LinePoint = { nx: round(p.nx, 3), ny: round(p.ny, 3), z: round(p.z, 2) };
      if (p.t !== undefined) out.t = round(p.t, 2);
      return out;
    });
}

export function localDay(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function makeEntry(result: FlightResult, ts = Date.now()): Entry {
  return {
    id: `${new Date(ts).toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    ts,
    day: localDay(ts),
    answers: result.answers,
    line: compressLine(result.line),
    // Measured before the thinning, which is the only place the full detail
    // still exists.
    stats: computeStats(result.line),
    version: ENTRY_VERSION
  };
}

/** The flight's character, recomputed for records that predate `stats`. */
export function statsFor(entry: Entry): FlightStats {
  return entry.stats ?? computeStats(entry.line);
}

export async function saveEntry(entry: Entry): Promise<void> {
  await put(ENTRIES, entry);
}

/** Newest first. */
export async function listEntries(): Promise<Entry[]> {
  const rows = await all<Entry>(ENTRIES);
  return rows.sort((a, b) => b.ts - a.ts);
}

export async function removeEntry(id: string): Promise<void> {
  await remove(ENTRIES, id);
}

export function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Partial<Entry>;
  return (
    typeof e.id === 'string' &&
    typeof e.ts === 'number' &&
    typeof e.day === 'string' &&
    Array.isArray(e.answers) &&
    Array.isArray(e.line)
  );
}
