<script lang="ts">
  import { untrack } from 'svelte';
  import { Piece } from '../lib/game/piece';
  import { statsFor, type Entry } from '../lib/storage/entries';

  let { entry, onContinue, continueLabel = 'Continue' }: {
    entry: Entry;
    onContinue: () => void;
    continueLabel?: string;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  const dayFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  $effect(() => {
    const el = canvas;
    if (!el) return;
    // Reading `entry` untracked: the record never changes under a mounted
    // piece, and rebuilding on an unrelated change would restart the reveal.
    const record = untrack(() => entry);
    const piece = new Piece(el, {
      line: record.line,
      answers: record.answers,
      stats: statsFor(record),
      caption: dayFormat.format(record.ts)
    });
    piece.start();
    return () => piece.destroy();
  });
</script>

<canvas bind:this={canvas}></canvas>

<div class="foot">
  <button onclick={onContinue}>{continueLabel}</button>
</div>

<style>
  canvas {
    position: fixed;
    left: 0;
    right: 0;
    top: var(--app-top);
    height: var(--app-h);
    touch-action: none;
  }

  .foot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 28px);
    display: flex;
    gap: 10px;
    justify-content: center;
    align-items: center;
  }

  /* The piece is printed on paper, so the control has to sit on paper too —
     gold on near-black is unreadable against a bone ground. */
  .foot button {
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border-color: rgba(20, 26, 34, 0.28);
    color: #232b36;
  }
</style>
