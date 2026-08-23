<script lang="ts">
  import { onMount } from 'svelte';
  import type { Curve2, ImportSummary, Point2, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
  import { projectPoint, projectTriangles, type P2, type P3, type View } from './stepView';
  import { decodeStepEdges } from './stepEdgeView';
  import { sliceTrianglesByStep } from './zLevelSlice';

  export let summary:ImportSummary;
  export let stock:StockDefinition;
  export let stockMode:StockMode;
  export let placement:PartPlacement;
  export let orientation:PartOrientation;
  export let wcs:WorkCoordinateSystem;

  const width=1000,height=650,pad=54;
  let viewport:SVGSVGElement;
  let root:HTMLDivElement;
  let yaw=-.72,pitch=.48,zoom=1,viewX=0,viewY=0,dragging=false,lastX=0,lastY=0,dragMode:'orbit'|'pan'='orbit';
  let showZLevels=false;
  let zLevelStepMm=2;

  const finite=(p:P2)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
  function fit(points:P2[]){
    const p=points.filter(finite);
    if(!p.length)return(q:P2)=>q;
    const xs=p.map(q=>q.x),ys=p.map(q=>q.y),a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys);
    const sx=Math.max(b-a,1e-9),sy=Math.max(d-c,1e-9),s=Math.min((width-2*pad)/sx,(height-2*pad)/sy),ox=(width-sx*s)/2,oy=(height-sy*s)/2;
    return(q:P2)=>({x:ox+(q.x-a)*s,y:height-(oy+(q.y-c)*s)});
  }
  function sample(c:Curve2):Point2[]{
    if(c.kind==='line')return[c.start,c.end];
    if(c.kind==='polyline')return c.points;
    if(c.kind==='circle')return Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return{x:c.center.x+Math.cos(a)*c.radius,y:c.center.y+Math.sin(a)*c.radius}});
    if(c.kind==='arc'){let a=c.startAngleDeg,b=c.endAngleDeg;while(b<a)b+=360;return Array.from({length:33},(_,i)=>{const r=(a+(b-a)*i/32)*Math.PI/180;return{x:c.center.x+Math.cos(r)*c.radius,y:c.center.y+Math.sin(r)*c.radius}})}
    return[];
  }
  const path=(p:P2[],closed=false)=>p.map((q,i)=>`${i?'L':'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')+(closed?' Z':'');
  function rotate2(p:P2):P2{const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}}
  function rotate3(p:P3):P3{const q=rotate2(p);return{x:q.x,y:q.y,z:p.z}}
  function bounds3(p:P3[]){const x=p.map(q=>q.x),y=p.map(q=>q.y),z=p.map(q=>q.z);return{minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y),minZ:Math.min(...z)}}
  function bounds2(p:P2[]){const x=p.map(q=>q.x),y=p.map(q=>q.y);return{minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y)}}
  function place(a:number,b:number,c:number,d:number){const pw=b-a,ph=d-c,tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-pw:(stock.width-pw)/2,ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-ph:(stock.height-ph)/2;return{dx:tx-a+placement.offsetX,dy:ty-c+placement.offsetY}}
  function wcsPoint():P3{return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0}}
  function faceFill(shade:number){const lightness=88-Math.round(Math.max(0,Math.min(1,shade))*12);return`hsl(150 7% ${lightness}%)`}

  function scene3d(v:View){
    const a=summary.brep?.displayVertices??[],raw:P3[]=[];
    for(let i=0;i+2<a.length;i+=3)raw.push(rotate3({x:a[i],y:a[i+1],z:a[i+2]}));
    if(!raw.length)return null;
    const b=bounds3(raw),p=place(b.minX,b.maxX,b.minY,b.maxY);
    const place3=(q:P3)=>({x:q.x+p.dx,y:q.y+p.dy,z:q.z-b.minZ+placement.offsetZ});
    const part=raw.map(place3);
    const edgeWorld=decodeStepEdges(summary.brep?.displayEdges).map(edge=>{
      const points:P3[]=[];
      for(let i=0;i+2<edge.points.length;i+=3)points.push(place3(rotate3({x:edge.points[i],y:edge.points[i+1],z:edge.points[i+2]})));
      return points;
    }).filter(edge=>edge.length>=2);
    const slices=showZLevels?sliceTrianglesByStep(part,Math.max(.1,zLevelStepMm)):[];
    const sliceWorld=slices.flatMap(slice=>slice.chains.map(chain=>chain.points.map(point=>({x:point.x,y:point.y,z:slice.z}))));
    const m=Math.max(stock.width,stock.height)*.12+10;
    const plane:P3[]=[{x:-m,y:-m,z:0},{x:stock.width+m,y:-m,z:0},{x:stock.width+m,y:stock.height+m,z:0},{x:-m,y:stock.height+m,z:0}];
    const box:P3[]=[{x:0,y:0,z:0},{x:stock.width,y:0,z:0},{x:stock.width,y:stock.height,z:0},{x:0,y:stock.height,z:0},{x:0,y:0,z:stock.thickness},{x:stock.width,y:0,z:stock.thickness},{x:stock.width,y:stock.height,z:stock.thickness},{x:0,y:stock.height,z:stock.thickness}];
    const wp=wcsPoint(),al=Math.max(35,Math.min(stock.width,stock.height)*.55),axes=[wp,{x:wp.x+al,y:wp.y,z:wp.z},wp,{x:wp.x,y:wp.y+al,z:wp.z},wp,{x:wp.x,y:wp.y,z:wp.z+al}];
    const pp=part.map(q=>projectPoint(q,v)),ep=edgeWorld.map(edge=>edge.map(q=>projectPoint(q,v))),sp=sliceWorld.map(chain=>chain.map(q=>projectPoint(q,v))),pl=plane.map(q=>projectPoint(q,v)),pb=box.map(q=>projectPoint(q,v)),pa=axes.map(q=>projectPoint(q,v)),pw=projectPoint(wp,v);
    const map=fit([...pp,...ep.flat(),...sp.flat(),...pl,...pb,...pa]),fpl=pl.map(map),fb=pb.map(map),fa=pa.map(map),fw=map(pw);
    const triangles=projectTriangles(part,v,map);
    const edges=ep.map(edge=>path(edge.map(map))).filter(Boolean);
    const slicePaths=sp.map(chain=>path(chain.map(map))).filter(Boolean);
    const e=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    return{triangles,edges,slicePaths,sliceCount:slices.length,chainCount:slicePaths.length,plane:path(fpl,true),stock:e.map(([i,j])=>path([fb[i],fb[j]])),axes:[path([fa[0],fa[1]]),path([fa[2],fa[3]]),path([fa[4],fa[5]])],labels:[fa[1],fa[3],fa[5]],wcs:fw};
  }

  function scene2d(){
    const curves=summary.planarGeometry?.curves??[],ss=curves.map(c=>sample(c).map(rotate2)),flat=ss.flat();if(!flat.length)return null;
    const b=bounds2(flat),noStock=stockMode==='none',p=noStock?{dx:-b.minX,dy:-b.minY}:place(b.minX,b.maxX,b.minY,b.maxY),placed=ss.map(a=>a.map(q=>({x:q.x+p.dx,y:q.y+p.dy}))),partBounds=bounds2(placed.flat());
    if(noStock){
      const margin=Math.max(partBounds.maxX-partBounds.minX,partBounds.maxY-partBounds.minY)*.12+10,plane=[{x:partBounds.minX-margin,y:partBounds.minY-margin},{x:partBounds.maxX+margin,y:partBounds.minY-margin},{x:partBounds.maxX+margin,y:partBounds.maxY+margin},{x:partBounds.minX-margin,y:partBounds.maxY+margin}],map=fit([...placed.flat(),...plane]),wx=wcs.x==='left'?partBounds.minX:wcs.x==='right'?partBounds.maxX:(partBounds.minX+partBounds.maxX)/2,wy=wcs.y==='front'?partBounds.minY:wcs.y==='back'?partBounds.maxY:(partBounds.minY+partBounds.maxY)/2,wp=map({x:wx,y:wy});
      return{paths:placed.map((a,i)=>path(a.map(map),curves[i]?.kind==='circle'||(curves[i]?.kind==='polyline'&&curves[i].closed))).filter(Boolean),plane:path(plane.map(map),true),stock:null,wcs:wp,noStock:true};
    }
    const m=Math.max(stock.width,stock.height)*.12+10,plane=[{x:-m,y:-m},{x:stock.width+m,y:-m},{x:stock.width+m,y:stock.height+m},{x:-m,y:stock.height+m}],box=[{x:0,y:0},{x:stock.width,y:0},{x:stock.width,y:stock.height},{x:0,y:stock.height}],map=fit([...placed.flat(),...plane]),wp=map({x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2});
    return{paths:placed.map((a,i)=>path(a.map(map),curves[i]?.kind==='circle'||(curves[i]?.kind==='polyline'&&curves[i].closed))).filter(Boolean),plane:path(plane.map(map),true),stock:path(box.map(map),true),wcs:wp,noStock:false};
  }

  function currentViewBox(){const w=width/zoom,h=height/zoom;return`${viewX+(width-w)/2} ${viewY+(height-h)/2} ${w} ${h}`}
  function applyViewBox(){if(viewport)viewport.setAttribute('viewBox',currentViewBox())}
  function setZoom(z:number){zoom=Math.max(.25,Math.min(6,z));queueMicrotask(applyViewBox)}
  function down(e:PointerEvent){if(summary.kind!=='step')return;dragging=true;dragMode=e.shiftKey||e.button===1||e.button===2?'pan':'orbit';lastX=e.clientX;lastY=e.clientY}
  function move(e:PointerEvent){if(!dragging||summary.kind!=='step')return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;if(dragMode==='orbit'){yaw+=dx*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.008))}else{viewX-=dx/zoom;viewY-=dy/zoom;queueMicrotask(applyViewBox)}}
  function up(){dragging=false}
  function wheel(e:WheelEvent){if(summary.kind!=='step')return;e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.002))}
  function reset(){yaw=-.72;pitch=.48;zoom=1;viewX=viewY=0;queueMicrotask(applyViewBox)}
  function updateSliceStep(e:Event){const value=Number((e.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=.1)zLevelStepMm=value}

  onMount(()=>{const e=viewport,r=root,cm=(x:MouseEvent)=>x.preventDefault();e.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);r.addEventListener('wheel',wheel,{passive:false});e.addEventListener('contextmenu',cm);applyViewBox();return()=>{e.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);r.removeEventListener('wheel',wheel);e.removeEventListener('contextmenu',cm)}});
  $:s3=scene3d({yaw,pitch});
  $:s2=scene2d();
</script>

<div class="geometry-view" bind:this={root}>
  <svg bind:this={viewport} viewBox="0 0 1000 650" class:interactive={summary.kind==='step'}>
    {#if summary.kind==='dxf'&&s2}
      <path d={s2.plane} class="setup-plane"/>
      {#if s2.stock}<path d={s2.stock} class="stock"/>{/if}
      {#each s2.paths as p}<path d={p} class="dxf"/>{/each}
      <circle cx={s2.wcs.x} cy={s2.wcs.y} r="9" class="wcs-marker"/>
      <text x={s2.wcs.x+13} y={s2.wcs.y-10} class="wcs-label">WCS · X0 Y0</text>
    {:else if s3}
      <path d={s3.plane} class="setup-plane"/>
      {#each s3.stock as p}<path d={p} class="stock"/>{/each}
      {#each s3.triangles as triangle}<path d={path(triangle.points,true)} class="step-face" style={`fill:${faceFill(triangle.shade)}`}/>{/each}
      {#each s3.edges as edge}<path d={edge} class="step-edge"/>{/each}
      {#if showZLevels}{#each s3.slicePaths as slice}<path d={slice} class="z-level"/>{/each}{/if}
      <path d={s3.axes[0]} class="axis x"/><path d={s3.axes[1]} class="axis y"/><path d={s3.axes[2]} class="axis z"/>
      <text x={s3.labels[0].x+7} y={s3.labels[0].y-5}>X</text><text x={s3.labels[1].x+7} y={s3.labels[1].y-5}>Y</text><text x={s3.labels[2].x+7} y={s3.labels[2].y-5}>Z</text>
      <circle cx={s3.wcs.x} cy={s3.wcs.y} r="10" class="wcs-marker"/><circle cx={s3.wcs.x} cy={s3.wcs.y} r="3" class="wcs-dot"/>
      <text x={s3.wcs.x+14} y={s3.wcs.y-12} class="wcs-label">WCS · X0 Y0 Z0</text>
    {/if}
  </svg>
  <div class="geometry-caption">
    <strong>{summary.kind==='step'?'BRep · Rohling · WCS':stockMode==='none'?'2D-Geometrie · ohne Rohling · WCS':'2D-Geometrie · Rohling · WCS'}</strong>
    {#if summary.kind==='step'}
      <span class="help">
        <button onclick={()=>yaw-=.3}>↺</button><button onclick={()=>yaw+=.3}>↻</button><button onclick={()=>setZoom(zoom*1.25)}>+</button><button onclick={()=>setZoom(zoom/1.25)}>−</button><button onclick={reset}>Reset</button>
        <button class:active-toggle={showZLevels} onclick={()=>showZLevels=!showZLevels}>Z-Level</button>
        {#if showZLevels}<label class="slice-step">Zustellung <input type="number" min="0.1" step="0.1" value={zLevelStepMm} oninput={updateSliceStep}/> mm</label><span>{s3?.sliceCount??0} Ebenen · {s3?.chainCount??0} Konturen</span>{/if}
        <span>Drag: drehen · Shift/Mitte: verschieben</span>
      </span>
    {/if}
  </div>
</div>

<style>
  .geometry-view{position:relative;z-index:2;width:min(92%,1100px);margin:auto;pointer-events:auto}.geometry-view>*{pointer-events:auto}
  svg{width:100%;display:block;touch-action:none;user-select:none}svg.interactive{cursor:grab}svg.interactive:active{cursor:grabbing}
  .setup-plane{fill:rgba(255,255,255,.2);stroke:rgba(70,80,75,.18);stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none}
  .stock{fill:none;stroke:rgba(93,105,99,.46);stroke-width:1.35;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}
  .dxf{fill:none;stroke:#26342e;stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
  .step-face{stroke:none;pointer-events:none}.step-edge{fill:none;stroke:rgba(42,55,49,.56);stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
  .z-level{fill:none;stroke:#c27528;stroke-width:2.1;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
  .axis{fill:none;stroke-width:2.2;vector-effect:non-scaling-stroke;pointer-events:none}.axis.x{stroke:#b1453b}.axis.y{stroke:#468058}.axis.z{stroke:#40669f}
  text{font-size:15px;font-weight:650;fill:#4c5651;pointer-events:none}.wcs-marker{fill:rgba(208,128,43,.12);stroke:#c27528;stroke-width:2.5;vector-effect:non-scaling-stroke;pointer-events:none}.wcs-dot{fill:#c27528;pointer-events:none}.wcs-label{fill:#9a5c1e;font-size:13px;font-weight:700;pointer-events:none}
  .geometry-caption{position:relative;z-index:3;display:flex;justify-content:space-between;gap:24px;padding:0 5% 12px;color:#65706b;font-size:12px;align-items:center}.geometry-caption strong{color:#34423c;font-weight:600}.help{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  .help button{position:relative;z-index:4;min-width:28px;border:1px solid rgba(52,66,60,.22);border-radius:7px;background:rgba(255,255,255,.72);padding:3px 7px;color:#34423c;cursor:pointer}.help button:hover{background:#fff}.help button.active-toggle{background:#f4eadf;border-color:rgba(194,117,40,.45);color:#8c551d}
  .slice-step{display:flex;align-items:center;gap:5px}.slice-step input{width:58px;padding:3px 5px;border:1px solid rgba(52,66,60,.22);border-radius:6px;background:rgba(255,255,255,.78);color:#34423c}
  @media(max-width:800px){.geometry-caption{align-items:flex-start;flex-direction:column;gap:8px}.help{flex-wrap:wrap}}
</style>
