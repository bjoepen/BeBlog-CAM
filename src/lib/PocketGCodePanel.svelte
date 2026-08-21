<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, PocketOperation } from './types';
  import { generatePocketGcode } from './pocketGcode';
  import { optimizeParallelPocketStayDown } from './pocketStayDown';
  import { normalizeGcodeComments } from './gcodeComments';
  import JobGCodePanel from './JobGCodePanel.svelte';
  import { operationsProjectStore } from './operationsProject';

  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let placement:PartPlacement;export let orientation:PartOrientation;export let wcs:WorkCoordinateSystem;export let operation:PocketOperation;
  let copied=false;let exportState:''|'saved'|'error'='';let exportMessage='';
  $: multiJob=$operationsProjectStore.operations.length>1&&$operationsProjectStore.activeOperationId===operation.id;
  $: result=generatePocketGcode({summary,stock,stockMode,placement,orientation,wcs,operation});
  $: stayDown=result.ok?optimizeParallelPocketStayDown(result.code,operation):{code:result.code,links:0,retainedRetracts:0};
  $: displayCode=normalizeGcodeComments(stayDown.code);
  $: displayLineCount=displayCode?displayCode.trimEnd().split(/\r?\n/).length:0;
  function defaultNcName(){const base=(summary.fileName||'beblog-cam').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9äöüÄÖÜß._ -]+/g,'-').trim()||'beblog-cam';return `${base}-tasche.nc`;}
  async function copyCode(){if(!result.ok||!displayCode)return;await navigator.clipboard.writeText(displayCode);copied=true;setTimeout(()=>copied=false,1200);}
  async function saveNc(){if(!result.ok||!displayCode)return;exportState='';exportMessage='';try{let path=await save({defaultPath:defaultNcName(),filters:[{name:'NC-Programm',extensions:['nc']}]});if(!path)return;if(!path.toLowerCase().endsWith('.nc'))path=`${path}.nc`;await invoke('save_nc_file',{path,code:displayCode});exportState='saved';exportMessage=`Gespeichert: ${path}`;}catch(error){exportState='error';exportMessage=String(error)}}
</script>

{#if multiJob}
  <JobGCodePanel {summary} {stock} {stockMode} {placement} {orientation} {wcs} operations={$operationsProjectStore.operations}/>
{:else}
<p class="eyebrow">06 · Fräsen</p><h2>Tasche</h2>
{#if result.ok}
  <div class="release pass"><strong>PASS</strong><span>Die geprüfte Taschenstrategie kann als Maschinenprogramm ausgegeben werden.</span></div>
  <div class="facts"><span>{result.passes} Zustellung{result.passes===1?'':'en'}</span>{#if result.strategy==='raster'}<span>{result.rasterPasses} Rasterbahnen</span>{:else if result.strategy==='concentric'}<span>{result.concentricRings} Kreisring{result.concentricRings===1?'':'e'}</span>{:else}<span>{result.parallelLoops} Innenoffset{result.parallelLoops===1?'':'s'}</span>{/if}{#if result.strategy==='parallel'}<span>{stayDown.links} Stay-down-Link{stayDown.links===1?'':'s'}</span>{/if}<span>Stepover {result.stepoverMm.toFixed(3)} mm</span><span>Radius {result.toolRadiusMm.toFixed(3)} mm</span><span>{displayLineCount} G-Code-Zeilen</span></div>
  <p class="note"><strong>Strategie:</strong> {result.strategy==='concentric'?'Konzentrische Kreistasche · Zentrum zuerst · native G2/G3-Halbkreise · äußerster Ring als radiuskorrigierte Fertigwand.':result.strategy==='parallel'?`Konturparallel · analytische Innenoffsets · LINE bleibt G1, ARC bleibt G2/G3 · ${stayDown.links} sicher nachgewiesene Verbindungen bleiben auf Schnitttiefe.`:operation.entry==='ramp'?'Rechteck-Raster · lineare Rampe · Zickzack-Räumung · abschließender Wandumlauf.':'Rechteck-Raster · senkrecht eintauchen · Zickzack-Räumung · abschließender Wandumlauf.'}</p>
  {#each result.warnings as warning}<p class="warning"><strong>Hinweis:</strong> {warning}</p>{/each}
  <div class="export-box"><div><strong>NC-Datei</strong><span>Speichert exakt den aktuell angezeigten Taschen-G-Code als .nc.</span></div><button class="primary-export" onclick={saveNc}>G-Code speichern …</button></div>
  {#if exportMessage}<p class:export-ok={exportState==='saved'} class:export-error={exportState==='error'} class="export-message">{exportMessage}</p>{/if}
  <div class="code-head"><span>Vorschau · identisch zur .nc-Datei</span><button onclick={copyCode}>{copied?'Kopiert':'G-Code kopieren'}</button></div><pre>{displayCode}</pre>
{:else}
  <div class="release fail"><strong>FAIL</strong><span>Taschen-G-Code wird nur erzeugt, wenn Geometrie und gewählte Räumstrategie freigabefähig sind.</span></div>{#each result.errors as error}<p class="error-line"><strong>FAIL</strong> {error}</p>{/each}{#each result.warnings as warning}<p class="warning"><strong>Hinweis:</strong> {warning}</p>{/each}
{/if}
<p class="note"><strong>001K Kommentar-Polish:</strong> Operation, Strategie und besondere Bahnmerkmale werden im exportierten G-Code jetzt konsistent benannt. Der veraltete 8B-Hinweis zum separaten Safe-Z-Anfahren wurde entfernt.</p>
{/if}

<style>
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}.release strong{font-size:.72rem;letter-spacing:.08em}.release.pass strong{color:#2f6b4d}.release.fail strong{color:#a13f38}.facts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.export-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin:14px 0;background:#f3f3f0;border-left:2px solid #727b75}.export-box div{display:grid;gap:3px}.export-box strong{font-size:.82rem;color:#333b37}.export-box span{font-size:.76rem;color:#6a706c}.primary-export{border:0;border-radius:7px;background:#3f4943;color:white;padding:8px 11px;cursor:pointer;white-space:nowrap}.export-message{margin:-6px 0 12px;padding:8px 10px;font-size:.76rem;border-radius:6px;overflow-wrap:anywhere}.export-ok{background:#edf5ef;color:#2f6b4d}.export-error{background:#fff0ee;color:#8d3029}.code-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 7px;font-size:.75rem;color:#707570}.code-head button{border:1px solid #d1d3ce;border-radius:7px;background:#fff;padding:6px 9px;cursor:pointer;color:#4e5651}pre{max-height:360px;overflow:auto;margin:0;padding:12px;border:1px solid #deded8;border-radius:7px;background:#f5f5f2;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#37403b;white-space:pre}.note,.warning,.error-line{padding:10px 12px;font-size:.8rem;line-height:1.4}.note{background:#f3f3f0;color:#666b66}.warning{background:#fbf5e8;color:#76591f}.error-line{background:#fff0ee;color:#8d3029}
</style>
