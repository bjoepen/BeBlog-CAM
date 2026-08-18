<script lang="ts">
  import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation } from './types';
  import { generateContourGcode } from './gcode';

  export let summary:ImportSummary;
  export let stock:StockDefinition;
  export let stockMode:StockMode;
  export let placement:PartPlacement;
  export let orientation:PartOrientation;
  export let wcs:WorkCoordinateSystem;
  export let operation:ContourOperation;
  let copied=false;

  $: result=generateContourGcode({summary,stock,stockMode,placement,orientation,wcs,operation});

  async function copyCode(){
    if(!result.ok||!result.code)return;
    await navigator.clipboard.writeText(result.code);
    copied=true;
    setTimeout(()=>copied=false,1200);
  }
</script>

<p class="eyebrow">06 · Fräsen</p><h2>G-Code</h2>
{#if result.ok}
  <div class="release pass"><strong>PASS</strong><span>Die aktuelle Kontur hat die geometrische Bahnprüfung bestanden und kann als G-Code dargestellt werden.</span></div>
  <div class="facts"><span>{result.passes} Zustellung{result.passes===1?'':'en'}</span><span>{result.pointCount} Bahnpunkte</span><span>{result.lineCount} G-Code-Zeilen</span><span>Radius {result.radiusMm.toFixed(3)} mm</span></div>
  <p class="note"><strong>Interpolation:</strong> {result.interpolation==='g2g3-native-circle'?`Native Kreisinterpolation · ${result.nativeArcCount} G2/G3-Bögen insgesamt`:'G1-Referenzbahn · native Bögen für gemischte Konturen folgen im nächsten Gate'}.</p>
  {#if result.validation}<p class="note"><strong>Bahnprüfung:</strong> Soll {result.validation.expectedMm.toFixed(3)} mm · Ist {result.validation.measuredMinMm.toFixed(3)}–{result.validation.measuredMaxMm.toFixed(3)} mm · max. Abweichung {result.validation.maxDeviationMm.toFixed(4)} mm.</p>{/if}
  {#each result.warnings as warning}<p class="warning"><strong>Hinweis:</strong> {warning}</p>{/each}
  <div class="code-head"><span>Vorschau · noch kein Dateiexport</span><button onclick={copyCode}>{copied?'Kopiert':'G-Code kopieren'}</button></div>
  <pre>{result.code}</pre>
{:else}
  <div class="release fail"><strong>FAIL</strong><span>G-Code wird nicht erzeugt, solange ein sicherheitsrelevanter Punkt offen ist.</span></div>
  {#each result.errors as error}<p class="error-line"><strong>FAIL</strong> {error}</p>{/each}
  {#each result.warnings as warning}<p class="warning"><strong>Hinweis:</strong> {warning}</p>{/each}
{/if}
<p class="note"><strong>001G-Regel:</strong> Native Kreis-/Bogeninterpolation wird nur dann ausgegeben, wenn die zugrunde liegende CAD-Semantik eindeutig erhalten ist. Keine nachträgliche Bogen-Erkennung aus einer segmentierten Polylinie.</p>

<style>
  .eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}.release strong{font-size:.72rem;letter-spacing:.08em}.release.pass strong{color:#2f6b4d}.release.fail strong{color:#a13f38}.facts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.code-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 7px;font-size:.75rem;color:#707570}.code-head button{border:1px solid #d1d3ce;border-radius:7px;background:#fff;padding:6px 9px;cursor:pointer;color:#4e5651}pre{max-height:360px;overflow:auto;margin:0;padding:12px;border:1px solid #deded8;border-radius:7px;background:#f5f5f2;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#37403b;white-space:pre}.note,.warning,.error-line{padding:10px 12px;font-size:.8rem;line-height:1.4}.note{background:#f3f3f0;color:#666b66}.warning{background:#fbf5e8;color:#76591f}.error-line{background:#fff0ee;color:#8d3029}
</style>
