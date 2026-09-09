<script lang="ts">
  import {
    CATEGORY_LABELS,
    UPGRADES,
    type Upgrade,
    type UpgradeCategory
  } from '../lib/progress/upgrades';
  import { buyUpgrade, equipUpgrade, loadProfile, type Profile } from '../lib/storage/profile';
  import UpgradePreview from './UpgradePreview.svelte';

  let { onBack }: { onBack: () => void } = $props();

  let profile = $state<Profile | null>(null);
  let status = $state<string | null>(null);

  const CATEGORIES: UpgradeCategory[] = ['craft', 'gates', 'sky', 'piece'];

  $effect(() => {
    void (async () => {
      profile = await loadProfile();
    })();
  });

  function owns(id: string): boolean {
    return profile?.owned.includes(id) ?? false;
  }

  function equippedIn(category: UpgradeCategory): string | null {
    return profile?.equipped[category] ?? null;
  }

  async function onBuy(upgrade: Upgrade) {
    const result = await buyUpgrade(upgrade.id);
    if (result.ok) {
      profile = result.profile;
      status = `${upgrade.name} — bought and fitted.`;
    } else if (result.reason === 'funds') {
      const short = upgrade.cost - (profile?.credits ?? 0);
      status = `${short} more ${short === 1 ? 'credit' : 'credits'} for ${upgrade.name}.`;
    } else {
      status = 'That one is already yours.';
    }
  }

  async function onEquip(category: UpgradeCategory, id: string | null) {
    profile = await equipUpgrade(category, id);
    status = id ? 'Fitted.' : 'Back to the original.';
  }
</script>

<div class="veil top">
  <h2>Workshop</h2>
  <p class="lede small">
    {profile?.credits ?? 0} credits. Everything here changes how the flight looks and nothing
    changes how it goes — there is no score to improve. Each
    picture is drawn by the flight itself, so it is the thing you get.
  </p>

  {#each CATEGORIES as category (category)}
    <section>
      <div class="cat">
        <p class="caption">{CATEGORY_LABELS[category]}</p>
        {#if equippedIn(category)}
          <button class="link" onclick={() => onEquip(category, null)}>original</button>
        {/if}
      </div>

      {#each UPGRADES.filter((u) => u.category === category) as upgrade (upgrade.id)}
        {@const owned = owns(upgrade.id)}
        {@const fitted = equippedIn(category) === upgrade.id}
        <div class="item" class:fitted>
          <UpgradePreview upgrade={upgrade} />
          <div class="text">
            <span class="name">{upgrade.name}</span>
            <span class="blurb">{upgrade.blurb}</span>
          </div>
          {#if fitted}
            <span class="tag">fitted</span>
          {:else if owned}
            <button class="small quiet" onclick={() => onEquip(category, upgrade.id)}>Fit</button>
          {:else}
            <button
              class="small"
              disabled={(profile?.credits ?? 0) < upgrade.cost}
              onclick={() => onBuy(upgrade)}
            >
              {upgrade.cost}
            </button>
          {/if}
        </div>
      {/each}
    </section>
  {/each}

  {#if status}
    <p class="status">{status}</p>
  {/if}

  <div class="actions">
    <button onclick={onBack}>Back</button>
  </div>
</div>

<style>
  .lede.small {
    font-size: 16px;
    margin-bottom: 4px;
  }

  section {
    margin-top: 24px;
  }

  .cat {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .link {
    border: none;
    padding: 0;
    font-size: 13px;
    color: var(--mid);
    text-decoration: underline;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid rgba(45, 107, 122, 0.22);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-family: var(--serif);
    font-size: 16.5px;
    color: var(--bright);
  }

  .blurb {
    font-size: 13.5px;
    line-height: 1.45;
    color: var(--dim);
  }

  .tag {
    font-size: 13px;
    color: var(--lamp);
    white-space: nowrap;
  }

  button:disabled {
    opacity: 0.4;
  }

  .status {
    margin-top: 18px;
    font-size: 14px;
    color: var(--lamp);
  }
</style>
