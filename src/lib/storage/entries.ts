import type { Answer, FlightResult, LinePoint } from '../game/types';
import { all, ENTRIES, put, remove } from './db';

export const ENTRY_VERSION = 1;

export interface Entry {
  /** Unique per flight, not per day — flying twice keeps both records. */
  id: string;
  /** Epoch milliseconds at completion. */
  ts: number;
  /** Local calendar day, YYYY-MM-DD, for grouping. */
  day: string;
  answers: Answer[];
  line: LinePoint[];
  version: number;
}

/** Points kept per record. Enough to preserve the shape, small enough that a
 *  year of entries fits the localStorage fallback quota. */
const MAX_POINTS = 160;

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Uniformly thin the flight trail, always keeping the first and last point. */
export function compressLine(line: readonly LinePoint[]): LinePoint[] {
  if (line.length === 0) return [];
  const stride = Math.max(1, Math.ceil(line.length / MAX_POINTS));
  const out: LinePoint[] = [];
  for (let i = 0; i < line.length; i += stride) out.push(line[i]);
  const last = line[line.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out.map((p) => ({ nx: round(p.nx, 3), ny: round(p.ny, 3), z: round(p.z, 2) }));
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
    version: ENTRY_VERSION
  };
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
