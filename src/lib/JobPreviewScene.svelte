<script lang="ts">
  import { onMount } from 'svelte';
  import type { JobPreflightResult } from './jobPreflight';
  import { buildJobPreviewScene } from './jobPreviewScene';
  import { buildJobPreviewGeometry } from './jobPreviewGeometry';
  import { buildJobPreviewSimulationTimeline, sampleJobPreviewSimulation } from './jobPreviewSimulation';
  import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';

  export let result:JobPreflightResult;
  export let summary:ImportSummary;
  export let stock:StockDefinition;
  export let stockMode:StockMode;
  export let placement:PartPlacement;
  export let orientation:PartOrientation;
  export let wcs:WorkCoordinateSystem;
  export let onClose:()=>void=()=>{};

  const width=1200,height=760,pad=70,baseSimulationMmPerSecond=60;
  const defaultYaw=()=>summary.kind==='dxf'?(-0.72+Math.PI):-0.72;
  let sceneShell:HTMLDivElement;
  let yaw=defaultYaw(),pitch=0.48,zoom=1,panX=0,panY=0,dragging=false,lastX=0,lastY=0,dragMode:'orbit'|'pan'='orbit';
  let playing=false,simulationDistance=0,simulationSpeed=1,animationFrame=0,lastFrameTime=0;
  $: scene=buildJobPreviewScene(result);
  $: geometry=buildJobPreviewGeometry({summary,stock,stockMode,placement,orientation,wcs});
  $: timeline=buildJobPreviewSimulationTimeline(scene);
  $: if(simulationDistance>timeline.totalDistance)simulationDistance=timeline.totalDistance;
  $: simulationFrame=sampleJobPreviewSimulation(timeline,simulationDistance);

  function project(point:{x:number;y:number;z:number},viewYaw:number,viewPitch:number){const cy=Math.cos(viewYaw),sy=Math.sin(viewYaw),cp=Math.cos(viewPitch),sp=Math.sin(viewPitch),x1=point.x*cy-point.y*sy,y1=point.x*sy+point.y*cy;return{x:x1,y:y1*cp-point.z*sp};}
  function computeFit(points:{x:number;y:number}[],viewZoom:number,viewPanX:number,viewPanY:number){if(!points.length)return{scale:1,offsetX:width/2,offsetY:height/2};const xs=points.map(point=>point.x),ys=points.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),spanX=Math.max(maxX-minX,1e-6),spanY=Math.max(maxY-minY,1e-6),scale=Math.min((width-pad*2)/spanX,(height-pad*2)/spanY)*viewZoom;return{scale,offsetX:width/2-(minX+maxX)/2*scale+viewPanX,offsetY:height/2+(minY+maxY)/2*scale+viewPanY};}
  function renderPath(points:{x:number;y:number}[],viewFit:{scale:number;offsetX:number;offsetY:number},closed=false){const d=points.map((point,index)=>{const x=viewFit.offsetX+point.x*viewFit.scale,y=viewFit.offsetY-point.y*viewFit.scale;return`${index?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join(' ');return closed?`${d} Z`:d;}

  $: projected=scene.segments.map(segment=>({...segment,points:segment.points.map(point=>project(point,yaw,pitch))}));
  $: projectedStock=geometry.stockEdges.map(points=>points.map(point=>project(point,yaw,pitch)));
  $: projectedPart=geometry.partEdges.map(points=>points.map(point=>project(point,yaw,pitch)));
  $: projectedFaces=geometry.partFaces.map(points=>points.map(point=>project(point,yaw,pitch)));
  $: projectedPoints=[...projected.flatMap(segment=>segment.points),...projectedStock.flat(),...projectedPart.flat(),...projectedFaces.flat()];
  $: fit=computeFit(projectedPoints,zoom,panX,panY);
  $: rendered=projected.map(segment=>({...segment,d:renderPath(segment.points,fit)}));
  $: renderedStock=projectedStock.map(points=>renderPath(points,fit));
  $: renderedPart=projectedPart.map(points=>renderPath(points,fit));
  $: renderedFaces=projectedFaces.map(points=>renderPath(points,fit,true));
  $: projectedTool=simulationFrame.currentPoint?project(simulationFrame.currentPoint,yaw,pitch):null;
  $: toolScreen=projectedTool?{x:fit.offsetX+projectedTool.x*fit.scale,y:fit.offsetY-projectedTool.y*fit.scale}:null;
  $: currentOperation=simulationFrame.currentStep?.segment.operationLabel??'—';

  function resetView(){yaw=defaultYaw();pitch=0.48;zoom=1;panX=0;panY=0;}
  function wheel(event:WheelEvent){event.preventDefault();zoom=Math.max(.25,Math.min(8,zoom*Math.exp(-event.deltaY*.002)));}
  function pointerDown(event:PointerEvent){if(event.button!==0&&event.button!==1)return;const target=event.target as Element|null;if(target?.closest?.('button,select'))return;event.preventDefault();dragging=true;lastX=event.clientX;lastY=event.clientY;dragMode=event.shiftKey||event.button===1?'pan':'orbit';}
  function pointerMove(event:PointerEvent){if(!dragging)return;const dx=event.clientX-lastX,dy=event.clientY-lastY;lastX=event.clientX;lastY=event.clientY;if(dragMode==='pan'){panX+=dx;panY+=dy;}else{yaw+=dx*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.008));}}
  function pointerUp(){dragging=false;}

  function stopAnimation(){if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrameTime=0;}
  function pauseSimulation(){playing=false;stopAnimation();}
  function animationTick(now:number){
    if(!playing)return;
    if(!lastFrameTime)lastFrameTime=now;
    const elapsed=Math.min(.1,(now-lastFrameTime)/1000);
    lastFrameTime=now;
    simulationDistance=Math.min(timeline.totalDistance,simulationDistance+elapsed*baseSimulationMmPerSecond*simulationSpeed);
    if(simulationDistance>=timeline.totalDistance-1e-9){playing=false;stopAnimation();return;}
    animationFrame=requestAnimationFrame(animationTick);
  }
  function playSimulation(){
    if(!timeline.steps.length)return;
    if(simulationDistance>=timeline.totalDistance-1e-9)simulationDistance=0;
    if(playing)return;
    playing=true;lastFrameTime=0;animationFrame=requestAnimationFrame(animationTick);
  }
  function resetSimulation(){pauseSimulation();simulationDistance=0;}
  function changeSimulationSpeed(event:Event){simulationSpeed=Number((event.currentTarget as HTMLSelectElement).value)||1;}

  onMount(()=>{const shell=sceneShell,contextMenu=(event:MouseEvent)=>event.preventDefault();shell.addEventListener('pointerdown',pointerDown);shell.addEventListener('wheel',wheel,{passive:false});shell.addEventListener('contextmenu',contextMenu);window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerUp);return()=>{stopAnimation();shell.removeEventListener('pointerdown',pointerDown);shell.removeEventListener('wheel',wheel);shell.removeEventListener('contextmenu',contextMenu);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerUp);};});
</script>

<div class="backdrop" role="presentation" onclick={(event)=>event.currentTarget===event.target&&onClose()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Gesamtjob Simulation">
    <header><div><p class="eyebrow">005B · Simple Job Simulation</p><h2>Gesamtjob</h2><p class="subtitle">Read-only Simulation der bereits materialisierten Preflight-Motions. Keine CAM-Neuberechnung.</p></div><div class="actions"><button onclick={resetView}>Ansicht zurücksetzen</button><button class="close" onclick={onClose}>Schließen</button></div></header>
    <div class="simulation-bar" aria-label="Simulationssteuerung">
      <button class="primary" onclick={playing?pauseSimulation:playSimulation} disabled={!scene.motionCount}>{playing?'Pause':'Start'}</button>
      <button onclick={resetSimulation} disabled={!scene.motionCount}>Reset</button>
      <label>Tempo <select value={simulationSpeed} onchange={changeSimulationSpeed}><option value="0.5">0,5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label>
      <div class="progress" aria-label={`Simulation ${(simulationFrame.progress*100).toFixed(0)} Prozent`}><span style={`width:${(simulationFrame.progress*100).toFixed(2)}%`}></span></div>
      <span class="progress-label">{(simulationFrame.progress*100).toFixed(0)} %</span>
      <span class="operation">Operation: <strong>{currentOperation}</strong></span>
      <span class="tempo-note">Darstellungstempo · keine Zeitprognose</span>
    </div>
    <div class="scene-shell" bind:this={sceneShell}>
      {#if scene.motionCount}
        <svg viewBox={`0 0 ${width} ${height}`} aria-label="Rohling, Bauteil und simulierte Werkzeugbewegung des Gesamtjobs"><rect x="0" y="0" width={width} height={height} class="background"/>
          {#each renderedStock as d}<path {d} class="stock"/>{/each}
          {#each renderedFaces as d}<path {d} class="part-face"/>{/each}
          {#each renderedPart as d}<path {d} class="part"/>{/each}
          {#each rendered as segment,index}<path d={segment.d} class:rapid={segment.kind==='rapid3'} class:cut={segment.kind!=='rapid3'} class:done={index<simulationFrame.completedSegmentCount} class:current={index===simulationFrame.completedSegmentCount&&simulationFrame.progress<1}/>{/each}
          {#if toolScreen}<circle cx={toolScreen.x} cy={toolScreen.y} r="6" class="tool"/><circle cx={toolScreen.x} cy={toolScreen.y} r="11" class="tool-ring"/>{/if}
        </svg>
        <div class="legend"><span><i class="stock-swatch"></i>Rohling</span><span><i class="part-swatch"></i>Bauteil</span><span><i class="cut-swatch"></i>Schnittbewegung</span><span><i class="rapid-swatch"></i>Rapid</span><span><i class="done-swatch"></i>Gefahren</span><span>Maus: ziehen = drehen · Shift+Ziehen = verschieben · Rad = zoomen</span></div>
      {:else}<div class="empty"><strong>Keine freigegebenen Maschinenbewegungen vorhanden.</strong><span>Die Simulation erfindet keine Ersatzbahn und zeigt deshalb nichts an.</span></div>{/if}
    </div>
    <footer><span>{scene.operationCount} Operationen</span><span>{scene.motionCount} Maschinenbewegungen</span><span>{scene.cuttingCount} Schnitt</span><span>{scene.rapidCount} Rapid</span>{#if simulationFrame.currentPoint}<span>Werkzeug X {simulationFrame.currentPoint.x.toFixed(2)} · Y {simulationFrame.currentPoint.y.toFixed(2)} · Z {simulationFrame.currentPoint.z.toFixed(2)} mm</span>{/if}{#if scene.bounds}<span>X {scene.bounds.minX.toFixed(2)}…{scene.bounds.maxX.toFixed(2)} · Y {scene.bounds.minY.toFixed(2)}…{scene.bounds.maxY.toFixed(2)} · Z {scene.bounds.minZ.toFixed(2)}…{scene.bounds.maxZ.toFixed(2)} mm</span>{/if}</footer>
  </div>
</div>
<style>
  .backdrop{position:fixed;inset:0;z-index:1000;background:rgba(24,28,26,.72);display:grid;place-items:center;padding:28px}.dialog{width:min(1320px,calc(100vw - 56px));height:min(900px,calc(100vh - 56px));background:#f5f5f2;border:1px solid #c9ccc7;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:grid;grid-template-rows:auto auto 1fr auto;overflow:hidden}.dialog header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:18px 20px 14px;border-bottom:1px solid #d9dbd6}.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#727873;margin:0 0 5px}.dialog h2{margin:0;color:#2c3530}.subtitle{margin:4px 0 0;color:#6c726e;font-size:.82rem}.actions{display:flex;gap:8px}.actions button,.simulation-bar button,.simulation-bar select{border:1px solid #c9cdc8;background:#fff;border-radius:7px;padding:8px 11px;color:#3d4641;cursor:pointer}.actions .close,.simulation-bar .primary{background:#2f3933;color:#fff;border-color:#2f3933}.actions button:disabled,.simulation-bar button:disabled{opacity:.45;cursor:default}.simulation-bar{display:flex;align-items:center;gap:9px;padding:9px 16px;border-bottom:1px solid #d9dbd6;background:#f9f9f7;color:#59615c;font-size:.76rem}.simulation-bar label{display:flex;align-items:center;gap:6px}.simulation-bar select{padding:6px 8px}.progress{height:7px;min-width:150px;flex:1;max-width:330px;border-radius:99px;overflow:hidden;background:#dde0dc}.progress span{display:block;height:100%;background:#61766a}.progress-label{font-variant-numeric:tabular-nums;min-width:34px}.operation{white-space:nowrap}.tempo-note{color:#7b817d;font-size:.68rem}.scene-shell{position:relative;min-height:0;background:#eceeea;touch-action:none;cursor:grab;user-select:none}.scene-shell:active{cursor:grabbing}.scene-shell svg{display:block;width:100%;height:100%;pointer-events:none}.background{fill:#eceeea}.scene-shell path{vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.scene-shell path.stock{fill:none;stroke:#a9aea8;stroke-width:1.15;stroke-dasharray:3 3}.scene-shell path.part-face{fill:#d8dcd8;stroke:none}.scene-shell path.part{fill:none;stroke:#6e756f;stroke-width:.8;opacity:.62}.scene-shell path.cut{fill:none;stroke:#315f69;stroke-width:1.35;opacity:.48}.scene-shell path.rapid{fill:none;stroke:#8b7a59;stroke-width:1.05;stroke-dasharray:5 5;opacity:.38}.scene-shell path.done{stroke:#3f6f55;stroke-width:1.8;opacity:.95}.scene-shell path.current{stroke:#202a24;stroke-width:2.3;opacity:1}.scene-shell circle.tool{fill:#202a24;stroke:#f7f7f4;stroke-width:1.5;vector-effect:non-scaling-stroke}.scene-shell circle.tool-ring{fill:none;stroke:#202a24;stroke-width:1;opacity:.35;vector-effect:non-scaling-stroke}.legend{position:absolute;left:16px;bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:rgba(250,250,247,.9);border:1px solid #d5d8d3;border-radius:8px;padding:8px 10px;font-size:.72rem;color:#626963;pointer-events:none}.legend span{display:flex;gap:6px;align-items:center}.legend i{width:18px;height:2px;display:inline-block}.stock-swatch{border-top:2px dashed #a9aea8}.part-swatch{background:#6e756f}.cut-swatch{background:#315f69}.rapid-swatch{background:#8b7a59}.done-swatch{background:#3f6f55}.empty{height:100%;display:grid;place-content:center;text-align:center;gap:6px;color:#59615c}.empty span{font-size:.82rem;color:#747b76}.dialog footer{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:11px 16px;border-top:1px solid #d9dbd6;background:#f9f9f7}.dialog footer span{font-size:.72rem;padding:5px 7px;border-radius:5px;background:#eceeea;color:#59615c}
  @media(max-width:800px){.simulation-bar{flex-wrap:wrap}.progress{min-width:120px}.operation{white-space:normal}}
</style>
