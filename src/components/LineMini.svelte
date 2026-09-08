<script lang="ts">
  import { drawMiniature } from '../lib/game/miniature';
  import type { LinePoint } from '../lib/game/types';

  let { line, height = 48 }: { line: readonly LinePoint[]; height?: number } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const el = canvas;
    if (!el) return;
    const paint = () => drawMiniature(el, line);
    // The first paint has to wait for layout to give the canvas a width.
    const raf = requestAnimationFrame(paint);
    addEventListener('resize', paint);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', paint);
    };
  });
</script>

<canvas bind:this={canvas} style="height:{height}px"></canvas>

<style>
  canvas {
    width: 100%;
    display: block;
    border-radius: 2px;
    background: rgba(12, 18, 40, 0.5);
  }
</style>
