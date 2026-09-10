<script lang="ts">
  import { buildVersion } from '../lib/version';

  let { onBegin, onJournal, onCollection, entryCount, credits }: {
    onBegin: () => void;
    onJournal: () => void;
    onCollection: () => void;
    entryCount: number;
    credits: number;
  } = $props();

  const version = buildVersion();
</script>

<div class="veil">
  <h1>Logline</h1>
  <p class="sub">a line drawn through the day</p>
  <p class="lede">
    Eight questions. You answer by flying through them. The line behind you is today's record. The
    line ahead is where you're pointing.
  </p>
  <p class="howto">
    Hold your thumb anywhere to fly, drag to steer. Lift it and the craft waits while you think.<br /><br />
    Each frame ahead is one question. <b>Pass through the opening you mean.</b> Every cell holds a
    colour you only see once you're through it — edges aren't worth more, they're just different.<br
    /><br />
    A question you would rather not answer today can be flown over. It costs nothing.
  </p>
  <p class="build">{version}</p>

  <div class="actions">
    <button onclick={onBegin}>Begin</button>
    {#if entryCount > 0}
      <button class="quiet" onclick={onCollection}>
        Gathered · {credits}
      </button>
      <button class="quiet" onclick={onJournal}>
        Journal · {entryCount}
      </button>
    {/if}
  </div>
</div>

<style>
  /* A build stamp, not a headline: legible if you look for it, invisible if
     you don't. */
  .build {
    margin-top: 20px;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: var(--dim);
    opacity: 0.65;
    font-variant-numeric: tabular-nums;
  }
</style>
