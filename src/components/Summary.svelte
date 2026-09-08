<script lang="ts">
  import type { Entry } from '../lib/storage/entries';
  import type { Award } from '../lib/storage/profile';
  import LineMini from './LineMini.svelte';
  import InstallHint from './InstallHint.svelte';

  let { entry, saveError, award, onAgain, onArtwork, onJournal, onCollection }: {
    entry: Entry;
    saveError: string | null;
    award: Award | null;
    onAgain: () => void;
    onArtwork: () => void;
    onJournal: () => void;
    onCollection: () => void;
  } = $props();

  const raw = $derived(entry.answers.filter((a) => !a.refined).length);
  const refined = $derived(entry.answers.length - raw);
</script>

<div class="veil top">
  <h2>Today's logline</h2>

  {#each entry.answers as answer (answer.q)}
    <div class="row">
      <span class="q">{answer.q}</span>
      <span class="a" class:edge={answer.edge}>{answer.label}</span>
    </div>
  {/each}

  <div class="lines">
    <p class="caption">The line you drew</p>
    <LineMini line={entry.line} />
    <button class="small quiet turn" onclick={onArtwork}>Turn it in 3D</button>
  </div>

  <div class="haul">
    <p class="caption">Gathered — {raw} raw, {refined} refined</p>
    <div class="chips">
      {#each entry.answers as answer (answer.q)}
        <span class="chip {answer.refined ? 'ref' : 'raw'}">{answer.item}</span>
      {/each}
    </div>
  </div>

  {#if award}
    <div class="earned">
      {#if award.first}
        <p class="caption">Earned</p>
        <p class="sum">
          <b>{award.credits}</b> credits — {award.gates} gates at {award.rate} each
        </p>
        <p class="fine">
          {#if award.streak > 1}
            {award.streak} days running, which is what lifted the rate.
          {:else}
            Fly again tomorrow and the rate goes up.
          {/if}
        </p>
      {:else}
        <p class="caption">Already logged today</p>
        <p class="fine">
          Today's credits were paid on the first flight. This one is kept in the journal all the
          same — flying again is free, it just doesn't pay twice.
        </p>
      {/if}
    </div>
  {/if}

  {#if saveError}
    <p class="warn">{saveError}</p>
  {/if}

  <InstallHint />

  <div class="actions">
    <button onclick={onAgain}>Fly again</button>
    <button class="quiet" onclick={onCollection}>Gathered</button>
    <button class="quiet" onclick={onJournal}>Journal</button>
  </div>
</div>

<style>
  .lines {
    margin-top: 22px;
  }

  .turn {
    margin-top: 10px;
  }

  .haul {
    margin-top: 20px;
  }

  .warn {
    margin-top: 18px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--lamp);
  }

  .earned {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid rgba(45, 107, 122, 0.25);
  }

  .sum {
    font-family: var(--serif);
    font-size: 19px;
    color: var(--bright);
  }

  .sum b {
    color: var(--lamp);
    font-weight: 600;
  }

  .earned .fine {
    margin-top: 5px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--mid);
  }
</style>
