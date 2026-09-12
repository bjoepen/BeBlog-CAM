<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import type { Curve2, ImportSummary, OperationsProject, SurfaceCarveOperation, ZLevelRoughingOperation } from './types';

  export let summary:ImportSummary;
  export let project:OperationsProject;
  export let operation:SurfaceCarveOperation;
  export let onChange:(operation:SurfaceCarveOperation)=>void=()=>{};

  let geometrySummary:ImportSummary|null=null;
  let geometryError='';
  let loadingGeometry=false;
  let loadedPath:string|null=null;

  const eligibleCurve=(curve:Curve2)=>curve.kind==='line'||curve.kind==='polyline'||curve.kind==='arc'||curve.kind==='circle';
  $: earlier=project.operations.slice(0,Math.max(0,project.operations.findIndex(candidate=>candidate.id===operation.id)));
  $: roughingCandidates=earlier.filter((candidate):candidate is ZLevelRoughingOperation=>candidate.kind==='z-level-roughing'&&candidate.enabled!==false&&(candidate.roughingMode??'face-target')==='face-target');
  $: matchingRoughing=roughingCandidates.filter(candidate=>operation.faceId!==null&&candidate.faceIds.includes(operation.faceId));
  $: geometryCurveCount=geometrySummary?.planarGeometry?.curves.filter(eligibleCurve).length??0;

  $: if(operation.geometrySource?.path&&operation.geometrySource.path!==loadedPath&&!loadingGeometry){void restoreGeometry(operation.geometrySource.path);}

  function update(patch:Partial<SurfaceCarveOperation>){
    onChange({...operation,...patch});
  }

  function numberFrom(event:Event){return Number((event.currentTarget as HTMLInputElement).value);}
  function updateFaceId(event:Event){const raw=(event.currentTarget as HTMLInputElement).value.trim();const value=raw===''?null:Number(raw);if(value===null||(Number.isInteger(value)&&value>=0))update({faceId:value,roughingOperationId:null});}
  function chooseRoughing(event:Event){update({roughingOperationId:(event.currentTarget as HTMLSelectElement).value||null});}
  function updateGeometryTransform(field:'offsetX'|'offsetY'|'scale'|'rotationDeg',event:Event){
    if(!operation.geometrySource)return;
    const value=numberFrom(event);
    if(!Number.isFinite(value))return;
    if(field==='scale'&&value<=0)return;
    const geometrySource={...operation.geometrySource,[field]:value};
    update({geometrySource,geometrySourceId:geometrySource.id});
  }

  async function restoreGeometry(path:string){
    loadingGeometry=true;geometryError='';
    try{
      const restored=await invoke<ImportSummary>('inspect_import',{path});
      if(restored.kind!=='dxf'||!restored.planarGeometry)throw new Error('Surface Carve erwartet eine DXF-2D-Geometrie.');
      geometrySummary=restored;loadedPath=path;
    }catch(error){geometrySummary=null;loadedPath=path;geometryError=`2D-Geometrie konnte nicht geladen werden: ${String(error)}`;}
    finally{loadingGeometry=false;}
  }

  async function importGeometry(){
    geometryError='';
    const path=await open({multiple:false,directory:false,filters:[{name:'2D-Geometrie',extensions:['dxf']}]});
    if(!path||Array.isArray(path))return;
    loadingGeometry=true;
    try{
      const imported=await invoke<ImportSummary>('inspect_import',{path});
      if(imported.kind!=='dxf'||!imported.planarGeometry)throw new Error('Surface Carve akzeptiert in diesem Build ausschließlich normalisierte DXF-2D-Geometrie.');
      const id=`surface-carve-geometry-${operation.id}`;
      geometrySummary=imported;loadedPath=path;
      update({geometrySourceId:id,geometrySource:{id,path,fileName:imported.fileName,offsetX:0,offsetY:0,scale:1,rotationDeg:0}});
    }catch(error){geometrySummary=null;geometryError=String(error);}
    finally{loadingGeometry=false;}
  }

  function clearGeometry(){geometrySummary=null;loadedPath=null;geometryError='';update({geometrySourceId:null,geometrySource:null});}
