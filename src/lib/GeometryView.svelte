<script lang="ts">
  import { onMount } from 'svelte';
  import type { Curve2, ImportSummary, Point2, StockDefinition } from './types';
  export let summary: ImportSummary;
  export let stock: StockDefinition;

  type P2={x:number;y:number}; type P3={x:number;y:number;z:number};
  type View={yaw:number;pitch:number;zoom:number;panX:number;panY:number};
  const width=1000,height=650,pad=54;
  let viewport:SVGSVGElement,yaw=-0.72,pitch=0.48,zoom=1,panX=0,panY=0,dragging=false,lastX=0,lastY=0;
  let dragMode:'orbit'|'pan'='orbit',inputEvents=0,lastInput='keins';

  const finite=(p:P2)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
  function fit(points:P2[]){const p=points.filter(finite);if(!p.length)return(q:P2)=>q;const xs=p.map(q=>q.x),ys=p.map(q=>q.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),sx=Math.max(maxX-minX,1e-9),sy=Math.max(maxY-minY,1e-9),scale=Math.min((width-2*pad)/sx,(height-2*pad)/sy),uw=sx*scale,uh=sy*scale,ox=(width-uw)/2,oy=(height-uh)/2;return(q:P2)=>({x:ox+(q.x-minX)*scale,y:height-(oy+(q.y-minY)*scale)});}
  function applyCamera(p:P2,v:View):P2{return{x:width/2+(p.x-width/2)*v.zoom+v.panX,y:height/2+(p.y-height/2)*v.zoom-v.panY};}
  function sample(c:Curve2):Point2[]{if(c.kind==='line')return[c.start,c.end];if(c.kind==='polyline')return c.points;if(c.kind==='circle')return Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return{x:c.center.x+Math.cos(a)*c.radius,y:c.center.y+Math.sin(a)*c.radius}});if(c.kind==='arc'){let a=c.startAngleDeg,b=c.endAngleDeg;if(!Number.isFinite(a)||!Number.isFinite(b))return[];while(b<a)b+=360;return Array.from({length:33},(_,i)=>{const r=(a+(b-a)*i/32)*Math.PI/180;return{x:c.center.x+Math.cos(r)*c.radius,y:c.center.y+Math.sin(r)*c.radius}})}return[];}
  const path=(p:P2[],closed=false)=>p.map((q,i)=>`${i?'L':'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')+(closed?' Z':'');

  function project(p:P3,v:View):P2{const cy=Math.cos(v.yaw),sy=Math.sin(v.yaw),cp=Math.cos(v.pitch),sp=Math.sin(v.pitch),x1=p.x*cy-p.y*sy,y1=p.x*sy+p.y*cy,y2=y1*cp-p.z*sp,z2=y1*sp+p.z*cp;return{x:x1,y:z2+y2*.08};}
  function scene3d(v:View){const values=summary.brep?.displayVertices??[],part:P3[]=[];for(let i=0;i+2<values.length;i+=3)part.push({x:values[i],y:values[i+1],z:values[i+2]});const m=Math.max(stock.width,stock.height)*.12+10,plane:P3[]=[{x:-m,y:-m,z:0},{x:stock.width+m,y:-m,z:0},{x:stock.width+m,y:stock.height+m,z:0},{x:-m,y:stock.height+m,z:0}],s=stock,box:P3[]=[{x:0,y:0,z:0},{x:s.width,y:0,z:0},{x:s.width,y:s.height,z:0},{x:0,y:s.height,z:0},{x:0,y:0,z:s.thickness},{x:s.width,y:0,z:s.thickness},{x:s.width,y:s.height,z:s.thickness},{x:0,y:s.height,z:s.thickness}],al=Math.max(35,Math.min(s.width,s.height)*.55),axes:P3[]=[{x:0,y:0,z:0},{x:al,y:0,z:0},{x:0,y:0,z:0},{x:0,y:al,z:0},{x:0,y:0,z:0},{x:0,y:0,z:al}];const pp=part.map(q=>project(q,v)),pl=plane.map(q=>project(q,v)),pb=box.map(q=>project(q,v)),pa=axes.map(q=>project(q,v)),map=fit([...pp,...pl,...pb,...pa]),camera=(q:P2)=>applyCamera(map(q),v),fp=pp.map(camera),fpl=pl.map(camera),fb=pb.map(camera),fa=pa.map(camera);let partPath='';for(let i=0;i+2<fp.length;i+=3)partPath+=path([fp[i],fp[i+1],fp[i+2]],true)+' ';const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];return{partPath,planePath:path(fpl,true),stockPaths:edges.map(([a,b])=>path([fb[a],fb[b]])),axes:[path([fa[0],fa[1]]),path([fa[2],fa[3]]),path([fa[4],fa[5]])],labels:[fa[1],fa[3],fa[5]]};}
  function scene2d(){const curves=summary.planarGeometry?.curves??[],samples=curves.map(sample),m=Math.max(stock.width,stock.height)*.12+10,plane=[{x:-m,y:-m},{x:stock.width+m,y:-m},{x:stock.width+m,y:stock.height+m},{x:-m,y:stock.height+m}],box=[{x:0,y:0},{x:stock.width,y:0},{x:stock.width,y:stock.height},{x:0,y:stock.height}],map=fit([...samples.flat(),...plane]),mapped=samples.map(a=>a.map(map)),fp=plane.map(map),fb=box.map(map),o=map({x:0,y:0}),al=Math.max(30,Math.min(stock.width,stock.height)*.45),xe=map({x:al,y:0}),ye=map({x:0,y:al});return{paths:mapped.map((p,i)=>path(p,curves[i]?.kind==='circle'||(curves[i]?.kind==='polyline'&&curves[i].closed))).filter(Boolean),plane:path(fp,true),stock:path(fb,true),axes:[path([o,xe]),path([o,ye])],labels:[xe,ye]};}

  const mark=(s:string)=>{inputEvents+=1;lastInput=s};
  function down(e:PointerEvent){if(summary.kind!=='step')return;mark(`pointerdown ${e.button}`);dragging=true;dragMode=e.shiftKey||e.button===1||e.button===2?'pan':'orbit';lastX=e.clientX;lastY=e.clientY;viewport.setPointerCapture(e.pointerId)}
  function move(e:PointerEvent){if(!dragging||summary.kind!=='step')return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;if(dragMode==='orbit'){yaw+=dx*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.008))}else{panX+=dx;panY-=dy}}
  function up(e:PointerEvent){dragging=false;if(summary.kind==='step')mark('pointerup');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId)}
  function wheel(e:WheelEvent){if(summary.kind!=='step')return;e.preventDefault();mark('wheel');zoom=Math.max(.35,Math.min(4,zoom*Math.exp(-e.deltaY*.0012)))}
  function reset(){yaw=-.72;pitch=.48;zoom=1;panX=panY=0;mark('reset')}
  onMount(()=>{const e=viewport,cm=(x:MouseEvent)=>{if(summary.kind==='step'){x.preventDefault();mark('contextmenu')}};e.addEventListener('pointerdown',down);e.addEventListener('pointermove',move);e.addEventListener('pointerup',up);e.addEventListener('pointercancel',up);e.addEventListener('wheel',wheel,{passive:false});e.addEventListener('contextmenu',cm);return()=>{e.removeEventListener('pointerdown',down);e.removeEventListener('pointermove',move);e.removeEventListener('pointerup',up);e.removeEventListener('pointercancel',up);e.removeEventListener('wheel',wheel);e.removeEventListener('contextmenu',cm)}});
  $: s3=scene3d({yaw,pitch,zoom,panX,panY}); $: s2=scene2d();
</script>

<div class="geometry-view">
  <svg bind:this={viewport} viewBox={`0 0 ${width} ${height}`} class:interactive={summary.kind==='step'}>
    {#if summary.kind==='dxf'}
      <path d={s2.plane} class="setup-plane"/><path d={s2.stock} class="stock"/>
      <path d={s2.axes[0]} class="axis x"/><path d={s2.axes[1]} class="axis y"/>
      <text x={s2.labels[0].x+7} y={s2.labels[0].y-5}>X</text><text x={s2.labels[1].x+7} y={s2.labels[1].y-5}>Y</text>
      {#each s2.paths as p}<path d={p} class="dxf"/>{/each}
    {:else if s3.partPath}
      <path d={s3.planePath} class="setup-plane"/>{#each s3.stockPaths as p}<path d={p} class="stock"/>{/each}
      <path d={s3.axes[0]} class="axis x"/><path d={s3.axes[1]} class="axis y"/><path d={s3.axes[2]} class="axis z"/>
      <text x={s3.labels[0].x+7} y={s3.labels[0].y-5}>X</text><text x={s3.labels[1].x+7} y={s3.labels[1].y-5}>Y</text><text x={s3.labels[2].x+7} y={s3.labels[2].y-5}>Z</text>
      <path d={s3.partPath} class="step"/>
    {/if}
  </svg>
  <div class="geometry-caption"><strong>{summary.kind==='step'?'BRep · Rohling · Aufspannebene':'2D-Geometrie · Rohling · Aufspannebene'}</strong>{#if summary.kind==='step'}<span class="help"><button onclick={()=>{yaw-=.3;mark('button orbit')}}>↺</button><button onclick={()=>{yaw+=.3;mark('button orbit')}}>↻</button><button onclick={()=>{zoom=Math.min(4,zoom*1.2);mark('button zoom')}}>+</button><button onclick={()=>{zoom=Math.max(.35,zoom/1.2);mark('button zoom')}}>−</button><button onclick={reset}>Reset</button><span>Input {inputEvents} · {lastInput}</span></span>{:else}<span>{summary.planarGeometry?.curves.length??0} Konturelemente</span>{/if}</div>
</div>

<style>
.geometry-view{width:min(92%,1100px);margin:auto}svg{width:100%;display:block;touch-action:none;user-select:none}svg.interactive{cursor:grab}svg.interactive:active{cursor:grabbing}.setup-plane{fill:rgba(255,255,255,.2);stroke:rgba(70,80,75,.18);stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none}.stock{fill:none;stroke:rgba(93,105,99,.55);stroke-width:1.5;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}.dxf{fill:none;stroke:#26342e;stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.step{fill:rgba(72,94,84,.16);stroke:rgba(38,52,46,.42);stroke-width:.7;vector-effect:non-scaling-stroke;pointer-events:none}.axis{fill:none;stroke-width:2.2;vector-effect:non-scaling-stroke;pointer-events:none}.axis.x{stroke:#b1453b}.axis.y{stroke:#468058}.axis.z{stroke:#40669f}text{font-size:15px;font-weight:650;fill:#4c5651;pointer-events:none}.geometry-caption{display:flex;justify-content:space-between;gap:24px;padding:0 5% 12px;color:#65706b;font-size:12px;align-items:center}.geometry-caption strong{color:#34423c;font-weight:600}.help{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.help button{min-width:28px;border:1px solid rgba(52,66,60,.22);border-radius:7px;background:rgba(255,255,255,.55);padding:3px 7px;color:#34423c;cursor:pointer;font:inherit}
</style>
