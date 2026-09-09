<script lang="ts">
  import { drawUpgradePreview } from '../lib/game/preview';
  import type { Upgrade } from '../lib/progress/upgrades';

  let { upgrade }: { upgrade: Upgrade } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const el = canvas;
    const item = upgrade;
    if (!el) return;
    const paint = () => drawUpgradePreview(el, item.category, item.palette, item.piece);
    // The first paint has to wait for layout to give the canvas a width.
    const raf = requestAnimationFrame(paint);
    addEventListener('resize', paint);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', paint);
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    width: 76px;
    height: 50px;
    flex: none;
    display: block;
    border-radius: 3px;
    border: 1px solid rgba(45, 107, 122, 0.35);
  }
</style>
