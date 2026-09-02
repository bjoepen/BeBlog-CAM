export type ZPoint3 = { x:number; y:number; z:number };
export type ZPoint2 = { x:number; y:number };
export type ZLevelChain = { z:number; points:ZPoint2[]; closed:boolean };
export type ZLevelSlice = { z:number; chains:ZLevelChain[] };

const EPS=1e-7;
const KEY_SCALE=1e5;

function same2(a:ZPoint2,b:ZPoint2,tol=1e-5){return Math.hypot(a.x-b.x,a.y-b.y)<=tol}
function key2(p:ZPoint2){return `${Math.round(p.x*KEY_SCALE)}:${Math.round(p.y*KEY_SCALE)}`}
function segmentKey(a:ZPoint2,b:ZPoint2){const ka=key2(a),kb=key2(b);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`}

function edgeIntersection(a:ZPoint3,b:ZPoint3,z:number):ZPoint2|null{
  const da=a.z-z,db=b.z-z;
  if(Math.abs(da)<=EPS&&Math.abs(db)<=EPS)return null;
  if(Math.abs(da)<=EPS)return{x:a.x,y:a.y};
  if(Math.abs(db)<=EPS)return{x:b.x,y:b.y};
  if((da<0&&db<0)||(da>0&&db>0))return null;
  const t=(z-a.z)/(b.z-a.z);
  if(t<-EPS||t>1+EPS)return null;
  return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}

function triangleSegment(a:ZPoint3,b:ZPoint3,c:ZPoint3,z:number):[ZPoint2,ZPoint2]|null{
  if(Math.abs(a.z-z)<=EPS&&Math.abs(b.z-z)<=EPS&&Math.abs(c.z-z)<=EPS)return null;
  const hits:ZPoint2[]=[];
  for(const [p,q] of [[a,b],[b,c],[c,a]] as const){
    const hit=edgeIntersection(p,q,z);
    if(hit&&!hits.some(existing=>same2(existing,hit)))hits.push(hit);
  }
  if(hits.length<2)return null;
  let best:[ZPoint2,ZPoint2]=[hits[0],hits[1]],bestLength=Math.hypot(hits[0].x-hits[1].x,hits[0].y-hits[1].y);
  for(let i=0;i<hits.length;i++)for(let j=i+1;j<hits.length;j++){
    const length=Math.hypot(hits[i].x-hits[j].x,hits[i].y-hits[j].y);
    if(length>bestLength){best=[hits[i],hits[j]];bestLength=length;}
  }
  return bestLength>EPS?best:null;
}

function chainSegments(segments:[ZPoint2,ZPoint2][],z:number):ZLevelChain[]{
  const unused=[...segments];
  const chains:ZLevelChain[]=[];
  while(unused.length){
    const first=unused.pop()!;
    const points=[first[0],first[1]];
    let changed=true;
    while(changed){
      changed=false;
      for(let i=unused.length-1;i>=0;i--){
        const [a,b]=unused[i],head=points[0],tail=points[points.length-1];
        if(same2(tail,a)){points.push(b);unused.splice(i,1);changed=true;break;}
        if(same2(tail,b)){points.push(a);unused.splice(i,1);changed=true;break;}
        if(same2(head,b)){points.unshift(a);unused.splice(i,1);changed=true;break;}
        if(same2(head,a)){points.unshift(b);unused.splice(i,1);changed=true;break;}
      }
    }
    const closed=points.length>2&&same2(points[0],points[points.length-1]);
    if(closed)points[points.length-1]={...points[0]};
    chains.push({z,points,closed});
  }
  return chains;
}

export function zLevelRange(points:ZPoint3[],stepDownMm:number):number[]{
  if(!(stepDownMm>0)||points.length<3)return[];
  const zs=points.map(p=>p.z).filter(Number.isFinite);
  if(!zs.length)return[];
  const minZ=Math.min(...zs),maxZ=Math.max(...zs),height=maxZ-minZ;
  if(height<=EPS)return[];
  const levels:number[]=[];
  for(let depth=stepDownMm;depth<height-EPS;depth+=stepDownMm)levels.push(maxZ-depth);
  if(!levels.length||Math.abs(levels[levels.length-1]-minZ)>EPS)levels.push(minZ);
  return levels;
}

export function sliceTrianglesAtZ(points:ZPoint3[],z:number):ZLevelSlice{
  const unique=new Map<string,[ZPoint2,ZPoint2]>();
  for(let i=0;i+2<points.length;i+=3){
    const segment=triangleSegment(points[i],points[i+1],points[i+2],z);
    if(segment)unique.set(segmentKey(segment[0],segment[1]),segment);
  }
  return{z,chains:chainSegments([...unique.values()],z)};
}

export function sliceTrianglesByStep(points:ZPoint3[],stepDownMm:number):ZLevelSlice[]{
  return zLevelRange(points,stepDownMm).map(z=>sliceTrianglesAtZ(points,z));
}
