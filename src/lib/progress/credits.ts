/**
 * What a flight is worth.
 *
 * One rule holds this file together: **the award is blind to the answers.**
 * It reads how many gates were passed and how many days in a row have been
 * logged. It never reads a cell index, an edge flag or a refined flag, and it
 * must stay that way — the moment an answer is worth more than its neighbour,
 * people answer for credits and the journal stops being a record of anything.
 * `docs/DESIGN.md` calls this the resource-farming risk; this is where it is
 * actually prevented.
 *
 * Because every gate yields regardless of which opening you take, and every
 * flight has the same eight gates, a day's earnings are the same whatever kind
 * of day it was. A hard week pays exactly what a good week pays.
 *
 * Pure functions over plain values: no storage, no DOM, no framework.
 */

/** Credits for passing one gate at a streak of one. */
export const BASE_PER_GATE = 3;
/** Added to the per-gate rate for each consecutive day beyond the first. */
export const STREAK_STEP = 1;
/** The streak bonus stops climbing here, so a long streak stays a habit
 *  rather than a thing you cannot afford to break. */
export const STREAK_CAP = 5;

/** Move a YYYY-MM-DD day string by whole days, staying in local time. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Credits per gate at this streak length. */
export function rateFor(streak: number): number {
  const bonus = Math.min(Math.max(streak - 1, 0), STREAK_CAP);
  return BASE_PER_GATE + bonus * STREAK_STEP;
}

/** What a flight of `gates` gates pays at this streak. */
export function awardFor(gates: number, streak: number): number {
  return Math.max(0, Math.floor(gates)) * rateFor(streak);
}

/** How many days run back unbroken from `day`, counting `day` itself. */
function runEndingAt(days: ReadonlySet<string>, day: string): number {
  if (!days.has(day)) return 0;
  let n = 0;
  let cursor = day;
  while (days.has(cursor)) {
    n++;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

/**
 * The streak as it stands today. A day logged yesterday still counts while
 * today is unspent — the streak breaks at the end of a missed day, not at
 * midnight of the one you are living in.
 */
export function currentStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  if (set.has(today)) return runEndingAt(set, today);
  const yesterday = shiftDay(today, -1);
  if (set.has(yesterday)) return runEndingAt(set, yesterday);
  return 0;
}

/** The streak a flight completed today would land on, today included. */
export function streakIncludingToday(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  set.add(today);
  return runEndingAt(set, today);
}

/** The longest unbroken run ever logged. */
export function longestStreak(days: Iterable<string>): number {
  const set = new Set(days);
  let best = 0;
  for (const day of set) {
    // Only measure from a run's first day, so each run is walked once.
    if (set.has(shiftDay(day, -1))) continue;
    let n = 0;
    let cursor = day;
    while (set.has(cursor)) {
      n++;
      cursor = shiftDay(cursor, 1);
    }
    best = Math.max(best, n);
  }
  return best;
}
