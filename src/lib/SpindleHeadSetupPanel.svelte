<script lang="ts">
  import type { SpindleHeadGeometry } from './spindleHeadCollision';
  export let enabled=false;
  export let geometry:SpindleHeadGeometry={spindleNoseDiameterMm:80,spindleNoseBottomOffsetMm:60,spindleNoseLengthMm:80,carriageEnabled:false,carriageWidthMm:120,carriageDepthMm:120,carriageBottomOffsetMm:140,carriageHeightMm:120};
  export let head:SpindleHeadGeometry|undefined=undefined;
  export let onEnabledChange:(enabled:boolean)=>void=()=>{};
  export let onGeometryChange:(geometry:SpindleHeadGeometry)=>void=()=>{};
  export let onChange:((value:any)=>void)|undefined=undefined;
  $: effectiveGeometry=head??geometry;
  const number=(event:Event)=>Number((event.currentTarget as HTMLInputElement).value);
  function emitEnabled(value:boolean){onEnabledChange(value);onChange?.({enabled:value,head:effectiveGeometry});}
  function emitGeometry(value:SpindleHeadGeometry){onGeometryChange(value);onChange?.({enabled,head:value});}
  function set<K extends keyof SpindleHeadGeometry>(key:K,event:Event){const value=number(event);if(Number.isFinite(value))emitGeometry({...effectiveGeometry,[key]:value});}
</script>
<div class="spindle-setup">
  <div class="head"><div><strong>Spindelkopf · 004U</strong><span>Konservative Hüllgeometrie oberhalb von Halter und Auskragung.</span></div><div class="toggle"><button class:active={!enabled} onclick={()=>emitEnabled(false)}>Aus</button><button class:active={enabled} onclick={()=>emitEnabled(true)}>Aktiv</button></div></div>
  {#if enabled}
    <p class="warning"><strong>Sicherheitsrelevant:</strong> Hier reale oder bewusst konservative Maße deiner Spindel und Z-Einheit eintragen. Beispielwerte sind keine Maschinenfreigabe.</p>
    <div class="group"><strong>Spindelnase / Spannzange</strong><div class="grid"><label>Ø <input type="number" min="0.1" step="0.1" value={effectiveGeometry.spindleNoseDiameterMm} oninput={e=>set('spindleNoseDiameterMm',e)}/> mm</label><label>Unterkante ab Werkzeugspitze <input type="number" min="0" step="0.1" value={effectiveGeometry.spindleNoseBottomOffsetMm} oninput={e=>set('spindleNoseBottomOffsetMm',e)}/> mm</label><label>Länge <input type="number" min="0.1" step="0.1" value={effectiveGeometry.spindleNoseLengthMm} oninput={e=>set('spindleNoseLengthMm',e)}/> mm</label></div></div>
    <div class="group"><div class="subhead"><strong>Z-Schlitten-Hüllkörper</strong><div class="toggle"><button class:active={!effectiveGeometry.carriageEnabled} onclick={()=>emitGeometry({...effectiveGeometry,carriageEnabled:false})}>Aus</button><button class:active={effectiveGeometry.carriageEnabled} onclick={()=>emitGeometry({...effectiveGeometry,carriageEnabled:true})}>Aktiv</button></div></div>{#if effectiveGeometry.carriageEnabled}<div class="grid"><label>Breite X <input type="number" min="0.1" step="0.1" value={effectiveGeometry.carriageWidthMm} oninput={e=>set('carriageWidthMm',e)}/> mm</label><label>Tiefe Y <input type="number" min="0.1" step="0.1" value={effectiveGeometry.carriageDepthMm} oninput={e=>set('carriageDepthMm',e)}/> mm</label><label>Unterkante ab Werkzeugspitze <input type="number" min="0" step="0.1" value={effectiveGeometry.carriageBottomOffsetMm} oninput={e=>set('carriageBottomOffsetMm',e)}/> mm</label><label>Höhe <input type="number" min="0.1" step="0.1" value={effectiveGeometry.carriageHeightMm} oninput={e=>set('carriageHeightMm',e)}/> mm</label></div>{/if}</div>
  {:else}<p class="note">004U ist aus. Spindelnase und Z-Schlitten werden dann nicht gegen Spannmittel geprüft.</p>{/if}
</div>
<style>.spindle-setup{margin-top:12px;padding-top:12px;border-top:1px solid #deded8}.head,.subhead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.head>div:first-child{display:grid;gap:3px}.head strong,.group strong{font-size:.82rem}.head span,.note{font-size:.75rem;color:#6d736f;line-height:1.4}.toggle{display:flex;gap:4px}.toggle button{border:1px solid #d4d6d1;background:#fff;border-radius:6px;padding:5px 8px;font-size:.72rem}.toggle button.active{background:#e8efec;border-color:#9bb1a7}.group{display:grid;gap:8px;margin-top:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}label{display:grid;gap:3px;font-size:.72rem;color:#646a66}input{min-width:0;padding:6px 7px;border:1px solid #d7d8d3;border-radius:6px;background:#fff}.warning{padding:8px 10px;background:#fbf5e8;color:#76591f;font-size:.75rem;line-height:1.4}</style>
