<script lang="ts">
  import { Flight } from '../lib/game/flight';
  import type { FlightResult } from '../lib/game/types';

  let { onComplete }: { onComplete: (result: FlightResult) => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let question = $state<string | null>(null);

  $effect(() => {
    const el = canvas;
    if (!el) return;
    const flight = new Flight(el, {
      onQuestion: (text) => (question = text),
      onComplete
    });
    flight.start();
    return () => flight.destroy();
  });
</script>

<canvas bind:this={canvas}></canvas>
<div class="question" class:on={question !== null}>{question ?? ''}</div>

<style>
  canvas {
    position: fixed;
    inset: 0;
  }

  .question {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 28px);
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
</style>
