<script lang="ts">
  import type { Entry } from '../lib/storage/entries';
  import LineMini from './LineMini.svelte';
  import InstallHint from './InstallHint.svelte';

  let { entry, saveError, onAgain, onArtwork, onJournal }: {
    entry: Entry;
    saveError: string | null;
    onAgain: () => void;
    onArtwork: () => void;
    onJournal: () => void;
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

  {#if saveError}
    <p class="warn">{saveError}</p>
  {/if}

  <p class="note">
    This is where the track would wait — fly it for karma, or just keep the logline as a journal
    entry.
  </p>

  <InstallHint />

  <div class="actions">
    <button onclick={onAgain}>Fly again</button>
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
</style>
