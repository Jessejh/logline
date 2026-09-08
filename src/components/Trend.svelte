<script lang="ts">
  import type { Trend } from '../lib/progress/collection';

  let { trend }: { trend: Trend } = $props();

  const W = 100;
  const H = 30;
  const TOP = 4;
  const BOTTOM = 26;

  // Higher column index sits higher on the page. That is a reading convention,
  // not a judgement — the end of a scale is where the eye expects to find it,
  // and neither end is worth more than the other.
  function y(ix: number): number {
    if (trend.steps < 2) return (TOP + BOTTOM) / 2;
    return BOTTOM - (ix / (trend.steps - 1)) * (BOTTOM - TOP);
  }

  function x(i: number): number {
    if (trend.points.length < 2) return W / 2;
    return (i / (trend.points.length - 1)) * W;
  }

  const path = $derived(
    trend.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(p.ix)}`).join(' ')
  );
  const latest = $derived(trend.points[trend.points.length - 1]);
  const rows = $derived(Array.from({ length: trend.steps }, (_, i) => y(i)));
  // The SVG is stretched to the container width, which would squash a circle
  // into an ellipse, so the dots are laid over it as positioned elements.
  const dots = $derived(
    trend.points.map((p, i) => ({
      left: `${x(i)}%`,
      top: `${(y(p.ix) / H) * 100}%`,
      last: i === trend.points.length - 1,
      label: `${p.day}: ${p.label}`
    }))
  );
</script>

<div class="trend">
  <div class="head">
    <span class="q">{trend.q}</span>
    <span class="now">{latest?.label ?? ''}</span>
  </div>
  <!-- The scale ends sit in a gutter to the right of the plot rather than over
       it, so the newest point never lands underneath its own axis label. -->
  <div class="plot">
    <div class="track">
      <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
        {#each rows as ry}
          <line x1="0" y1={ry} x2={W} y2={ry} class="grid" vector-effect="non-scaling-stroke" />
        {/each}
        {#if trend.points.length > 1}
          <path d={path} class="line" vector-effect="non-scaling-stroke" />
        {/if}
      </svg>
      {#each dots as dot}
        <span
          class="dot"
          class:last={dot.last}
          style="left: {dot.left}; top: {dot.top}"
          title={dot.label}
        ></span>
      {/each}
    </div>
    <span class="edge high">{trend.high}</span>
    <span class="edge low">{trend.low}</span>
  </div>
</div>

<style>
  .trend {
    margin-bottom: 20px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 5px;
  }

  .q {
    font-family: var(--serif);
    font-size: 15.5px;
    color: var(--mid);
  }

  .now {
    font-size: 14px;
    color: #d0e8e8;
    white-space: nowrap;
  }

  .plot {
    position: relative;
    height: 54px;
  }

  .track {
    position: relative;
    height: 100%;
    /* Room for the scale-end labels in the gutter. */
    margin-right: 74px;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .grid {
    stroke: rgba(45, 107, 122, 0.22);
    stroke-width: 1;
  }

  .line {
    fill: none;
    stroke: var(--trail);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .dot {
    position: absolute;
    width: 6px;
    height: 6px;
    margin: -3px 0 0 -3px;
    border-radius: 50%;
    background: var(--trail);
    pointer-events: none;
  }

  .dot.last {
    background: var(--lamp);
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
  }

  .edge {
    position: absolute;
    right: 0;
    width: 68px;
    text-align: right;
    font-size: 12px;
    letter-spacing: 0.02em;
    color: var(--dim);
    pointer-events: none;
  }

  .edge.high {
    top: -1px;
  }

  .edge.low {
    bottom: -1px;
  }
</style>
