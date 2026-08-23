import type { P3 } from './stepView';

export type FaceTargetLoop = { points: { x:number; y:number }[] };
export type FaceTargetRoughing = {
  targetZ: number;
  roughBottomZ: number;
  stockTopZ: number;
  levels: number[];
  loops: FaceTargetLoop[];
};

const EPS=1e-5;
const KEY_SCALE=1e5;
const key=(x:number,y:number)=>`${Math.round(x*KEY_SCALE)}:${Math.round(y*KEY_SCALE)}`;
const edgeKey=(a:{x:number;y:number},b:{x:number;y:number})=>{const ka=key(a.x,a.y),kb=key(b.x,b.y);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`};
const same=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)<=EPS;

function boundaryLoops(points:P3[],faceIds:number[],selected:Set<number>):FaceTargetLoop[]{
  const edges=new Map<string,{count:number;a:{x:number;y:number};b:{x:number;y:number}}>();
  for(let t=0;t<faceIds.length&&t*3+2<points.length;t++){
    if(!selected.has(faceIds[t]))continue;
    const tri=[points[t*3],points[t*3+1],points[t*3+2]].map(p=>({x:p.x,y:p.y}));
    for(const [a,b] of [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]] as const){
      const k=edgeKey(a,b),existing=edges.get(k);
      if(existing)existing.count++;else edges.set(k,{count:1,a,b});
    }
  }
  const unused=[...edges.values()].filter(e=>e.count===1).map(e=>[e.a,e.b] as const);
  const loops:FaceTargetLoop[]=[];
  while(unused.length){
    const first=unused.pop()!,loop=[first[0],first[1]];
    let changed=true;
    while(changed){
      changed=false;
      const tail=loop[loop.length-1];
      for(let i=unused.length-1;i>=0;i--){
        const [a,b]=unused[i];
        if(same(tail,a)){loop.push(b);unused.splice(i,1);changed=true;break}
        if(same(tail,b)){loop.push(a);unused.splice(i,1);changed=true;break}
      }
    }
    if(loop.length>=3&&same(loop[0],loop[loop.length-1]))loops.push({points:loop});
  }
  return loops;
}

function levels(stockTop:number,roughBottom:number,stepDown:number):number[]{
  if(!(stepDown>0)||stockTop<=roughBottom+EPS)return[];
  const result:number[]=[];
  for(let z=stockTop-stepDown;z>roughBottom+EPS;z-=stepDown)result.push(z);
  result.push(roughBottom);
  return result;
}

export function buildFaceTargetRoughing(
  part:P3[],
  faceIds:number[],
  selectedFaceIds:number[],
  stockTopZ:number,
  stepDownMm:number,
  finishAllowanceMm:number,
):FaceTargetRoughing|null{
  if(!selectedFaceIds.length||faceIds.length!==Math.floor(part.length/3))return null;
  const selected=new Set(selectedFaceIds),vertices:P3[]=[];
  for(let t=0;t<faceIds.length&&t*3+2<part.length;t++)if(selected.has(faceIds[t]))vertices.push(part[t*3],part[t*3+1],part[t*3+2]);
  if(vertices.length<3)return null;
  const zs=vertices.map(p=>p.z),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  if(maxZ-minZ>1e-4)return null;
  const targetZ=zs.reduce((sum,z)=>sum+z,0)/zs.length;
  const roughBottomZ=targetZ+Math.max(0,finishAllowanceMm);
  const loops=boundaryLoops(part,faceIds,selected);
  if(!loops.length)return null;
  return{targetZ,roughBottomZ,stockTopZ,levels:levels(stockTopZ,roughBottomZ,stepDownMm),loops};
}
