<script lang="ts">
  import { exportEntries, importEntries } from '../lib/storage/backup';
  import { isDurable } from '../lib/storage/db';
  import { listEntries, removeEntry, type Entry } from '../lib/storage/entries';
  import InstallHint from './InstallHint.svelte';
  import LineMini from './LineMini.svelte';

  let { onBack, onChanged, onView }: {
    onBack: () => void;
    onChanged: () => void;
    onView: (entry: Entry) => void;
  } = $props();

  let entries = $state<Entry[]>([]);
  let openId = $state<string | null>(null);
  let status = $state<string | null>(null);
  let durable = $state(true);
  let fileInput = $state<HTMLInputElement | null>(null);

  async function refresh() {
    entries = await listEntries();
    durable = await isDurable();
    onChanged();
  }

  $effect(() => {
    void refresh();
  });

  const dayFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

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
    if (openId === entry.id) openId = null;
    status = 'Entry deleted.';
    await refresh();
  }
</script>

<div class="veil top">
  <h2>Logline</h2>

  {#if entries.length === 0}
    <p class="caption">No entries yet. Fly once and today's line lands here.</p>
  {/if}

  {#each entries as entry (entry.id)}
    <div class="entry">
      <button
        class="head"
        aria-expanded={openId === entry.id}
        onclick={() => (openId = openId === entry.id ? null : entry.id)}
      >
        <span class="date">{dayFormat.format(entry.ts)}</span>
        <span class="time">{timeFormat.format(entry.ts)}</span>
      </button>
      <LineMini line={entry.line} height={40} />
      {#if openId === entry.id}
        <div class="detail">
          {#each entry.answers as answer (answer.q)}
            <div class="row">
              <span class="q">{answer.q}</span>
              <span class="a" class:edge={answer.edge}>{answer.label}</span>
            </div>
          {/each}
          <div class="chips">
            {#each entry.answers as answer (answer.q)}
              <span class="chip {answer.refined ? 'ref' : 'raw'}">{answer.item}</span>
            {/each}
          </div>
          <div class="actions tight">
            <button class="small quiet" onclick={() => onView(entry)}>Turn it in 3D</button>
            <button class="small quiet danger" onclick={() => onDelete(entry)}>Delete entry</button>
          </div>
        </div>
      {/if}
    </div>
  {/each}

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
  .entry {
    margin-bottom: 18px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    width: 100%;
    border: none;
    border-bottom: 1px solid rgba(45, 107, 122, 0.22);
    padding: 8px 0;
    margin-bottom: 8px;
    color: var(--ice);
    text-align: left;
  }

  .date {
    font-family: var(--serif);
    font-size: 16px;
    color: var(--bright);
  }

  .time {
    font-size: 12.5px;
    color: var(--dim);
  }

  .detail {
    margin-top: 12px;
  }

  .detail .chips {
    margin-top: 14px;
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
