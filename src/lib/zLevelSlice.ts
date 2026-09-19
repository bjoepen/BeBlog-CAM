import type { ZLevelPerformanceProfile } from './zLevelPerformance';
export type ZPoint3 = { x:number; y:number; z:number };
export type ZPoint2 = { x:number; y:number };
export type ZLevelChain = { z:number; points:ZPoint2[]; closed:boolean };
export type ZLevelSlice = { z:number; chains:ZLevelChain[] };
export type ZLevelFaceSegment = { z:number; faceId:number; a:ZPoint2; b:ZPoint2; outward:ZPoint2 };

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

function triangleNormal(a:ZPoint3,b:ZPoint3,c:ZPoint3,reversed:boolean):ZPoint3{
  const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
  let x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
  if(reversed){x=-x;y=-y;z=-z}
  const length=Math.hypot(x,y,z)||1;
  return{x:x/length,y:y/length,z:z/length};
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

export function sliceTrianglesAtZ(points:ZPoint3[],z:number,profile?:ZLevelPerformanceProfile):ZLevelSlice{
  const unique=new Map<string,[ZPoint2,ZPoint2]>();
  for(let i=0;i+2<points.length;i+=3){
    if(profile)profile.triangleTests++;
    const segment=triangleSegment(points[i],points[i+1],points[i+2],z);
    if(segment)unique.set(segmentKey(segment[0],segment[1]),segment);
  }
  return{z,chains:chainSegments([...unique.values()],z)};
}


/**
 * Slice the display triangulation while preserving native BRep face ownership.
 * Unlike ZLevelSlice this intentionally does not chain/deduplicate across faces:
 * selected-face CAM needs the exact per-face intersection segments on this Z
 * plane, not the global XY projection of the complete 3D face.
 */
export function sliceFaceSegmentsAtZ(
  points:ZPoint3[],
  faceIds:number[],
  selectedFaceIds:number[],
  z:number,
  profile?:ZLevelPerformanceProfile,
  faceOrientations:Map<number,string>=new Map(),
):ZLevelFaceSegment[]{
  const selected=new Set(selectedFaceIds);
  const unique=new Map<string,ZLevelFaceSegment>();
  for(let i=0,triangleIndex=0;i+2<points.length;i+=3,triangleIndex++){
    const faceId=faceIds[triangleIndex];
    if(faceId==null||!selected.has(faceId))continue;
    if(profile)profile.triangleTests++;
    const segment=triangleSegment(points[i],points[i+1],points[i+2],z);
    if(!segment)continue;
    const key=`${faceId}|${segmentKey(segment[0],segment[1])}`;
    const normal=triangleNormal(points[i],points[i+1],points[i+2],faceOrientations.get(faceId)==='reversed');
    const xyLength=Math.hypot(normal.x,normal.y);
    unique.set(key,{z,faceId,a:segment[0],b:segment[1],outward:xyLength>EPS?{x:normal.x/xyLength,y:normal.y/xyLength}:{x:0,y:0}});
  }
  return[...unique.values()];
}

export function sliceTrianglesByStep(points:ZPoint3[],stepDownMm:number):ZLevelSlice[]{
  return zLevelRange(points,stepDownMm).map(z=>sliceTrianglesAtZ(points,z));
}
