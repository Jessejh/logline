<script lang="ts">
  import { Artwork } from '../lib/game/artwork';
  import type { Entry } from '../lib/storage/entries';

  let { entry, onContinue, continueLabel = 'Continue' }: {
    entry: Entry;
    onContinue: () => void;
    continueLabel?: string;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let touched = $state(false);

  const dayFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  $effect(() => {
    const el = canvas;
    if (!el) return;
    const art = new Artwork(el, { line: entry.line, answers: entry.answers });
    art.start();
    return () => art.destroy();
  });
</script>

<canvas bind:this={canvas} onpointerdown={() => (touched = true)}></canvas>

<div class="cap">
  <h2>The line you drew</h2>
  <p class="when">{dayFormat.format(entry.ts)}</p>
</div>

<p class="hint" class:off={touched}>Drag to turn it</p>

<div class="foot">
  <button onclick={onContinue}>{continueLabel}</button>
</div>

<style>
  canvas {
    position: fixed;
    inset: 0;
    touch-action: none;
  }

  .cap {
    position: fixed;
    top: calc(var(--safe-top) + 26px);
    left: 0;
    right: 0;
    padding: 0 28px;
    text-align: center;
    pointer-events: none;
    text-shadow: 0 2px 22px rgba(0, 0, 0, 0.85);
  }

  .cap h2 {
    margin-bottom: 4px;
  }

  .when {
    font-family: var(--serif);
    font-size: 14px;
    color: var(--dim);
    letter-spacing: 0.03em;
  }

  .hint {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 96px);
    text-align: center;
    font-size: 13px;
    color: var(--dim);
    pointer-events: none;
    transition: opacity 0.6s ease;
  }

  .hint.off {
    opacity: 0;
  }

  .foot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 28px);
    display: flex;
    justify-content: center;
  }

  .foot button {
    background: rgba(5, 8, 16, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
</style>
