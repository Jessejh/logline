<script lang="ts">
  import { untrack } from 'svelte';
  import { Flight } from '../lib/game/flight';
  import type { FlightResult } from '../lib/game/types';

  let { onComplete }: { onComplete: (result: FlightResult) => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let question = $state<string | null>(null);
  let hint = $state(false);
  let everHeld = $state(false);

  $effect(() => {
    const el = canvas;
    if (!el) return;
    let hintTimer = 0;
    // The handlers read state; without untrack the first touch would rebuild
    // the flight mid-hold.
    const flight = untrack(() => new Flight(el, {
      onQuestion: (text) => (question = text),
      onComplete,
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
    }));
    untrack(() => flight.start());
    return () => {
      clearTimeout(hintTimer);
      flight.destroy();
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
<div class="question" class:on={question !== null}>{question ?? ''}</div>
<div class="hint" class:on={hint}>
  {#if everHeld}
    Hold to fly on
  {:else}
    Hold anywhere to fly · let go to think
  {/if}
</div>

<style>
  canvas {
    position: fixed;
    inset: 0;
  }

  /* Leaves room for the mirror the canvas hangs from the top edge. */
  .question {
    position: fixed;
    top: calc(var(--safe-top) + 82px);
    left: 0;
    right: 0;
    padding: 0 28px;
    text-align: center;
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.45;
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
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 36px);
    text-align: center;
    font-size: 13.5px;
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
