import { isEntry, listEntries, saveEntry, type Entry } from './entries';
import { isProfile, loadProfile, saveProfile, type Profile } from './profile';

/**
 * Export and import exist because on-device storage is the default and iOS
 * evicts site data for pages the user has not installed to the home screen.
 * A journal you cannot get out of the phone is a journal you can lose.
 *
 * The profile rides along, so moving phones keeps the credits and the skins
 * that were bought with them rather than resetting progress to zero.
 */

const FORMAT = 'logline-journal';
/** 2 added the profile. Version 1 files still import — they simply have none. */
const FORMAT_VERSION = 2;

interface Backup {
  format: string;
  version: number;
  exportedAt: string;
  entries: Entry[];
  profile?: Profile;
}

export async function exportEntries(): Promise<number> {
  const entries = await listEntries();
  const payload: Backup = {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
    profile: await loadProfile()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logline-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return entries.length;
}

export interface ImportReport {
  added: number;
  skipped: number;
  /** True when the file's credits and upgrades were adopted. */
  progressRestored: boolean;
}

export async function importEntries(file: File): Promise<ImportReport> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not readable JSON.');
  }
  const backup = parsed as Partial<Backup>;
  if (backup.format !== FORMAT || !Array.isArray(backup.entries)) {
    throw new Error('That is not a Logline export.');
  }

  const existing = new Set((await listEntries()).map((e) => e.id));
  let added = 0;
  let skipped = 0;
  for (const row of backup.entries) {
    if (!isEntry(row) || existing.has(row.id)) {
      skipped++;
      continue;
    }
    await saveEntry(row);
    existing.add(row.id);
    added++;
  }

  // Progress is restored only onto a device that has none. Two balances cannot
  // be merged without either inventing credits or destroying them, and silently
  // overwriting a balance someone has been building would be worse than either.
  let progressRestored = false;
  const current = await loadProfile();
  if (isProfile(backup.profile) && current.earned === 0 && current.owned.length === 0) {
    await saveProfile({ ...backup.profile, id: current.id });
    progressRestored = true;
  }

  return { added, skipped, progressRestored };
}
