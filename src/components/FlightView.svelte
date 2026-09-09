<script lang="ts">
  import { untrack } from 'svelte';
  import { Flight } from '../lib/game/flight';
  import type { FlightResult } from '../lib/game/types';

  let { onComplete, teach = false }: {
    onComplete: (result: FlightResult) => void;
    teach?: boolean;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let question = $state<string | null>(null);
  let hint = $state(false);
  let everHeld = $state(false);
  let tip = $state<string | null>(null);

  $effect(() => {
    const el = canvas;
    if (!el) return;
    let hintTimer = 0;
    // The handlers read state; without untrack the first touch would rebuild
    // the flight mid-hold.
    const teaching = untrack(() => teach);
    const flight = untrack(() => new Flight(el, {
      onQuestion: (text) => (question = text),
      onComplete,
      onTip: (text) => (tip = text),
      onHold: (held) => {
        clearTimeout(hintTimer);
        if (held) {
          everHeld = true;
          hint = false;
        } else {
          // Lifting the thumb is the point — only nudge after a real pause.
          hintTimer = window.setTimeout(() => (hint = true), everHeld ? 2200 : 400);
        }
      }
    }, { teach: teaching }));
    untrack(() => flight.start());
    return () => {
      clearTimeout(hintTimer);
      flight.destroy();
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
<!-- Pinned to the visible area rather than the layout viewport, so a URL bar
     at either edge can't sit on top of the text. -->
<div class="hud">
  <div class="question" class:on={question !== null}>{question ?? ''}</div>
  <div class="hint" class:on={tip !== null || (hint && !teach)}>
    {#if tip !== null}
      {tip}
    {:else if everHeld}
      Hold to fly on
    {:else}
      Hold anywhere to fly · let go to think
    {/if}
  </div>
</div>

<style>
  canvas {
    position: fixed;
    left: 0;
    right: 0;
    /* The visible area, not the layout viewport — see `lib/viewport.ts`. */
    top: var(--app-top);
    height: var(--app-h);
  }

  .hud {
    position: fixed;
    left: 0;
    right: 0;
    top: var(--app-top);
    height: var(--app-h);
    pointer-events: none;
  }

  /* Below the mirror the canvas hangs from the top edge, and below whatever
     browser chrome --app-inset has accounted for. */
  .question {
    position: absolute;
    top: calc(var(--app-inset) + 88px);
    left: 0;
    right: 0;
    padding: 0 24px;
    text-align: center;
    font-family: var(--serif);
    font-size: 27px;
    line-height: 1.4;
    color: #cfe6e8;
    opacity: 0;
    transition: opacity 0.7s ease;
    pointer-events: none;
    text-shadow: 0 2px 22px rgba(0, 0, 0, 0.85);
  }

  .question.on {
    opacity: 1;
  }

  .hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 36px);
    padding: 0 26px;
    text-align: center;
    font-size: 16px;
    line-height: 1.45;
    letter-spacing: 0.02em;
    color: var(--dim);
    opacity: 0;
    transition: opacity 0.6s ease;
    pointer-events: none;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.85);
  }

  .hint.on {
    opacity: 1;
  }
</style>
