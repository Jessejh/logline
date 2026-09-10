<script lang="ts">
  import { summarise, trends } from '../lib/progress/collection';
  import { rateFor, longestStreak } from '../lib/progress/credits';
  import { listEntries } from '../lib/storage/entries';
  import { loadProfile, streakNow, type Profile } from '../lib/storage/profile';
  import Trend from './Trend.svelte';

  let { onBack, onWorkshop }: { onBack: () => void; onWorkshop: () => void } = $props();

  let profile = $state<Profile | null>(null);
  let streak = $state(0);
  let best = $state(0);
  let series = $state<ReturnType<typeof trends>>([]);
  let totals = $state<ReturnType<typeof summarise> | null>(null);
  let loading = $state(true);

  $effect(() => {
    void (async () => {
      const entries = await listEntries();
      profile = await loadProfile();
      streak = await streakNow();
      best = longestStreak(entries.map((e) => e.day));
      series = trends(entries);
      totals = summarise(entries);
      loading = false;
    })();
  });
</script>

<div class="veil top">
  <h2>What you've gathered</h2>

  {#if loading}
    <p class="caption">Reading the journal…</p>
  {:else if !totals || totals.flights === 0}
    <p class="caption">Nothing yet. Fly once and this fills in.</p>
  {:else}
    <div class="tiles">
      <div class="tile">
        <span class="n">{streak}</span>
        <span class="l">day streak</span>
      </div>
      <div class="tile">
        <span class="n">{profile?.credits ?? 0}</span>
        <span class="l">credits</span>
      </div>
      <div class="tile">
        <span class="n">{totals.days}</span>
        <span class="l">days logged</span>
      </div>
    </div>

    <p class="rate">
      Every gate pays <b>{rateFor(Math.max(streak, 1))}</b> at a {Math.max(streak, 1)}-day streak
      — the same whichever opening you take. Longest run so far: {best}
      {best === 1 ? 'day' : 'days'}.
    </p>

    <div class="actions tight">
      <button class="small" onclick={onWorkshop}>Workshop</button>
    </div>

    <section>
      <p class="caption">The last fortnight</p>
      {#each series as trend (trend.q)}
        <Trend trend={trend} />
      {/each}
    </section>

  {/if}

  <div class="actions">
    <button onclick={onBack}>Back</button>
  </div>
</div>

<style>
  .tiles {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }

  .tile {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 10px;
    border: 1px solid rgba(45, 107, 122, 0.35);
    border-radius: 2px;
  }

  .tile .n {
    font-family: var(--serif);
    font-size: 26px;
    color: var(--bright);
    line-height: 1.1;
  }

  .tile .l {
    font-size: 12.5px;
    color: var(--dim);
  }

  .rate {
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--mid);
  }

  .rate b {
    color: var(--lamp);
    font-weight: 600;
  }

  section {
    margin-top: 28px;
  }
</style>
