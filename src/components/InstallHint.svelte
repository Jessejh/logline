<script lang="ts">
  import { dismissInstall, install, promptInstall } from '../lib/install.svelte';

  const show = $derived(!install.standalone && !install.dismissed && (install.promptable || install.ios));
</script>

{#if show}
  <div class="hint">
    <p>
      {#if install.promptable}
        Add Logline to your home screen — it opens full screen, works offline, and your entries stop
        being at risk of the browser clearing them.
      {:else}
        Add Logline to your home screen: tap <b>Share</b>, then <b>Add to Home Screen</b>. It opens
        full screen, works offline, and your entries stop being at risk of Safari clearing them.
      {/if}
    </p>
    <div class="hint-actions">
      {#if install.promptable}
        <button class="small" onclick={promptInstall}>Add to home screen</button>
      {/if}
      <button class="small quiet" onclick={dismissInstall}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .hint {
    margin-top: 22px;
    padding: 14px 16px;
    border: 1px solid rgba(45, 107, 122, 0.35);
    border-radius: 2px;
    background: rgba(12, 18, 40, 0.45);
  }

  .hint p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--mid);
  }

  .hint b {
    color: #8fb8c2;
  }

  .hint-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
</style>
