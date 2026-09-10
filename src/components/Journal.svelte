<script lang="ts">
  import { firstFlightPerDay, monthByQuestion } from '../lib/progress/collection';
  import { exportEntries, importEntries } from '../lib/storage/backup';
  import { isDurable } from '../lib/storage/db';
  import { listEntries, removeEntry, type Entry } from '../lib/storage/entries';
  import Calendar from './Calendar.svelte';
  import InstallHint from './InstallHint.svelte';

  let { onBack, onChanged, onView }: {
    onBack: () => void;
    onChanged: () => void;
    onView: (entry: Entry) => void;
  } = $props();

  let entries = $state<Entry[]>([]);
  let status = $state<string | null>(null);
  let durable = $state(true);
  let fileInput = $state<HTMLInputElement | null>(null);

  const now = new Date();
  let year = $state(now.getFullYear());
  let month = $state(now.getMonth());
  /** Which calendar the open day was tapped in, so the detail opens in place. */
  let openIn = $state<number | null>(null);
  let openDay = $state<string | null>(null);

  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const dayFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const months = $derived(monthByQuestion(entries, year, month));
  const byDay = $derived(new Map(firstFlightPerDay(entries).map((e) => [e.day, e])));
  const openEntry = $derived(openDay ? (byDay.get(openDay) ?? null) : null);
  /** No flying ahead of time: the month after this one is not a place to go. */
  const atLatest = $derived(year === now.getFullYear() && month === now.getMonth());

  async function refresh() {
    entries = await listEntries();
    durable = await isDurable();
    onChanged();
  }

  $effect(() => {
    void refresh();
  });

  function step(by: number) {
    const d = new Date(year, month + by, 1);
    year = d.getFullYear();
    month = d.getMonth();
    openIn = null;
    openDay = null;
  }

  function select(index: number, day: string) {
    if (openIn === index && openDay === day) {
      openIn = null;
      openDay = null;
      return;
    }
    openIn = index;
    openDay = day;
  }

  async function onExport() {
    try {
      const n = await exportEntries();
      status = `Exported ${n} ${n === 1 ? 'entry' : 'entries'}.`;
    } catch {
      status = 'Export failed.';
    }
  }

  async function onImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const report = await importEntries(file);
      status =
        `Imported ${report.added}, skipped ${report.skipped} already here.` +
        (report.progressRestored ? ' Credits and upgrades restored too.' : '');
      await refresh();
    } catch (err) {
      status = err instanceof Error ? err.message : 'Import failed.';
    }
  }

  async function onDelete(entry: Entry) {
    if (!confirm('Delete this entry? It is only on this device.')) return;
    await removeEntry(entry.id);
    openIn = null;
    openDay = null;
    status = 'Entry deleted.';
    await refresh();
  }
</script>

<div class="veil top">
  <h2>Logline</h2>

  {#if entries.length === 0}
    <p class="caption">No entries yet. Fly once and today's line lands here.</p>
  {:else}
    <div class="nav">
      <button class="small quiet" onclick={() => step(-1)} aria-label="Previous month">‹</button>
      <span class="month">{monthFormat.format(new Date(year, month, 1))}</span>
      <button
        class="small quiet"
        onclick={() => step(1)}
        disabled={atLatest}
        aria-label="Next month">›</button
      >
    </div>

    {#each months as calendar, i (calendar.q)}
      <Calendar
        month={calendar}
        today={today}
        selected={openIn === i ? openDay : null}
        onSelect={(day) => select(i, day)}
      />

      {#if openIn === i && openEntry && openDay}
        <div class="detail">
          <p class="when">{dayFormat.format(openEntry.ts)}</p>
          <p class="said">
            {calendar.weeks
              .flat()
              .find((cell) => cell.day === openDay)?.label ?? 'left open'}
          </p>
          <div class="actions tight">
            <button class="small quiet" onclick={() => onView(openEntry)}>See the piece</button>
            <button class="small quiet danger" onclick={() => onDelete(openEntry)}>
              Delete entry
            </button>
          </div>
        </div>
      {/if}
    {/each}
  {/if}

  <div class="keeping">
    <p class="caption">Keeping these</p>
    <p class="fine">
      Entries live on this device only — nothing is uploaded. Export a copy before changing phone or
      clearing browser data.
      {#if !durable}
        This browser refused persistent storage, so entries are being held in a smaller fallback —
        export more often.
      {/if}
    </p>
    <div class="actions tight">
      <button class="small quiet" onclick={onExport}>Export JSON</button>
      <button class="small quiet" onclick={() => fileInput?.click()}>Import</button>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      onchange={onImportFile}
      hidden
    />
    {#if status}
      <p class="status">{status}</p>
    {/if}
  </div>

  <InstallHint />

  <div class="actions">
    <button onclick={onBack}>Back</button>
  </div>
</div>

<style>
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 20px;
  }

  .month {
    font-family: var(--serif);
    font-size: 17px;
    color: var(--bright);
  }

  .nav button {
    min-width: 44px;
  }

  .nav button:disabled {
    opacity: 0.3;
  }

  .detail {
    margin: -14px 0 26px;
    padding: 12px 14px;
    border: 1px solid rgba(45, 107, 122, 0.35);
    border-radius: 2px;
  }

  .when {
    font-family: var(--serif);
    font-size: 15px;
    color: var(--bright);
  }

  .said {
    margin-top: 2px;
    font-size: 14px;
    color: var(--mid);
  }

  .danger {
    border-color: rgba(232, 184, 122, 0.3);
    color: var(--mid);
  }

  .keeping {
    margin-top: 26px;
    padding-top: 18px;
    border-top: 1px solid rgba(45, 107, 122, 0.18);
  }

  .fine {
    font-size: 13px;
    line-height: 1.6;
    color: var(--mid);
  }

  .actions.tight {
    margin-top: 14px;
  }

  .status {
    margin-top: 12px;
    font-size: 13px;
    color: var(--lamp);
  }
</style>
