import { QUESTIONS } from '../game/questions';
import type { Entry } from '../storage/entries';

/**
 * The journal, read across days instead of one flight at a time: what turns a
 * fortnight of answers into a shape you can read at a glance.
 *
 * Pure: entries in, plain values out. Nothing here touches storage or the DOM.
 */

/** One flight per day — the day's first, matching the one credits pay for. */
export function firstFlightPerDay(entries: readonly Entry[]): Entry[] {
  const byDay = new Map<string, Entry>();
  for (const entry of entries) {
    const held = byDay.get(entry.day);
    if (!held || entry.ts < held.ts) byDay.set(entry.day, entry);
  }
  return [...byDay.values()].sort((a, b) => a.ts - b.ts);
}

export interface DayCell {
  /** YYYY-MM-DD, or null for the blank days padding the first and last weeks. */
  day: string | null;
  date: number;
  /**
   * Column index answered that day. Null both when nothing was flown and when
   * the question was flown over — `flown` is what tells those apart, and they
   * have to look different: one is a day that did not happen, the other is a
   * day someone chose not to answer, which is a real entry in a record.
   */
  ix: number | null;
  flown: boolean;
  label: string | null;
}

export interface QuestionMonth {
  q: string;
  /** Labels for the low and high end, so the ramp is never read as a verdict. */
  low: string;
  high: string;
  steps: number;
  weeks: DayCell[][];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The weeks of one month, Monday first, padded out to whole weeks.
 *
 * Days are built as local calendar strings rather than from timestamps, to
 * match how entries record their own day — going through `Date` in UTC would
 * slide the whole grid by one across most of the world.
 */
export function monthWeeks(year: number, month: number): (string | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * One month of days per question — the journal read as a calendar.
 *
 * The day's *first* flight is the one shown, matching the flight credits pay
 * for and the flight the trends plot. A second flight on the same day is kept
 * in full and is reachable from the day it belongs to; it just does not get to
 * overwrite the day's colour.
 */
export function monthByQuestion(
  entries: readonly Entry[],
  year: number,
  month: number
): QuestionMonth[] {
  const byDay = new Map(firstFlightPerDay(entries).map((entry) => [entry.day, entry]));
  const weeks = monthWeeks(year, month);
  return QUESTIONS.map((question) => {
    const steps = question.cols.length;
    const xAxis = question.xAxis;
    return {
      q: question.q,
      low: xAxis ? xAxis[0] : question.cols[0],
      high: xAxis ? xAxis[1] : question.cols[steps - 1],
      steps,
      weeks: weeks.map((week) =>
        week.map((day) => {
          if (!day) return { day: null, date: 0, ix: null, flown: false, label: null };
          const date = Number(day.slice(8));
          const entry = byDay.get(day);
          if (!entry) return { day, date, ix: null, flown: false, label: null };
          const answer = entry.answers.find((a) => a.q === question.q);
          return {
            day,
            date,
            ix: answer ? answer.ix : null,
            flown: true,
            label: answer ? answer.label : null
          };
        })
      )
    };
  });
}

export interface TrendPoint {
  day: string;
  ts: number;
  /** Column index, 0..steps-1. */
  ix: number;
  label: string;
}

export interface Trend {
  q: string;
  /** Labels for the low and high end of the scale. */
  low: string;
  high: string;
  /** How many columns the gate has, so a point can be placed on the scale. */
  steps: number;
  points: TrendPoint[];
}

/**
 * One series per question, oldest point first.
 *
 * The index is reported as it is — no scale is called good or bad, and nothing
 * here ranks a day. It is a shape to notice, not a score to beat.
 */
export function trends(entries: readonly Entry[], maxDays = 14): Trend[] {
  const days = firstFlightPerDay(entries).slice(-maxDays);
  return QUESTIONS.map((question) => {
    const steps = question.cols.length;
    const xAxis = question.xAxis;
    const points: TrendPoint[] = [];
    for (const entry of days) {
      const answer = entry.answers.find((a) => a.q === question.q);
      if (!answer) continue;
      points.push({ day: entry.day, ts: entry.ts, ix: answer.ix, label: answer.label });
    }
    return {
      q: question.q,
      low: xAxis ? xAxis[0] : question.cols[0],
      high: xAxis ? xAxis[1] : question.cols[steps - 1],
      steps,
      points
    };
  }).filter((t) => t.points.length > 0);
}

export interface CollectionSummary {
  flights: number;
  days: number;
}

export function summarise(entries: readonly Entry[]): CollectionSummary {
  return {
    flights: entries.length,
    days: new Set(entries.map((e) => e.day)).size
  };
}
