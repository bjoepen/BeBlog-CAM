<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const image = new Image();
    image.src = '/cnc-floh.png';

    image.onload = () => {
      const source = document.createElement('canvas');
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const sourceContext = source.getContext('2d', { willReadFrequently: true });
      const targetContext = canvas.getContext('2d');
      if (!sourceContext || !targetContext) return;

      sourceContext.drawImage(image, 0, 0);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;

      let minX = source.width;
      let minY = source.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
          const offset = (y * source.width + x) * 4;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const alpha = pixels[offset + 3];
          const isVisibleInk = alpha > 8 && (red < 245 || green < 245 || blue < 245);

          if (isVisibleInk) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        minX = 0;
        minY = 0;
        maxX = source.width - 1;
        maxY = source.height - 1;
      }

      const padding = 3;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(source.width - 1, maxX + padding);
      maxY = Math.min(source.height - 1, maxY + padding);

      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      canvas.width = width;
      canvas.height = height;
      targetContext.clearRect(0, 0, width, height);
      targetContext.drawImage(source, minX, minY, width, height, 0, 0, width, height);
    };
  });
</script>

<div class="cam-mascot" aria-label="BeBlog CAM Floh">
  <canvas bind:this={canvas} role="img" aria-label="BeBlog CAM Floh"></canvas>
  <p>Klarheit schafft präzise Späne.</p>
</div>

<style>
.cam-mascot{margin-top:auto;padding:0 8px 12px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none}.cam-mascot canvas{display:block;width:112px;height:auto;max-width:100%}.cam-mascot p{margin:0;color:#202723;font-size:12px;line-height:1.3}@media(max-width:1100px){.cam-mascot{padding:0 6px 10px}.cam-mascot canvas{width:102px}.cam-mascot p{font-size:11px}}</style>