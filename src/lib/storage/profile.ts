import { applyPalette } from '../game/palette';
import { applyStyle } from '../game/pieceStyle';
import { currentStreak, rateFor, streakIncludingToday } from '../progress/credits';
import {
  paletteFor,
  pieceStyleFor,
  upgradeById,
  type Equipped,
  type UpgradeCategory
} from '../progress/upgrades';
import { get, PROFILE, put } from './db';
import { listEntries, localDay } from './entries';

/**
 * What carries across flights: the credit balance, what has been bought, and
 * the day the last award was paid.
 *
 * Kept in its own store rather than derived from the journal on every read,
 * because a balance has to survive deleting an entry — otherwise removing a
 * day you would rather not keep would also confiscate what it earned, and the
 * journal would stop being safe to prune.
 */

export const PROFILE_VERSION = 1;
/** There is exactly one of these; the store is keyed, so it needs an id. */
export const PROFILE_ID = 'profile';

export interface Profile {
  id: string;
  /** Unspent credits. */
  credits: number;
  /** Lifetime earned, for the collection view. Never decreases. */
  earned: number;
  /** Local day of the most recent award, so a second flight pays nothing. */
  lastEarnedDay: string | null;
  owned: string[];
  equipped: Equipped;
  version: number;
}

export function emptyProfile(): Profile {
  return {
    id: PROFILE_ID,
    credits: 0,
    earned: 0,
    lastEarnedDay: null,
    owned: [],
    equipped: {},
    version: PROFILE_VERSION
  };
}

export async function loadProfile(): Promise<Profile> {
  const stored = await get<Profile>(PROFILE, PROFILE_ID);
  if (!stored) return emptyProfile();
  // Merge over a fresh one so a record written by an older build gains any
  // field added since without a migration step.
  return { ...emptyProfile(), ...stored, id: PROFILE_ID };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await put(PROFILE, profile);
}

export function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<Profile>;
  return typeof p.credits === 'number' && typeof p.earned === 'number' && Array.isArray(p.owned);
}

/** Push the equipped skins into the live canvas palette. */
export function applyProfileSkin(profile: Profile): void {
  applyPalette(paletteFor(profile.equipped));
  applyStyle(pieceStyleFor(profile.equipped));
}

export interface Award {
  /** Credits paid. Zero when this was not the day's first flight. */
  credits: number;
  /** The streak this flight landed on, today counted. */
  streak: number;
  /** Credits per gate at that streak. */
  rate: number;
  gates: number;
  /** False when today had already been paid. */
  first: boolean;
}

/**
 * Pay for a completed flight, if it is the first of the local day.
 *
 * Note what is passed in: a gate count, not the answers. The award cannot see
 * which openings were flown through, which is the whole point — see
 * `lib/progress/credits.ts`.
 */
export async function awardFlight(gates: number, ts = Date.now()): Promise<Award> {
  const today = localDay(ts);
  const profile = await loadProfile();

  // Streaks are read from the journal rather than tracked incrementally, so an
  // imported backup restores the streak it actually earned.
  const days = (await listEntries()).map((e) => e.day);
  const streak = streakIncludingToday(days, today);
  const rate = rateFor(streak);
  const first = profile.lastEarnedDay !== today;
  const credits = first ? Math.max(0, Math.floor(gates)) * rate : 0;

  if (first) {
    profile.credits += credits;
    profile.earned += credits;
    profile.lastEarnedDay = today;
    await saveProfile(profile);
  }
  return { credits, streak, rate, gates, first };
}

/** Re-exported so callers do not reach past this module into the rules. */
export { rateFor as ratePerGate };

/** The streak as it stands right now, for display. */
export async function streakNow(ts = Date.now()): Promise<number> {
  const days = (await listEntries()).map((e) => e.day);
  return currentStreak(days, localDay(ts));
}

export type PurchaseResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'unknown' | 'owned' | 'funds' };

/** Buy an upgrade and equip it. Permanent; equipping is free afterwards. */
export async function buyUpgrade(id: string): Promise<PurchaseResult> {
  const upgrade = upgradeById(id);
  if (!upgrade) return { ok: false, reason: 'unknown' };
  const profile = await loadProfile();
  if (profile.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (profile.credits < upgrade.cost) return { ok: false, reason: 'funds' };

  profile.credits -= upgrade.cost;
  profile.owned = [...profile.owned, id];
  profile.equipped = { ...profile.equipped, [upgrade.category]: id };
  await saveProfile(profile);
  applyProfileSkin(profile);
  return { ok: true, profile };
}

/** Equip an owned skin, or pass null to go back to the base look. */
export async function equipUpgrade(
  category: UpgradeCategory,
  id: string | null
): Promise<Profile> {
  const profile = await loadProfile();
  if (id && !profile.owned.includes(id)) return profile;
  const equipped = { ...profile.equipped };
  if (id) equipped[category] = id;
  else delete equipped[category];
  profile.equipped = equipped;
  await saveProfile(profile);
  applyProfileSkin(profile);
  return profile;
}
