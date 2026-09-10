<script lang="ts">
  import type { QuestionMonth } from '../lib/progress/collection';
  import { scaleColor, scaleInk, scaleSwatches } from '../lib/progress/scale';

  let { month, today, selected, onSelect }: {
    month: QuestionMonth;
    today: string;
    /** The day open in this calendar, or null when the selection is elsewhere. */
    selected: string | null;
    onSelect: (day: string) => void;
  } = $props();

  const swatches = $derived(scaleSwatches(month.steps));

  const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
</script>

<section>
  <p class="q">{month.q}</p>

  <div class="head" aria-hidden="true">
    {#each WEEKDAYS as name, i (i)}
      <span>{name}</span>
    {/each}
  </div>

  {#each month.weeks as week, w (w)}
    <div class="week">
      {#each week as cell, d (d)}
        {#if !cell.day}
          <span class="pad"></span>
        {:else if cell.ix !== null}
          <button
            class="day"
            class:on={selected === cell.day}
            class:today={cell.day === today}
            style="background: {scaleColor(cell.ix, month.steps)}; color: {scaleInk(
              cell.ix,
              month.steps
            )}"
            aria-label="{cell.day}, {cell.label}"
            onclick={() => cell.day && onSelect(cell.day)}
          >
            {cell.date}
          </button>
        {:else if cell.flown}
          <button
            class="day open"
            class:on={selected === cell.day}
            class:today={cell.day === today}
            aria-label="{cell.day}, left open"
            onclick={() => cell.day && onSelect(cell.day)}
          >
            {cell.date}
          </button>
        {:else}
          <span class="day none" class:today={cell.day === today}>{cell.date}</span>
        {/if}
      {/each}
    </div>
  {/each}

  <!-- The ramp, named at both ends in the question's own words. Lighter means
       further along this scale and nothing else — which is only legible if the
       ends say what they are. -->
  <div class="key">
    <span class="end">{month.low}</span>
    <span class="ramp">
      {#each swatches as hex, i (i)}
        <i style="background: {hex}"></i>
      {/each}
    </span>
    <span class="end">{month.high}</span>
  </div>
</section>

<style>
  section {
    margin-bottom: 26px;
  }

  .q {
    font-family: var(--serif);
    font-size: 16px;
    color: var(--mid);
    margin-bottom: 8px;
  }

  .head,
  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .head {
    margin-bottom: 3px;
  }

  .head span {
    text-align: center;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--dim);
    opacity: 0.7;
  }

  .week {
    margin-bottom: 3px;
  }

  .pad {
    aspect-ratio: 1.45;
  }

  .day {
    aspect-ratio: 1.45;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 2px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    background: none;
    color: var(--dim);
  }

  /* Flown, but this question was flown over: an outline holding an empty cell.
     The same reading the piece gives a question left open — a rest, not a gap. */
  .day.open {
    border: 1px solid rgba(168, 213, 216, 0.4);
    color: var(--dim);
  }

  /* No flight that day. Present enough to count the date off, quiet enough
     that a month with gaps in it does not read as a month of failures. */
  .day.none {
    color: rgba(143, 184, 194, 0.3);
  }

  .day.today {
    box-shadow: 0 0 0 1px var(--lamp);
  }

  .day.on {
    box-shadow: 0 0 0 2px var(--ice);
  }

  .key {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .end {
    font-size: 11.5px;
    color: var(--dim);
    flex: 1;
  }

  .end:last-child {
    text-align: right;
  }

  .ramp {
    display: flex;
    gap: 2px;
  }

  .ramp i {
    width: 16px;
    height: 7px;
    border-radius: 1px;
  }
</style>
