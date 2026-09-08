import { QUESTIONS } from '../game/questions';
import type { Entry } from '../storage/entries';

/**
 * The journal, read across days instead of one flight at a time.
 *
 * Until now every item a gate dropped was visible only inside the entry that
 * produced it, so eight materials a day accumulated into nothing you could
 * look at. This is the layer that adds them up, and that turns a fortnight of
 * answers into a shape you can read at a glance.
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

export interface MaterialTally {
  item: string;
  count: number;
  refined: boolean;
}

/** Every material ever gathered, most plentiful first. */
export function tallyMaterials(entries: readonly Entry[]): MaterialTally[] {
  const counts = new Map<string, MaterialTally>();
  for (const entry of entries) {
    for (const answer of entry.answers) {
      const held = counts.get(answer.item);
      if (held) held.count++;
      else counts.set(answer.item, { item: answer.item, count: 1, refined: answer.refined });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
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
  materials: number;
  distinctMaterials: number;
}

export function summarise(entries: readonly Entry[]): CollectionSummary {
  const tally = tallyMaterials(entries);
  return {
    flights: entries.length,
    days: new Set(entries.map((e) => e.day)).size,
    materials: tally.reduce((n, t) => n + t.count, 0),
    distinctMaterials: tally.length
  };
}
