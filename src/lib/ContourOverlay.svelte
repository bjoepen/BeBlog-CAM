<script lang="ts">
  import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, CamOperation, Curve2, OpenContourSide } from './types';
  import { buildClosedChains, buildSemanticContours, offsetPolygon, sampleCurve, type P2 } from './contourMath';
  import { buildOpenChains, offsetOpenChain } from './openContour';
  import { buildBrokenContourPath } from './brokenContour';
  import { buildBrokenSemanticContour, sampleSemanticRun, sampleSemanticSegment } from './brokenSemanticContour';
  import { buildPocketCanonicalToolpath, samplePocketSpatialSegment } from './pocketCanonicalToolpath';

  export let summary: ImportSummary;
  export let stock: StockDefinition;
  export let stockMode: StockMode;
  export let placement: PartPlacement;
  export let orientation: PartOrientation;
  export let operation: CamOperation;
  export let onSelectContour: (id: number, topology?: 'closed'|'open') => void = () => {};
  export let onSelectCarveCurve: (id: number) => void = () => {};
  export let onSelectDrillCurve: (id: number) => void = () => {};

  const width=1000,height=650,pad=54;
  const previewWcs={x:'left',y:'front',z:'top'} as const;
  const rotate=(p:P2):P2=>{const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
  const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
  const path=(pts:P2[],closed=false)=>pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+(closed?' Z':'');
  const eligibleCarve=(curve:Curve2)=>curve.kind==='line'||curve.kind==='arc'||(curve.kind==='polyline'&&!curve.closed);

  function fit(points:P2[]){
    const b=bounds(points),sx=Math.max(b.maxX-b.minX,1e-9),sy=Math.max(b.maxY-b.minY,1e-9),scale=Math.min((width-2*pad)/sx,(height-2*pad)/sy),ox=(width-sx*scale)/2,oy=(height-sy*scale)/2;
    return(p:P2)=>({x:ox+(p.x-b.minX)*scale,y:height-(oy+(p.y-b.minY)*scale)});
  }

  function contourDepths(){
    if(operation.kind!=='contour'||operation.totalDepthMm<=0||operation.stepDownMm<=0)return[];
    const passes=Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm));
    return Array.from({length:passes},(_,index)=>-Math.min(operation.totalDepthMm,(index+1)*operation.stepDownMm));
  }

  function chooseClosed(id:number){
    if(operation.kind==='contour'){operation.topology='closed';operation.excludedSegmentIds=[];}
    onSelectContour(id,'closed');
  }
  function chooseOpen(id:number,side:OpenContourSide){
    if(operation.kind==='contour'){operation.topology='open';operation.openSide=side;operation.excludedSegmentIds=[];}
    onSelectContour(id,'open');
  }
  function toggleClosedSegment(id:number){
    if(operation.kind!=='contour'||operation.topology!=='closed'||operation.contourId===null)return;
    const set=new Set(operation.excludedSegmentIds??[]);set.has(id)?set.delete(id):set.add(id);operation.excludedSegmentIds=[...set].sort((a,b)=>a-b);onSelectContour(operation.contourId,'closed');
  }

  function buildScene(..._deps: unknown[]){
    if(operation.kind==='facing')return null;
    const curves=summary.planarGeometry?.curves??[];if(summary.kind!=='dxf'||!curves.length)return null;
    const rotatedCurves=curves.map((curve,id)=>({id,curve,points:sampleCurve(curve).map(rotate)}));
    const all=rotatedCurves.flatMap(c=>c.points);if(!all.length)return null;const partB=bounds(all);
    const dx=stockMode==='none'?-partB.minX:placement.horizontal==='left'?-partB.minX+placement.offsetX:placement.horizontal==='right'?stock.width-(partB.maxX-partB.minX)-partB.minX+placement.offsetX:(stock.width-(partB.maxX-partB.minX))/2-partB.minX+placement.offsetX;
    const dy=stockMode==='none'?-partB.minY:placement.vertical==='front'?-partB.minY+placement.offsetY:placement.vertical==='back'?stock.height-(partB.maxY-partB.minY)-partB.minY+placement.offsetY:(stock.height-(partB.maxY-partB.minY))/2-partB.minY+placement.offsetY;
    const move=(p:P2)=>({x:p.x+dx,y:p.y+dy});
    const transform=(p:P2)=>move(rotate(p));
    const movedCurves=rotatedCurves.map(c=>({...c,points:c.points.map(move)}));
    const cs=buildClosedChains(curves,rotate).map(c=>({...c,points:c.points.map(move)}));
    const semanticCs=buildSemanticContours(curves,transform);
    const os=buildOpenChains(curves,rotate).map(c=>({...c,points:c.points.map(move)}));
    let plane:P2[];
    if(stockMode==='none'){
      const moved=all.map(move),b=bounds(moved),m=Math.max(b.maxX-b.minX,b.maxY-b.minY)*.12+10;plane=[{x:b.minX-m,y:b.minY-m},{x:b.maxX+m,y:b.minY-m},{x:b.maxX+m,y:b.maxY+m},{x:b.minX-m,y:b.maxY+m}];
    }else{const m=Math.max(stock.width,stock.height)*.12+10;plane=[{x:-m,y:-m},{x:stock.width+m,y:-m},{x:stock.width+m,y:stock.height+m},{x:-m,y:stock.height+m}]}
    const map=fit([...movedCurves.flatMap(c=>c.points),...plane]);

    if(operation.kind==='carve'){
      const selected=new Set(operation.curveIds),radius=operation.tool.diameterMm/2;
      const carve=movedCurves.filter(c=>eligibleCarve(c.curve)).map(c=>{
        const isSelected=selected.has(c.id);
        const tool=isSelected?offsetOpenChain(c.points,radius,operation.side,.003).points.map(map):null;
        return{id:c.id,screen:c.points.map(map),selected:isSelected,tool};
      });
      return{kind:'carve' as const,carve,side:operation.side};
    }

    if(operation.kind==='drill'){
      const selected=new Set(operation.curveIds);
      const drill=movedCurves.filter(c=>c.curve.kind==='circle').map(c=>{
        const circle=c.curve as Extract<Curve2,{kind:'circle'}>;const center=map(move(rotate(circle.center)));const edge=map(move(rotate({x:circle.center.x+circle.radius,y:circle.center.y})));const r=Math.max(5,Math.hypot(edge.x-center.x,edge.y-center.y));
        return{id:c.id,center,r,selected:selected.has(c.id),diameter:circle.radius*2};
      });
      return{kind:'drill' as const,drill};
    }

    if(operation.kind==='pocket'){
      const selected=operation.contourId==null?null:cs.find(c=>c.id===operation.contourId)??null;
      const canonical=buildPocketCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs:previewWcs,operation});
      const toolRuns=(canonical?.runs??[]).map(run=>({z:run.z,points:run.points.map(map)}));
      const entryRuns=(canonical?.runs??[]).flatMap(run=>(run.entrySegments??[]).flatMap(segment=>{
        const sampled=samplePocketSpatialSegment(segment);
        return sampled.slice(1).map((point,index)=>({z:point.z,points:[map({x:sampled[index].x,y:sampled[index].y}),map({x:point.x,y:point.y})]}));
      }));
      return{kind:'pocket' as const,chains:cs.map(c=>({...c,screen:c.points.map(map)})),selected:selected?selected.points.map(map):null,toolRuns,entryRuns,spatialEntry:entryRuns.length>0,entryKind:operation.entry};
    }

    const selectedClosed=operation.topology==='closed'&&operation.contourId!=null?cs.find(c=>c.id===operation.contourId)??null:null;
    const selectedSemantic=operation.topology==='closed'&&operation.contourId!=null?semanticCs.find(c=>c.id===operation.contourId&&c.supported)??null:null;
    const selectedOpen=operation.topology==='open'&&operation.contourId!=null?os.find(c=>c.id===operation.contourId)??null:null;
    const excluded=new Set(operation.excludedSegmentIds??[]),radius=operation.tool.diameterMm/2;
    let toolRuns:{points:P2[];closed:boolean}[]=[];
    let selectedSegments:{id:number;screen:P2[];excluded:boolean;native:boolean;kind:'line'|'arc'}[]=[];
    if(selectedClosed){
      if(selectedSemantic?.segments.length){
        selectedSegments=selectedSemantic.segments.map((segment,id)=>({id,screen:sampleSemanticSegment(segment,32).map(map),excluded:excluded.has(id),native:true,kind:segment.kind}));
        if(excluded.size){
          const broken=buildBrokenSemanticContour(selectedSemantic,[...excluded],radius,operation.side,.003);
          if(broken)toolRuns=broken.runs.map(run=>({points:sampleSemanticRun(run,32).map(map),closed:false}));
        }else{
          const d=operation.side==='outside'?radius:operation.side==='inside'?-radius:0;toolRuns=[{points:offsetPolygon(selectedClosed.points,d).map(map),closed:true}];
        }
      }else{
        const base=selectedClosed.points.slice(0,-1);
        selectedSegments=base.map((p,i)=>({id:i,screen:[p,base[(i+1)%base.length]].map(map),excluded:excluded.has(i),native:false,kind:'line'}));
        if(excluded.size){const broken=buildBrokenContourPath(selectedClosed.points,[...excluded],radius,operation.side,.003);toolRuns=broken.runs.map(points=>({points:points.map(map),closed:false}));}
        else{const d=operation.side==='outside'?radius:operation.side==='inside'?-radius:0;toolRuns=[{points:offsetPolygon(selectedClosed.points,d).map(map),closed:true}];}
      }
    }
    if(selectedOpen){toolRuns=[{points:offsetOpenChain(selectedOpen.points,radius,operation.openSide,.003).points.map(map),closed:false}];}
    const open=os.map(c=>({...c,screen:c.points.map(map),left:offsetOpenChain(c.points,radius,'left',.003).points.map(map),right:offsetOpenChain(c.points,radius,'right',.003).points.map(map)}));
    return{kind:'contour' as const,closed:cs.map(c=>({...c,screen:c.points.map(map)})),open,selected:selectedClosed?{screen:selectedClosed.points.map(map),closed:true}:selectedOpen?{screen:selectedOpen.points.map(map),closed:false}:null,selectedSegments,toolRuns,broken:excluded.size>0,nativeBreakSelection:!!selectedSemantic?.segments.length};
  }

  $: scene=buildScene(
    summary.fileName,
    operation.kind,
    operation.kind==='facing'?'facing':(operation.kind==='carve'||operation.kind==='drill')?operation.curveIds.join(','):operation.contourId,
    operation.kind==='contour'?operation.topology:operation.kind,
    operation.kind==='contour'?operation.openSide:operation.kind,
    operation.kind==='contour'?(operation.excludedSegmentIds??[]).join(','):operation.kind,
    operation.kind==='carve'?operation.side:operation.kind,
    (operation.kind==='carve'||operation.kind==='drill')?operation.selectionMode:operation.kind,
    (operation.kind==='carve'||operation.kind==='drill')?operation.layerName:operation.kind,
    operation.tool.diameterMm,
    operation.kind==='contour'?operation.side:operation.kind,
    (operation.kind==='contour'||operation.kind==='pocket')?operation.totalDepthMm:operation.kind,
    (operation.kind==='contour'||operation.kind==='pocket')?operation.stepDownMm:operation.kind,
    operation.kind==='pocket'?operation.stepoverPercent:operation.kind,
    operation.kind==='pocket'?operation.strategy:operation.kind,
    operation.kind==='pocket'?operation.entry:operation.kind,
    operation.kind==='pocket'?operation.rampAngleDeg:operation.kind,
    stockMode,stock.width,stock.height,
    placement.horizontal,placement.vertical,placement.offsetX,placement.offsetY,
    orientation.rotationZDeg
  );
