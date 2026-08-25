<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, CarveOperation } from './types';
  import { generateCarveGcode } from './carveGcode';
  import { buildCarveCanonicalToolpath, postCarveCanonicalToolpath } from './carveCanonicalToolpath';
  import { postProcessGcode } from './postprocessors';
  import { postProcessorStore } from './postProcessorStore';
  import PostProcessorPicker from './PostProcessorPicker.svelte';
  import JobGCodePanel from './JobGCodePanel.svelte';
  import { operationsProjectStore } from './operationsProject';

  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let placement:PartPlacement;export let orientation:PartOrientation;export let wcs:WorkCoordinateSystem;export let operation:CarveOperation;
  let copied=false;let exportState:''|'saved'|'error'='';let exportMessage='';
  $: multiJob=$operationsProjectStore.operations.length>1&&$operationsProjectStore.activeOperationId===operation.id;
  $: result=generateCarveGcode({summary,stock,stockMode,placement,orientation,wcs,operation});
  $: canonical=result.ok?buildCarveCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation}):null;
  $: canonicalCode=canonical?postCarveCanonicalToolpath(canonical,{safeZMm:operation.safeZMm,feedMmMin:operation.feedMmMin,plungeMmMin:operation.plungeMmMin,spindleRpm:operation.spindleRpm}):result.code;
  $: processed=result.ok?postProcessGcode(canonicalCode,$postProcessorStore):{ok:false,code:'',errors:result.errors,warnings:result.warnings,removedLines:0,transformedLines:0};
  $: displayCode=processed.code;
  function defaultNcName(){const base=(summary.fileName||'beblog-cam').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9äöüÄÖÜß._ -]+/g,'-').trim()||'beblog-cam';return `${base}-carve.nc`;}
  async function copyCode(){if(!result.ok||!processed.ok||!displayCode)return;await navigator.clipboard.writeText(displayCode);copied=true;setTimeout(()=>copied=false,1200);}
  async function saveNc(){if(!result.ok||!processed.ok||!displayCode)return;exportState='';exportMessage='';try{let path=await save({defaultPath:defaultNcName(),filters:[{name:'NC-Programm',extensions:['nc']}]});if(!path)return;if(!path.toLowerCase().endsWith('.nc'))path=`${path}.nc`;await invoke('save_nc_file',{path,code:displayCode});exportState='saved';exportMessage=`Gespeichert: ${path}`;}catch(error){exportState='error';exportMessage=String(error)}}
</script>

{#if multiJob}
  <JobGCodePanel {summary} {stock} {stockMode} {placement} {orientation} {wcs} operations={$operationsProjectStore.operations}/>
{:else}
<p class="eyebrow">06 · Fräsen</p><h2>Carve</h2>
{#if result.ok}
  <div class="release pass"><strong>PASS</strong><span>Die geprüften DXF-Centerlines können als Maschinenprogramm ausgegeben werden.</span></div>
  <div class="facts"><span>{result.segmentCount} Segmente</span><span>{result.passes} Zustellung{result.passes===1?'':'en'}</span><span>{result.totalCenterlineLengthMm.toFixed(3)} mm Centerline</span><span>{displayCode.trimEnd().split(/\r?\n/).length} G-Code-Zeilen</span></div>
  <p class="note"><strong>Strategie:</strong> Jedes gewählte Segment wird auf Sicherheits-Z angefahren, auf Solltiefe eingetaucht und entsprechend der gewählten Seite links/rechts/auf Linie abgefahren.</p>
  {#if canonical}<p class="note"><strong>Canonical:</strong> Vorschau und Maschinenoutput verwenden dieselben {canonical.runs.length} Werkzeugbahn{canonical.runs.length===1?'':'en'}.</p>{/if}
  <PostProcessorPicker/>
  {#each result.warnings as warning}<p class="warning"><strong>Hinweis:</strong> {warning}</p>{/each}
  {#each processed.warnings as warning}<p class="warning"><strong>Postprozessor:</strong> {warning}</p>{/each}
  {#each processed.errors as error}<p class="error-line"><strong>FAIL</strong> {error}</p>{/each}
  <div class="export-box"><div><strong>NC-Datei</strong><span>Speichert den geprüften Carve-G-Code mit dem gewählten Postprozessor als .nc.</span></div><button class="primary-export" disabled={!processed.ok} onclick={saveNc}>G-Code speichern …</button></div>
  {#if exportMessage}<p class:export-ok={exportState==='saved'} class:export-error={exportState==='error'} class="export-message">{exportMessage}</p>{/if}
  <div class="code-head"><span>Vorschau · identisch zur .nc-Datei · {$postProcessorStore==='estlcam'?'Estlcam':'Standard'}</span><button disabled={!processed.ok} onclick={copyCode}>{copied?'Kopiert':'G-Code kopieren'}</button></div><pre>{displayCode}</pre>
{:else}
  <div class="release fail"><strong>FAIL</strong><span>Carve-G-Code wird nur aus dem freigegebenen Centerline-Pfad erzeugt.</span></div>{#each result.errors as error}<p class="error-line"><strong>FAIL</strong> {error}</p>{/each}{#each result.warnings as warning}<p class="warning"><strong>Hinweis:</strong> {warning}</p>{/each}
{/if}
{/if}

<style>
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}.release strong{font-size:.72rem;letter-spacing:.08em}.release.pass strong{color:#2f6b4d}.release.fail strong{color:#a13f38}.facts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.export-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin:14px 0;background:#f3f3f0;border-left:2px solid #727b75}.export-box div{display:grid;gap:3px}.export-box strong{font-size:.82rem;color:#333b37}.export-box span{font-size:.76rem;color:#6a706c}.primary-export{border:0;border-radius:7px;background:#3f4943;color:white;padding:8px 11px;cursor:pointer;white-space:nowrap}.primary-export:disabled,.code-head button:disabled{opacity:.45;cursor:not-allowed}.export-message{margin:-6px 0 12px;padding:8px 10px;font-size:.76rem;border-radius:6px;overflow-wrap:anywhere}.export-ok{background:#edf5ef;color:#2f6b4d}.export-error{background:#fff0ee;color:#8d3029}.code-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 7px;font-size:.75rem;color:#707570}.code-head button{border:1px solid #d1d3ce;border-radius:7px;background:#fff;padding:6px 9px;cursor:pointer;color:#4e5651}pre{max-height:360px;overflow:auto;margin:0;padding:12px;border:1px solid #deded8;border-radius:7px;background:#f5f5f2;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#37403b;white-space:pre}.note,.warning,.error-line{padding:10px 12px;font-size:.8rem;line-height:1.4}.note{background:#f3f3f0;color:#666b66}.warning{background:#fbf5e8;color:#76591f}.error-line{background:#fff0ee;color:#8d3029}
</style>