</script>

<div class="surface-carve-panel">
  {#if summary.kind!=='step'}
    <p class="note"><strong>Surface Carve ist STEP-only.</strong> Das Ausgangsmodell muss unter Bauteil als STEP/STP geladen sein.</p>
  {:else}
    <div class="placement-section">
      <p class="placement-title">STEP-Fläche</p>
      <label>Face ID <input type="number" min="0" step="1" value={operation.faceId??''} oninput={updateFaceId}/></label>
      <p class="note">Surface Carve bleibt eine eigenständige Operation. Die Ziel-Fläche muss zuvor durch eine eigenständige Z-Level-Schruppoperation bearbeitet worden sein.</p>
      {#if operation.faceId!==null}
        <label>Vorheriges Z-Level Schruppen
          <select value={operation.roughingOperationId??''} onchange={chooseRoughing}>
            <option value="">Quelle wählen …</option>
            {#each matchingRoughing as candidate}<option value={candidate.id}>{candidate.name} · Face {operation.faceId}</option>{/each}
          </select>
        </label>
        {#if matchingRoughing.length===0}<p class="note"><strong>Noch nicht freigegeben:</strong> Vor Surface Carve fehlt eine aktive Z-Level-Schruppoperation im Face-Target-Modus für Face {operation.faceId}.</p>{/if}
      {/if}
    </div>

    <div class="placement-section">
      <p class="placement-title">Sekundäre 2D-Geometrie</p>
      {#if operation.geometrySource}
        <dl><div><dt>Datei</dt><dd>{operation.geometrySource.fileName}</dd></div><div><dt>Quelle</dt><dd>DXF · Bearbeiten</dd></div><div><dt>Geometrie</dt><dd>{loadingGeometry?'wird geladen …':geometryCurveCount?`${geometryCurveCount} Kurven`:'—'}</dd></div></dl>
        <div class="placement-grid two"><button class="secondary" onclick={importGeometry}>Ersetzen</button><button class="secondary" onclick={clearGeometry}>Entfernen</button></div>
      {:else}
        <p class="note">Diese Geometrie gehört ausschließlich zur Surface-Carve-Operation und verändert das Ausgangsmodell unter Bauteil nicht.</p>
        <button class="primary" onclick={importGeometry} disabled={loadingGeometry}>{loadingGeometry?'Lade …':'2D-Geometrie laden …'}</button>
      {/if}
      {#if geometryError}<p class="note"><strong>Import:</strong> {geometryError}</p>{/if}
    </div>

    {#if operation.geometrySource}
      <div class="placement-section">
        <p class="placement-title">2D-Geometrie platzieren</p>
        <label>Versatz X <input type="number" step="0.1" value={operation.geometrySource.offsetX} oninput={e=>updateGeometryTransform('offsetX',e)}/> mm</label>
        <label>Versatz Y <input type="number" step="0.1" value={operation.geometrySource.offsetY} oninput={e=>updateGeometryTransform('offsetY',e)}/> mm</label>
        <label>Skalierung <input type="number" min="0.001" step="0.05" value={operation.geometrySource.scale} oninput={e=>updateGeometryTransform('scale',e)}/> ×</label>
        <label>Rotation <input type="number" step="1" value={operation.geometrySource.rotationDeg} oninput={e=>updateGeometryTransform('rotationDeg',e)}/> °</label>
        <p class="note">Skalierung bleibt proportional. Die Werte werden mit der Operation gespeichert; die eigentliche Projektion auf die STEP-Fläche folgt dem bereits geprüften 007B-Kern.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
.surface-carve-panel{display:grid;gap:10px}.surface-carve-panel dl{display:grid;gap:6px}.surface-carve-panel dl>div{display:grid;grid-template-columns:72px 1fr;gap:8px}.surface-carve-panel dt{color:#737973;font-size:.72rem}.surface-carve-panel dd{margin:0;font-size:.76rem;overflow-wrap:anywhere}
</style>
