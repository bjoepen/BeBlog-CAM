<script lang="ts">
  import type { Curve2, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, ContourOperation, Point2 } from './types';

  export let summary: ImportSummary;
  export let stock: StockDefinition;
  export let stockMode: StockMode;
  export let placement: PartPlacement;
  export let orientation: PartOrientation;
  export let operation: ContourOperation;
  export let onSelectContour: (id: number) => void = () => {};

  type P2 = { x:number; y:number };
  type Chain = { id:number; points:P2[]; closed:boolean };
  const width=1000,height=650,pad=54,tolerance=.08;

  const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
  const same=(a:P2,b:P2)=>dist(a,b)<=tolerance;
  const rotate=(p:P2):P2=>{const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
  const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
  const path=(pts:P2[],closed=false)=>pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+(closed?' Z':'');

  function sample(c:Curve2):Point2[]{
    if(c.kind==='line')return[c.start,c.end];
    if(c.kind==='polyline')return c.points;
    if(c.kind==='circle')return Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return{x:c.center.x+Math.cos(a)*c.radius,y:c.center.y+Math.sin(a)*c.radius}});
    if(c.kind==='arc'){let a=c.startAngleDeg,b=c.endAngleDeg;while(b<a)b+=360;return Array.from({length:49},(_,i)=>{const r=(a+(b-a)*i/48)*Math.PI/180;return{x:c.center.x+Math.cos(r)*c.radius,y:c.center.y+Math.sin(r)*c.radius}})}
    return[];
  }

  function chains(curves:Curve2[]):Chain[]{
    const closed:Chain[]=[]; const open:P2[][]=[];
    for(const c of curves){
      let pts=sample(c).map(rotate); if(pts.length<2)continue;
      if(c.kind==='circle'||(c.kind==='polyline'&&c.closed)){
        if(!same(pts[0],pts[pts.length-1]))pts=[...pts,pts[0]];
        closed.push({id:closed.length,points:pts,closed:true});
      }else open.push(pts);
    }
    const used=new Set<number>();
    for(let seed=0;seed<open.length;seed++){
      if(used.has(seed))continue; used.add(seed); let pts=[...open[seed]]; let progress=true;
      while(progress){progress=false;
        for(let i=0;i<open.length;i++){
          if(used.has(i))continue; const s=open[i],a=pts[0],b=pts[pts.length-1],s0=s[0],s1=s[s.length-1];
          if(same(b,s0)){pts=[...pts,...s.slice(1)];used.add(i);progress=true;break}
          if(same(b,s1)){pts=[...pts,...[...s].reverse().slice(1)];used.add(i);progress=true;break}
          if(same(a,s1)){pts=[...s.slice(0,-1),...pts];used.add(i);progress=true;break}
          if(same(a,s0)){pts=[...[...s].reverse().slice(0,-1),...pts];used.add(i);progress=true;break}
        }
      }
      const isClosed=pts.length>2&&same(pts[0],pts[pts.length-1]);
      if(isClosed){pts[pts.length-1]=pts[0];closed.push({id:closed.length,points:pts,closed:true})}
    }
    return closed;
  }

  function fit(points:P2[]){
    const b=bounds(points),sx=Math.max(b.maxX-b.minX,1e-9),sy=Math.max(b.maxY-b.minY,1e-9),scale=Math.min((width-2*pad)/sx,(height-2*pad)/sy),ox=(width-sx*scale)/2,oy=(height-sy*scale)/2;
    return(p:P2)=>({x:ox+(p.x-b.minX)*scale,y:height-(oy+(p.y-b.minY)*scale)});
  }

  function lineIntersection(a:P2,ad:P2,b:P2,bd:P2):P2|null{
    const cross=ad.x*bd.y-ad.y*bd.x;if(Math.abs(cross)<1e-8)return null;
    const q={x:b.x-a.x,y:b.y-a.y},t=(q.x*bd.y-q.y*bd.x)/cross;return{x:a.x+ad.x*t,y:a.y+ad.y*t};
  }

  function offsetPolygon(input:P2[],distance:number):P2[]{
    if(Math.abs(distance)<1e-9)return input;
    let pts=[...input];if(same(pts[0],pts[pts.length-1]))pts=pts.slice(0,-1);if(pts.length<3)return input;
    let area=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];area+=p.x*q.y-q.x*p.y}
    const outwardSign=area>0?-1:1;const d=distance*outwardSign;const result:P2[]=[];
    for(let i=0;i<pts.length;i++){
      const prev=pts[(i-1+pts.length)%pts.length],cur=pts[i],next=pts[(i+1)%pts.length];
      const e1={x:cur.x-prev.x,y:cur.y-prev.y},e2={x:next.x-cur.x,y:next.y-cur.y},l1=Math.hypot(e1.x,e1.y)||1,l2=Math.hypot(e2.x,e2.y)||1;
      const u1={x:e1.x/l1,y:e1.y/l1},u2={x:e2.x/l2,y:e2.y/l2},n1={x:-u1.y*d,y:u1.x*d},n2={x:-u2.y*d,y:u2.x*d};
      const a={x:cur.x+n1.x,y:cur.y+n1.y},b={x:cur.x+n2.x,y:cur.y+n2.y},hit=lineIntersection(a,u1,b,u2);
      if(hit&&dist(hit,cur)<=Math.max(Math.abs(distance)*8,20))result.push(hit);else result.push({x:cur.x+(n1.x+n2.x)/2,y:cur.y+(n1.y+n2.y)/2});
    }
    return[...result,result[0]];
  }

  function buildScene(..._deps: unknown[]){
    const curves=summary.planarGeometry?.curves??[];if(summary.kind!=='dxf'||!curves.length)return null;
    const all=curves.flatMap(c=>sample(c).map(rotate));if(!all.length)return null;const partB=bounds(all);
    const dx=stockMode==='none'?-partB.minX:placement.horizontal==='left'?-partB.minX+placement.offsetX:placement.horizontal==='right'?stock.width-(partB.maxX-partB.minX)-partB.minX+placement.offsetX:(stock.width-(partB.maxX-partB.minX))/2-partB.minX+placement.offsetX;
    const dy=stockMode==='none'?-partB.minY:placement.vertical==='front'?-partB.minY+placement.offsetY:placement.vertical==='back'?stock.height-(partB.maxY-partB.minY)-partB.minY+placement.offsetY:(stock.height-(partB.maxY-partB.minY))/2-partB.minY+placement.offsetY;
    const move=(p:P2)=>({x:p.x+dx,y:p.y+dy});
    const cs=chains(curves).map(c=>({...c,points:c.points.map(move)}));
    let plane:P2[];
    if(stockMode==='none'){
      const moved=all.map(move),b=bounds(moved),m=Math.max(b.maxX-b.minX,b.maxY-b.minY)*.12+10;plane=[{x:b.minX-m,y:b.minY-m},{x:b.maxX+m,y:b.minY-m},{x:b.maxX+m,y:b.maxY+m},{x:b.minX-m,y:b.maxY+m}];
    }else{const m=Math.max(stock.width,stock.height)*.12+10;plane=[{x:-m,y:-m},{x:stock.width+m,y:-m},{x:stock.width+m,y:stock.height+m},{x:-m,y:stock.height+m}]}
    const map=fit([...all.map(move),...plane]);
    const selected=operation.contourId==null?null:cs.find(c=>c.id===operation.contourId)??null;
    let tool:P2[]|null=null;if(selected){const r=operation.tool.diameterMm/2,d=operation.side==='outside'?r:operation.side==='inside'?-r:0;tool=offsetPolygon(selected.points,d)}
    return{chains:cs.map(c=>({...c,screen:c.points.map(map)})),selected:selected?selected.points.map(map):null,tool:tool?tool.map(map):null};
  }

  $: scene=buildScene(
    operation.contourId,
    operation.tool.diameterMm,
    operation.side,
    stockMode,
    stock.width,
    stock.height,
    placement.horizontal,
    placement.vertical,
    placement.offsetX,
    placement.offsetY,
    orientation.rotationZDeg
  );
</script>

{#if scene}
<div class="contour-overlay" aria-label="Konturauswahl und Werkzeugweg">
  <svg viewBox="0 0 1000 650">
    {#each scene.chains as chain}
      <path d={path(chain.screen,true)} class="candidate" />
      <path d={path(chain.screen,true)} class="pick" onclick={()=>onSelectContour(chain.id)}>
        <title>Kontur {chain.id+1} auswählen</title>
      </path>
    {/each}
    {#if scene.selected}<path d={path(scene.selected,true)} class="selected"/>{/if}
    {#if scene.tool}<path d={path(scene.tool,true)} class="toolpath"/>{/if}
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
</style>
