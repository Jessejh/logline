<script lang="ts">
  let { onBegin, onJournal, entryCount }: {
    onBegin: () => void;
    onJournal: () => void;
    entryCount: number;
  } = $props();
</script>

<div class="veil">
  <h1>Logline</h1>
  <p class="sub">a line drawn through the day</p>
  <p class="lede">
    Eight questions. You answer by flying through them. The line behind you is today's record. The
    line ahead is where you're pointing.
  </p>
  <p class="howto">
    Hold your thumb anywhere and drag. The craft follows.<br /><br />
    Each frame ahead is one question. <b>Pass through the opening you mean.</b> Every cell gives you material
    — edges aren't worth more, they're just different.
  </p>
  <div class="actions">
    <button onclick={onBegin}>Begin</button>
    {#if entryCount > 0}
      <button class="quiet" onclick={onJournal}>
        Journal · {entryCount}
      </button>
    {/if}
  </div>
</div>
