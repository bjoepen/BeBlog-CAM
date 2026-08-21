<script lang="ts">
  import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, CamOperation, Curve2 } from './types';
  import { buildClosedChains, offsetPolygon, sampleCurve, type P2 } from './contourMath';

  export let summary: ImportSummary;
  export let stock: StockDefinition;
  export let stockMode: StockMode;
  export let placement: PartPlacement;
  export let orientation: PartOrientation;
  export let operation: CamOperation;
  export let onSelectContour: (id: number) => void = () => {};
  export let onSelectCarveCurve: (id: number) => void = () => {};
  export let onSelectDrillCurve: (id: number) => void = () => {};

  const width=1000,height=650,pad=54;
  const rotate=(p:P2):P2=>{const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
  const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
  const path=(pts:P2[],closed=false)=>pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+(closed?' Z':'');
  const eligibleCarve=(curve:Curve2)=>curve.kind==='line'||curve.kind==='arc'||(curve.kind==='polyline'&&!curve.closed);

  function fit(points:P2[]){
    const b=bounds(points),sx=Math.max(b.maxX-b.minX,1e-9),sy=Math.max(b.maxY-b.minY,1e-9),scale=Math.min((width-2*pad)/sx,(height-2*pad)/sy),ox=(width-sx*scale)/2,oy=(height-sy*scale)/2;
    return(p:P2)=>({x:ox+(p.x-b.minX)*scale,y:height-(oy+(p.y-b.minY)*scale)});
  }

  function buildScene(..._deps: unknown[]){
    const curves=summary.planarGeometry?.curves??[];if(summary.kind!=='dxf'||!curves.length)return null;
    const rotatedCurves=curves.map((curve,id)=>({id,curve,points:sampleCurve(curve).map(rotate)}));
    const all=rotatedCurves.flatMap(c=>c.points);if(!all.length)return null;const partB=bounds(all);
    const dx=stockMode==='none'?-partB.minX:placement.horizontal==='left'?-partB.minX+placement.offsetX:placement.horizontal==='right'?stock.width-(partB.maxX-partB.minX)-partB.minX+placement.offsetX:(stock.width-(partB.maxX-partB.minX))/2-partB.minX+placement.offsetX;
    const dy=stockMode==='none'?-partB.minY:placement.vertical==='front'?-partB.minY+placement.offsetY:placement.vertical==='back'?stock.height-(partB.maxY-partB.minY)-partB.minY+placement.offsetY:(stock.height-(partB.maxY-partB.minY))/2-partB.minY+placement.offsetY;
    const move=(p:P2)=>({x:p.x+dx,y:p.y+dy});
    const movedCurves=rotatedCurves.map(c=>({...c,points:c.points.map(move)}));
    const cs=buildClosedChains(curves,rotate).map(c=>({...c,points:c.points.map(move)}));
    let plane:P2[];
    if(stockMode==='none'){
      const moved=all.map(move),b=bounds(moved),m=Math.max(b.maxX-b.minX,b.maxY-b.minY)*.12+10;plane=[{x:b.minX-m,y:b.minY-m},{x:b.maxX+m,y:b.minY-m},{x:b.maxX+m,y:b.maxY+m},{x:b.minX-m,y:b.maxY+m}];
    }else{const m=Math.max(stock.width,stock.height)*.12+10;plane=[{x:-m,y:-m},{x:stock.width+m,y:-m},{x:stock.width+m,y:stock.height+m},{x:-m,y:stock.height+m}]}
    const map=fit([...movedCurves.flatMap(c=>c.points),...plane]);

    if(operation.kind==='carve'){
      const selected=new Set(operation.curveIds);
      const carve=movedCurves.filter(c=>eligibleCarve(c.curve)).map(c=>({id:c.id,screen:c.points.map(map),selected:selected.has(c.id)}));
      return{kind:'carve' as const,carve};
    }

    if(operation.kind==='drill'){
      const selected=new Set(operation.curveIds);
      const drill=movedCurves.filter(c=>c.curve.kind==='circle').map(c=>{
        const circle=c.curve as Extract<Curve2,{kind:'circle'}>;const center=map(move(rotate(circle.center)));const edge=map(move(rotate({x:circle.center.x+circle.radius,y:circle.center.y})));const r=Math.max(5,Math.hypot(edge.x-center.x,edge.y-center.y));
        return{id:c.id,center,r,selected:selected.has(c.id),diameter:circle.radius*2};
      });
      return{kind:'drill' as const,drill};
    }

    const selected=operation.contourId==null?null:cs.find(c=>c.id===operation.contourId)??null;
    let tool:P2[]|null=null;
    if(selected){
      const r=operation.tool.diameterMm/2;
      const d=operation.kind==='pocket'?-r:operation.side==='outside'?r:operation.side==='inside'?-r:0;
      tool=offsetPolygon(selected.points,d);
    }
    return{kind:'closed' as const,chains:cs.map(c=>({...c,screen:c.points.map(map)})),selected:selected?selected.points.map(map):null,tool:tool?tool.map(map):null};
  }

  $: scene=buildScene(
    operation.kind,
    (operation.kind==='carve'||operation.kind==='drill')?operation.curveIds.join(','):operation.contourId,
    (operation.kind==='carve'||operation.kind==='drill')?operation.selectionMode:operation.kind,
    (operation.kind==='carve'||operation.kind==='drill')?operation.layerName:operation.kind,
    operation.tool.diameterMm,
    operation.kind==='contour'?operation.side:operation.kind,
    stockMode,stock.width,stock.height,
    placement.horizontal,placement.vertical,placement.offsetX,placement.offsetY,
    orientation.rotationZDeg
  );
</script>

{#if scene}
<div class="contour-overlay" aria-label="Geometrieauswahl und Werkzeugweg">
  <svg viewBox="0 0 1000 650">
    {#if scene.kind==='carve'}
      {#each scene.carve as curve}
        <path d={path(curve.screen,false)} class:selected-carve={curve.selected} class="carve-candidate" />
        <path d={path(curve.screen,false)} class="carve-pick" onclick={()=>onSelectCarveCurve(curve.id)}><title>{curve.selected?'Aus Carve-Auswahl entfernen':'Zur Carve-Auswahl hinzufügen'}</title></path>
      {/each}
    {:else if scene.kind==='drill'}
      {#each scene.drill as hole}
        <circle cx={hole.center.x} cy={hole.center.y} r={hole.r} class:selected-drill={hole.selected} class="drill-candidate" />
        <line x1={hole.center.x-7} y1={hole.center.y} x2={hole.center.x+7} y2={hole.center.y} class:selected-drill={hole.selected} class="drill-center" />
        <line x1={hole.center.x} y1={hole.center.y-7} x2={hole.center.x} y2={hole.center.y+7} class:selected-drill={hole.selected} class="drill-center" />
        <circle cx={hole.center.x} cy={hole.center.y} r={Math.max(12,hole.r)} class="drill-pick" onclick={()=>onSelectDrillCurve(hole.id)}><title>{hole.selected?'Bohrung aus Auswahl entfernen':`Bohrung Ø ${hole.diameter.toFixed(3)} mm auswählen`}</title></circle>
      {/each}
    {:else}
      {#each scene.chains as chain}
        <path d={path(chain.screen,true)} class="candidate" />
        <path d={path(chain.screen,true)} class="pick" onclick={()=>onSelectContour(chain.id)}><title>Kontur {chain.id+1} auswählen</title></path>
      {/each}
      {#if scene.selected}<path d={path(scene.selected,true)} class="selected"/>{/if}
      {#if scene.tool}<path d={path(scene.tool,true)} class="toolpath"/>{/if}
    {/if}
  </svg>
  <div class="caption-spacer"></div>
</div>
{/if}

<style>
  .contour-overlay{position:absolute;left:50%;top:50%;z-index:3;width:min(92%,1100px);transform:translate(-50%,-50%);pointer-events:auto}
  svg{width:100%;display:block;overflow:visible;pointer-events:auto}
  .caption-spacer{height:30px;pointer-events:none}
  .candidate{fill:none;stroke:rgba(194,117,40,.10);stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none}
  .pick{fill:none;stroke:transparent;stroke-width:18;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
  .selected{fill:none;stroke:rgba(194,117,40,.9);stroke-width:2.2;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}
  .toolpath{fill:none;stroke:#b1453b;stroke-width:2.5;vector-effect:non-scaling-stroke;pointer-events:none}
  .carve-candidate{fill:none;stroke:rgba(194,117,40,.18);stroke-width:1.4;vector-effect:non-scaling-stroke;pointer-events:none}
  .carve-candidate.selected-carve{stroke:#b1453b;stroke-width:2.2}
  .carve-pick{fill:none;stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
  .drill-candidate{fill:none;stroke:rgba(194,117,40,.25);stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none}.drill-candidate.selected-drill{stroke:#b1453b;stroke-width:2.4}
  .drill-center{stroke:rgba(194,117,40,.55);stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none}.drill-center.selected-drill{stroke:#b1453b;stroke-width:1.8}
  .drill-pick{fill:transparent;stroke:transparent;stroke-width:12;vector-effect:non-scaling-stroke;pointer-events:all;cursor:pointer}
</style>
