<script lang="ts">
  import type { JobPreflightResult } from './jobPreflight';
  import { buildJobPreviewScene } from './jobPreviewScene';

  export let result:JobPreflightResult;
  export let onClose:()=>void=()=>{};

  const width=1200,height=760,pad=70;
  let yaw=-0.72,pitch=0.48,zoom=1,panX=0,panY=0,dragging=false,lastX=0,lastY=0,dragMode:'orbit'|'pan'='orbit';
  $: scene=buildJobPreviewScene(result);

  function project(point:{x:number;y:number;z:number}){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const x1=point.x*cy-point.y*sy;
    const y1=point.x*sy+point.y*cy;
    return{x:x1,y:y1*cp-point.z*sp};
  }

  $: projected=scene.segments.map(segment=>({...segment,points:segment.points.map(project)}));
  $: projectedPoints=projected.flatMap(segment=>segment.points);
  $: fit=(()=>{
    if(!projectedPoints.length)return{scale:1,offsetX:width/2,offsetY:height/2};
    const xs=projectedPoints.map(point=>point.x),ys=projectedPoints.map(point=>point.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const spanX=Math.max(maxX-minX,1e-6),spanY=Math.max(maxY-minY,1e-6);
    const scale=Math.min((width-pad*2)/spanX,(height-pad*2)/spanY)*zoom;
    return{scale,offsetX:width/2-(minX+maxX)/2*scale+panX,offsetY:height/2+(minY+maxY)/2*scale+panY};
  })();

  function screen(point:{x:number;y:number}){return{x:fit.offsetX+point.x*fit.scale,y:fit.offsetY-point.y*fit.scale};}
  function path(points:{x:number;y:number}[]){return points.map((point,index)=>{const p=screen(point);return`${index?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;}).join(' ');}
  function resetView(){yaw=-0.72;pitch=0.48;zoom=1;panX=0;panY=0;}
  function wheel(event:WheelEvent){event.preventDefault();zoom=Math.max(.25,Math.min(8,zoom*(event.deltaY<0?1.12:.89)));}
  function pointerDown(event:PointerEvent){dragging=true;lastX=event.clientX;lastY=event.clientY;dragMode=event.shiftKey||event.button===1?'pan':'orbit';(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);}
  function pointerMove(event:PointerEvent){if(!dragging)return;const dx=event.clientX-lastX,dy=event.clientY-lastY;lastX=event.clientX;lastY=event.clientY;if(dragMode==='pan'){panX+=dx;panY+=dy;}else{yaw+=dx*.006;pitch=Math.max(-1.35,Math.min(1.35,pitch-dy*.006));}}
  function pointerUp(){dragging=false;}
</script>

<div class="backdrop" role="presentation" onclick={(event)=>event.currentTarget===event.target&&onClose()}>
  <section class="dialog" role="dialog" aria-modal="true" aria-label="Gesamtjob Preview">
    <header>
      <div><p class="eyebrow">005A · Job Preview</p><h2>Gesamtjob</h2><p class="subtitle">Read-only Darstellung der bereits materialisierten Preflight-Motions.</p></div>
      <div class="actions"><button onclick={resetView}>Ansicht zurücksetzen</button><button class="close" onclick={onClose}>Schließen</button></div>
    </header>

    <div class="scene-shell">
      {#if scene.motionCount}
        <svg viewBox={`0 0 ${width} ${height}`} onwheel={wheel} onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={pointerUp}>
          <rect x="0" y="0" width={width} height={height} class="background"/>
          {#each projected as segment}
            <path d={path(segment.points)} class:rapid={segment.kind==='rapid3'} class:cut={segment.kind!=='rapid3'}/>
          {/each}
        </svg>
        <div class="legend"><span><i class="cut-swatch"></i>Schnittbewegung</span><span><i class="rapid-swatch"></i>Rapid / Sicherheitsbewegung</span><span>Maus: drehen · Shift+Ziehen: verschieben · Rad: zoomen</span></div>
      {:else}
        <div class="empty"><strong>Keine freigegebenen Maschinenbewegungen vorhanden.</strong><span>Die Preview erfindet keine Ersatzbahn und zeigt deshalb nichts an.</span></div>
      {/if}
    </div>

    <footer>
      <span>{scene.operationCount} Operationen</span><span>{scene.motionCount} Maschinenbewegungen</span><span>{scene.cuttingCount} Schnitt</span><span>{scene.rapidCount} Rapid</span>
      {#if scene.bounds}<span>X {scene.bounds.minX.toFixed(2)}…{scene.bounds.maxX.toFixed(2)} · Y {scene.bounds.minY.toFixed(2)}…{scene.bounds.maxY.toFixed(2)} · Z {scene.bounds.minZ.toFixed(2)}…{scene.bounds.maxZ.toFixed(2)} mm</span>{/if}
    </footer>
  </section>
</div>

<style>
  .backdrop{position:fixed;inset:0;z-index:1000;background:rgba(24,28,26,.72);display:grid;place-items:center;padding:28px}.dialog{width:min(1320px,calc(100vw - 56px));height:min(900px,calc(100vh - 56px));background:#f5f5f2;border:1px solid #c9ccc7;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}.dialog header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:18px 20px 14px;border-bottom:1px solid #d9dbd6}.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#727873;margin:0 0 5px}.dialog h2{margin:0;color:#2c3530}.subtitle{margin:4px 0 0;color:#6c726e;font-size:.82rem}.actions{display:flex;gap:8px}.actions button{border:1px solid #c9cdc8;background:#fff;border-radius:7px;padding:8px 11px;color:#3d4641;cursor:pointer}.actions .close{background:#2f3933;color:#fff;border-color:#2f3933}.scene-shell{position:relative;min-height:0;background:#eceeea}.scene-shell svg{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.scene-shell svg:active{cursor:grabbing}.background{fill:#eceeea}.scene-shell path{fill:none;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.scene-shell path.cut{stroke:#315f69;stroke-width:1.6}.scene-shell path.rapid{stroke:#8b7a59;stroke-width:1.05;stroke-dasharray:5 5;opacity:.72}.legend{position:absolute;left:16px;bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:rgba(250,250,247,.9);border:1px solid #d5d8d3;border-radius:8px;padding:8px 10px;font-size:.72rem;color:#626963}.legend span{display:flex;gap:6px;align-items:center}.legend i{width:18px;height:2px;display:inline-block}.cut-swatch{background:#315f69}.rapid-swatch{background:#8b7a59}.empty{height:100%;display:grid;place-content:center;text-align:center;gap:6px;color:#59615c}.empty span{font-size:.82rem;color:#747b76}.dialog footer{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:11px 16px;border-top:1px solid #d9dbd6;background:#f9f9f7}.dialog footer span{font-size:.72rem;padding:5px 7px;border-radius:5px;background:#eceeea;color:#59615c}
</style>
