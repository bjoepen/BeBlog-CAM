<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import type {
    ImportSummary,
    StockDefinition,
    PartPlacement,
    PartOrientation,
    WorkCoordinateSystem,
    SurfaceFinishingOperation,
  } from './types';
  import { buildSurfaceFinishingOperationState } from './surfaceFinishingOperation';
  import { postSurfaceFinishingCanonicalToolpath } from './surfaceFinishingGcode';
  import { postProcessGcode } from './postprocessors';
  import { postProcessorStore } from './postProcessorStore';
  import PostProcessorPicker from './PostProcessorPicker.svelte';

  export let summary:ImportSummary;
  export let stock:StockDefinition;
  export let placement:PartPlacement;
  export let orientation:PartOrientation;
  export let wcs:WorkCoordinateSystem;
  export let operation:SurfaceFinishingOperation;

  let copied=false;
  let exportMessage='';
  let exportState:''|'saved'|'error'='';

  $: state=buildSurfaceFinishingOperationState({
    summary,
    stock,
    placement,
    orientation,
    wcs,
    operation,
  });

  $: raw=state.ok&&state.toolpath
    ?postSurfaceFinishingCanonicalToolpath(state.toolpath,operation)
    :{ok:false,errors:state.errors,warnings:state.warnings,code:''};

  $: processed=raw.ok
    ?postProcessGcode(raw.code,$postProcessorStore)
    :{ok:false,errors:raw.errors,warnings:raw.warnings,code:''};

  $: displayCode=processed.code;
  $: motionCount=state.toolpath?.motions?.length??0;
  $: rapidCount=state.toolpath?.motions?.filter(motion=>motion.kind==='rapid3').length??0;
  $: cutCount=motionCount-rapidCount;
  $: valid=state.ok&&!!state.toolpath&&raw.ok&&processed.ok&&motionCount>0;

  function defaultNcName(){
    const base=(summary.fileName||'beblog-cam')
      .replace(/\.[^.]+$/,'')
      .replace(/[^a-zA-Z0-9äöüÄÖÜß._ -]+/g,'-')
      .trim()||'beblog-cam';
    return `${base}-3d-finishing.nc`;
  }

  async function copyCode(){
    if(!valid||!displayCode)return;
    await navigator.clipboard.writeText(displayCode);
    copied=true;
    setTimeout(()=>copied=false,1200);
  }

  async function saveNc(){
    if(!valid||!displayCode)return;
    exportState='';
    exportMessage='';
    try{
      let path=await save({
        defaultPath:defaultNcName(),
        filters:[{name:'NC-Programm',extensions:['nc']}],
      });
      if(!path)return;
      if(!path.toLowerCase().endsWith('.nc'))path=`${path}.nc`;
      await invoke('save_nc_file',{path,code:displayCode});
      exportState='saved';
      exportMessage=`Gespeichert: ${path}`;
    }catch(error){
      exportState='error';
      exportMessage=String(error);
    }
  }
</script>

<p class="eyebrow">06 · Fräsen</p>
<h2>3D Schlichten</h2>

{#if valid}
  <div class="release pass">
    <strong>PASS</strong>
    <span>
      {state.chainCount} Schlichtkette{state.chainCount===1?'':'n'} ·
      {state.contactPointCount} Kontaktpunkte ·
      {cutCount} XYZ-Schnittbewegungen ·
      {rapidCount} sichere Rapid-Bewegungen
    </span>
  </div>

  <p class="boundary">
    <strong>Ballnose-Vertrag aktiv:</strong>
    Ausschließlich Vollradiusfräser · kompensierte XYZ-Bahn auf der gewählten STEP/BRep-Fläche ·
    Stay-down-Linking mit Safe-Z-Fallback.
  </p>

  <p class="facts">
    Werkzeug Ø {operation.tool.diameterMm.toFixed(3)} mm ·
    {operation.direction==='x'?'Parallel X':'Parallel Y'} ·
    {operation.stepoverPercent}% Stepover ·
    Sicherheits-Z {operation.safeZMm.toFixed(3)} mm
  </p>

  <PostProcessorPicker/>

  {#each processed.warnings as warning}
    <p class="warning"><strong>Postprozessor:</strong> {warning}</p>
  {/each}
  {#each processed.errors as error}
    <p class="error-line"><strong>FAIL</strong> {error}</p>
  {/each}

  <div class="export-box">
    <div>
      <strong>NC-Programm 3D Schlichten</strong>
      <span>G0/G1-XYZ aus demselben kanonischen Toolpath wie Bearbeiten und Prüfen.</span>
    </div>
    <button class="primary-export" disabled={!valid} onclick={saveNc}>G-Code speichern …</button>
  </div>

  {#if exportMessage}
    <p class:export-ok={exportState==='saved'} class:export-error={exportState==='error'} class="export-message">
      {exportMessage}
    </p>
  {/if}

  <div class="code-head">
    <span>Vorschau · {$postProcessorStore}</span>
    <button disabled={!valid} onclick={copyCode}>{copied?'Kopiert':'G-Code kopieren'}</button>
  </div>
  <pre>{displayCode}</pre>
{:else}
  <div class="release fail">
    <strong>FAIL</strong>
    <span>Der 3D-Schlichtwerkzeugweg ist nicht exportierbar.</span>
  </div>

  {#each state.errors as error}
    <p class="error-line"><strong>3D Schlichten:</strong> {error}</p>
  {/each}
  {#each raw.errors as error}
    <p class="error-line"><strong>XYZ-Post:</strong> {error}</p>
  {/each}
{/if}

<style>
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}
.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}
.release strong{font-size:.72rem;letter-spacing:.08em}
.release.pass strong{color:#2f6b4d}
.release.fail strong{color:#a13f38}
.boundary,.facts{padding:10px 12px;font-size:.8rem;line-height:1.4;background:#f3f3f0;color:#5e6661}
.boundary{border-left:2px solid #327b8d}
.export-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin:14px 0;background:#f3f3f0;border-left:2px solid #727b75}
.export-box div{display:grid;gap:3px}
.export-box strong{font-size:.82rem}
.export-box span{font-size:.76rem;color:#6a706c}
.primary-export{border:0;border-radius:7px;background:#3f4943;color:white;padding:8px 11px;cursor:pointer}
.primary-export:disabled,.code-head button:disabled{opacity:.45}
.code-head{display:flex;justify-content:space-between;align-items:center;margin:14px 0 7px;font-size:.75rem;color:#707570}
.code-head button{border:1px solid #d1d3ce;border-radius:7px;background:#fff;padding:6px 9px;cursor:pointer}
pre{max-height:360px;overflow:auto;margin:0;padding:12px;border:1px solid #deded8;border-radius:7px;background:#f5f5f2;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre}
.warning,.error-line{padding:10px 12px;font-size:.8rem}
.warning{background:#fbf5e8;color:#76591f}
.error-line{background:#fff0ee;color:#8d3029}
.export-message{padding:8px 10px;font-size:.76rem;border-radius:6px}
.export-ok{background:#edf5ef;color:#2f6b4d}
.export-error{background:#fff0ee;color:#8d3029}
</style>
