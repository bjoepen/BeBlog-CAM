<script lang="ts">
  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';
  export let enabled=false;
  export let envelope:MachineEnvelope={minX:0,maxX:500,minY:0,maxY:500,minZ:-100,maxZ:0,warningMarginMm:5};
  export let wcsOrigin:MachineWcsOrigin={x:0,y:0,z:0};
  export let onEnabledChange:(enabled:boolean)=>void=()=>{};
  export let onEnvelopeChange:(value:MachineEnvelope)=>void=()=>{};
  export let onWcsOriginChange:(value:MachineWcsOrigin)=>void=()=>{};
  const number=(event:Event)=>Number((event.currentTarget as HTMLInputElement).value);
  function setEnvelope<K extends keyof MachineEnvelope>(key:K,event:Event){const value=number(event);if(Number.isFinite(value))onEnvelopeChange({...envelope,[key]:value});}
  function setOrigin<K extends keyof MachineWcsOrigin>(key:K,event:Event){const value=number(event);if(Number.isFinite(value))onWcsOriginChange({...wcsOrigin,[key]:value});}
</script>
<div class="machine-setup">
  <div class="head"><div><strong>Maschinenarbeitsraum · 004S</strong><span>Reale Achsgrenzen und aktuelle WCS-Position in Maschinenkoordinaten.</span></div><div class="toggle"><button class:active={!enabled} onclick={()=>onEnabledChange(false)}>Aus</button><button class:active={enabled} onclick={()=>onEnabledChange(true)}>Aktiv</button></div></div>
  {#if enabled}
    <p class="warning"><strong>Sicherheitsrelevant:</strong> Keine Beispielwerte übernehmen. Hier müssen die tatsächlich nutzbaren Maschinenkoordinaten deiner CNC stehen.</p>
    <div class="group"><strong>Maschinenlimits</strong><div class="grid"><label>X min <input type="number" step="0.1" value={envelope.minX} oninput={e=>setEnvelope('minX',e)}/> mm</label><label>X max <input type="number" step="0.1" value={envelope.maxX} oninput={e=>setEnvelope('maxX',e)}/> mm</label><label>Y min <input type="number" step="0.1" value={envelope.minY} oninput={e=>setEnvelope('minY',e)}/> mm</label><label>Y max <input type="number" step="0.1" value={envelope.maxY} oninput={e=>setEnvelope('maxY',e)}/> mm</label><label>Z min <input type="number" step="0.1" value={envelope.minZ} oninput={e=>setEnvelope('minZ',e)}/> mm</label><label>Z max <input type="number" step="0.1" value={envelope.maxZ} oninput={e=>setEnvelope('maxZ',e)}/> mm</label></div><label>Warnabstand <input type="number" min="0" step="0.5" value={envelope.warningMarginMm} oninput={e=>setEnvelope('warningMarginMm',e)}/> mm</label></div>
    <div class="group"><strong>Aktueller WCS-Ursprung in Maschinenkoordinaten</strong><div class="grid three"><label>X <input type="number" step="0.1" value={wcsOrigin.x} oninput={e=>setOrigin('x',e)}/> mm</label><label>Y <input type="number" step="0.1" value={wcsOrigin.y} oninput={e=>setOrigin('y',e)}/> mm</label><label>Z <input type="number" step="0.1" value={wcsOrigin.z} oninput={e=>setOrigin('z',e)}/> mm</label></div><p class="note">004S addiert diese Maschinenposition zu allen kanonischen WCS-Koordinaten. Erst danach werden X/Y/Z-Limits geprüft.</p></div>
  {:else}<p class="note">Maschinenraumprüfung ist aus. Der Job wird dann nicht gegen reale Achsgrenzen geprüft.</p>{/if}
</div>
<style>.machine-setup{margin-top:12px;padding-top:12px;border-top:1px solid #deded8}.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.head>div:first-child{display:grid;gap:3px}.head strong,.group>strong{font-size:.82rem}.head span,.note{font-size:.75rem;color:#6d736f;line-height:1.4}.toggle{display:flex;gap:4px}.toggle button{border:1px solid #d4d6d1;background:#fff;border-radius:6px;padding:5px 8px;font-size:.72rem}.toggle button.active{background:#e8efec;border-color:#9bb1a7}.group{display:grid;gap:8px;margin-top:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.grid.three{grid-template-columns:repeat(3,1fr)}label{display:grid;gap:3px;font-size:.72rem;color:#646a66}input{min-width:0;padding:6px 7px;border:1px solid #d7d8d3;border-radius:6px;background:#fff}.warning{padding:8px 10px;background:#fbf5e8;color:#76591f;font-size:.75rem;line-height:1.4}</style>
