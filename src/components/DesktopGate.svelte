<script lang="ts">
  let { onContinue }: { onContinue: () => void } = $props();

  const url = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
</script>

<div class="veil">
  <h1>Logline</h1>
  <p class="sub">a line drawn through the day</p>
  <p class="lede">
    Logline is flown with one thumb, in portrait, on a phone. There is no desktop layout — the
    controls are the point, and a mouse doesn't have them.
  </p>
  <p class="caption">Open this on your phone:</p>
  <p class="url">{url}</p>
  <div class="actions">
    <button class="quiet small" onclick={onContinue}>Continue anyway</button>
  </div>
</div>

<style>
  .url {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--lamp);
    word-break: break-all;
    user-select: text;
    -webkit-user-select: text;
  }
</style>
