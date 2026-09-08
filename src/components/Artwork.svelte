<script lang="ts">
  import { untrack } from 'svelte';
  import { Artwork } from '../lib/game/artwork';
  import { Piece } from '../lib/game/piece';
  import { statsFor, type Entry } from '../lib/storage/entries';

  let { entry, onContinue, continueLabel = 'Continue' }: {
    entry: Entry;
    onContinue: () => void;
    continueLabel?: string;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let touched = $state(false);
  /** The flat piece is the artwork; the turnable object is the other reading. */
  let view = $state<'piece' | 'object'>('piece');

  const dayFormat = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  $effect(() => {
    const el = canvas;
    const mode = view;
    if (!el) return;
    // Reading `entry` untracked: swapping views must not rebuild on an
    // unrelated change, and the entry never changes under a mounted artwork.
    const record = untrack(() => entry);
    if (mode === 'piece') {
      const piece = new Piece(el, {
        line: record.line,
        answers: record.answers,
        stats: statsFor(record),
        caption: dayFormat.format(record.ts)
      });
      piece.start();
      return () => piece.destroy();
    }
    const art = new Artwork(el, { line: record.line, answers: record.answers });
    art.start();
    return () => art.destroy();
  });
</script>

<canvas bind:this={canvas} onpointerdown={() => (touched = true)}></canvas>

{#if view === 'object'}
  <div class="cap">
    <h2>The line you drew</h2>
    <p class="when">{dayFormat.format(entry.ts)}</p>
  </div>
  <p class="hint" class:off={touched}>Drag to turn it</p>
{/if}

<div class="foot" class:light={view === 'piece'}>
  <button class="quiet small" onclick={() => (view = view === 'piece' ? 'object' : 'piece')}>
    {view === 'piece' ? 'Turn it in 3D' : 'See it flat'}
  </button>
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

  .cap {
    position: fixed;
    top: calc(var(--app-top) + var(--app-inset) + 26px);
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
    gap: 10px;
    justify-content: center;
    align-items: center;
  }

  .foot button {
    background: rgba(5, 8, 16, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  /* The flat piece is printed on paper, so the controls have to turn over with
     it — gold on near-black is unreadable against a bone ground. */
  .foot.light button {
    background: rgba(255, 255, 255, 0.55);
    border-color: rgba(20, 26, 34, 0.28);
    color: #232b36;
  }
</style>