</script>

{#if scene}
<div class="contour-overlay" aria-label="Geometrieauswahl und Werkzeugweg" data-stock-width={stockMode==='none'?undefined:stock.width}>
  <svg viewBox="0 0 1000 650">
    {#if scene.kind==='carve'}
      {#each scene.carve as curve}
        <path d={path(curve.screen,false)} class:selected-carve={curve.selected} class="carve-candidate" />
        {#if curve.tool}<path d={path(curve.tool,false)} class="toolpath" />{/if}
        <path d={path(curve.screen,false)} class="carve-pick" onclick={()=>onSelectCarveCurve(curve.id)}><title>{curve.selected?'Aus Carve-Auswahl entfernen':'Zur Carve-Auswahl hinzufügen'}</title></path>
      {/each}
    {:else if scene.kind==='drill'}
      {#each scene.drill as hole}
        <circle cx={hole.center.x} cy={hole.center.y} r={hole.r} class:selected-drill={hole.selected} class="drill-candidate" />
        <line x1={hole.center.x-7} y1={hole.center.y} x2={hole.center.x+7} y2={hole.center.y} class:selected-drill={hole.selected} class="drill-center" />
        <line x1={hole.center.x} y1={hole.center.y-7} x2={hole.center.x} y2={hole.center.y+7} class:selected-drill={hole.selected} class="drill-center" />
        <circle cx={hole.center.x} cy={hole.center.y} r={Math.max(12,hole.r)} class="drill-pick" onclick={()=>onSelectDrillCurve(hole.id)}><title>{hole.selected?'Bohrung aus Auswahl entfernen':`Bohrung Ø ${hole.diameter.toFixed(3)} mm auswählen`}</title></circle>
      {/each}
    {:else if scene.kind==='pocket'}
      {#each scene.chains as chain}
        <path d={path(chain.screen,true)} class="candidate" />
        <path d={path(chain.screen,true)} class="pick" onclick={()=>onSelectContour(chain.id,'closed')}><title>Geschlossene Taschenkontur {chain.id+1} auswählen</title></path>
      {/each}
      {#if scene.selected}<path d={path(scene.selected,true)} class="selected"/>{/if}
      {#each scene.entryRuns as entry}<path d={path(entry.points,false)} class="toolpath pocket-entry-toolpath toolpath-preview" data-toolpath-z={entry.z} data-toolpath-spatial="entry"/>{/each}
      {#each scene.toolRuns as tool}<path d={path(tool.points,false)} class="toolpath pocket-toolpath toolpath-preview" data-toolpath-z={tool.z}/>{/each}
    {:else}
      {#each scene.closed as chain}
        <path d={path(chain.screen,true)} class="candidate" />
        <path d={path(chain.screen,true)} class="pick" onclick={()=>chooseClosed(chain.id)}><title>Geschlossene Kontur {chain.id+1} auswählen</title></path>
      {/each}
      {#each scene.open as chain}
        <path d={path(chain.screen,false)} class="open-candidate" />
        <path d={path(chain.left,false)} class="open-side-preview" />
        <path d={path(chain.right,false)} class="open-side-preview" />
        <path d={path(chain.left,false)} class="open-side-pick" onclick={()=>chooseOpen(chain.id,'left')}><title>Offene DXF-Kontur {chain.id+1} · Werkzeug links</title></path>
        <path d={path(chain.right,false)} class="open-side-pick" onclick={()=>chooseOpen(chain.id,'right')}><title>Offene DXF-Kontur {chain.id+1} · Werkzeug rechts</title></path>
        <path d={path(chain.screen,false)} class="open-center-pick" onclick={()=>chooseOpen(chain.id,'on-line')}><title>Offene DXF-Kontur {chain.id+1} · Werkzeug auf Linie</title></path>
      {/each}
      {#if scene.selected}<path d={path(scene.selected.screen,scene.selected.closed)} class="selected"/>{/if}
      {#each scene.selectedSegments as segment}
        <path d={path(segment.screen,false)} class:segment-off={segment.excluded} class="segment-state" />
        <path d={path(segment.screen,false)} class="segment-pick" onclick={()=>toggleClosedSegment(segment.id)}><title>{segment.excluded?'Konturstrecke wieder einschalten':`${segment.native?(segment.kind==='arc'?'Nativen Bogen':'Native Linie'):'Konturstrecke'} hier abwählen`}</title></path>
      {/each}
      {#each contourDepths() as z}
        {#each scene.toolRuns as tool}<path d={path(tool.points,tool.closed)} class="toolpath contour-toolpath toolpath-preview" data-toolpath-z={z}/>{/each}
      {/each}
    {/if}
  </svg>
  {#if scene.kind==='contour'}<div class="open-help">{scene.broken?(scene.nativeBreakSelection?'Kontur aufgebrochen: native Linie/Bogen bleibt als CAD-Segment erhalten und wird nicht gefräst. Erneut anklicken zum Einschalten.':'Kontur aufgebrochen: ausgegraute Strecke wird nicht gefräst. Erneut anklicken zum Einschalten.'):'Kontur wählen, dann direkt eine Strecke anklicken, um sie aus der Bearbeitung herauszunehmen.'}</div>{:else if scene.kind==='pocket'&&scene.spatialEntry}<div class="open-help">Räumlicher {scene.entryKind==='helix'?'Helix-':'Rampen-'}Einstieg ist Bestandteil der kanonischen Werkzeugbahn und in 2.5D kontrollierbar.</div>{:else if scene.kind==='carve'}<div class="open-help">Carve-Werkzeugweg: {scene.side==='left'?'links':scene.side==='right'?'rechts':'auf Linie'} der ausgewählten DXF-Geometrie.</div>{/if}
</div>
{/if}

<style>
  .contour-overlay{position:absolute;left:50%;top:50%;z-index:3;width:min(92%,1100px);transform:translate(-50%,-50%);pointer-events:auto}
  svg{width:100%;display:block;overflow:visible;pointer-events:auto}
  .candidate{fill:none;stroke:rgba(194,117,40,.10);stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none}
  .open-candidate{fill:none;stroke:rgba(76,111,139,.28);stroke-width:1.7;stroke-dasharray:4 3;vector-effect:non-scaling-stroke;pointer-events:none}
  .open-side-preview{fill:none;stroke:rgba(177,69,59,.18);stroke-width:1.4;vector-effect:non-scaling-stroke;pointer-events:none}
  .pick,.open-side-pick,.open-center-pick,.segment-pick{fill:none;stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
  .open-center-pick{stroke-width:8}
  .selected{fill:none;stroke:rgba(194,117,40,.88);stroke-width:2;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}
  .segment-state{fill:none;stroke:rgba(194,117,40,.78);stroke-width:2.3;vector-effect:non-scaling-stroke;pointer-events:none}.segment-state.segment-off{stroke:rgba(105,112,108,.5);stroke-width:2.8;stroke-dasharray:3 4}
  .toolpath{fill:none;stroke:#b1453b;stroke-width:2.5;vector-effect:non-scaling-stroke;pointer-events:none}
  .contour-toolpath,.pocket-toolpath,.pocket-entry-toolpath{stroke:#327b8d;stroke-width:2.1}
  .pocket-entry-toolpath{stroke-dasharray:3 2;stroke-width:1.9}
  .open-help{position:absolute;left:50%;top:calc(100% + 42px);transform:translateX(-50%);width:max-content;max-width:86%;padding:6px 9px;border-radius:6px;background:rgba(250,250,248,.94);color:#666b66;font-size:.72rem;pointer-events:none;white-space:normal;text-align:center}
  .carve-candidate{fill:none;stroke:rgba(194,117,40,.18);stroke-width:1.4;vector-effect:non-scaling-stroke;pointer-events:none}.carve-candidate.selected-carve{stroke:rgba(38,52,46,.55);stroke-width:1.8;stroke-dasharray:4 3}.carve-pick{fill:none;stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
  .drill-candidate{fill:none;stroke:rgba(194,117,40,.25);stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none}.drill-candidate.selected-drill{stroke:#b1453b;stroke-width:2.4}.drill-center{stroke:rgba(194,117,40,.55);stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none}.drill-center.selected-drill{stroke:#b1453b;stroke-width:1.8}.drill-pick{fill:transparent;stroke:transparent;stroke-width:12;vector-effect:non-scaling-stroke;pointer-events:all;cursor:pointer}
</style>