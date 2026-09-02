export type P2={x:number;y:number};
export type P3={x:number;y:number;z:number};
export type View={yaw:number;pitch:number};

export type ProjectedTriangle={points:P2[];depth:number;shade:number;faceId:number};

function cameraPoint(p:P3,v:View){
  const cy=Math.cos(v.yaw),sy=Math.sin(v.yaw),cp=Math.cos(v.pitch),sp=Math.sin(v.pitch);
  const x=p.x*cy-p.y*sy;
  const y=p.x*sy+p.y*cy;
  const py=y*sp+p.z*cp;
  const depth=y*cp-p.z*sp;
  return{x,y:py+depth*.08,depth};
}

function normal(a:P3,b:P3,c:P3){
  const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z;
  const vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  const len=Math.hypot(nx,ny,nz)||1;
  return{x:nx/len,y:ny/len,z:nz/len};
}

export function projectPoint(p:P3,v:View):P2{return cameraPoint(p,v)}

export function projectTriangles(points:P3[],v:View,map:(p:P2)=>P2,faceIds:number[]=[]):ProjectedTriangle[]{
  const out:ProjectedTriangle[]=[];
  const light={x:-.35,y:-.45,z:.82};
  for(let i=0;i+2<points.length;i+=3){
    const a=points[i],b=points[i+1],c=points[i+2];
    const pa=cameraPoint(a,v),pb=cameraPoint(b,v),pc=cameraPoint(c,v);
    const n=normal(a,b,c);
    const diffuse=Math.min(1,Math.abs(n.x*light.x+n.y*light.y+n.z*light.z));
    const triangleIndex=Math.floor(i/3);
    out.push({points:[map(pa),map(pb),map(pc)],depth:(pa.depth+pb.depth+pc.depth)/3,shade:diffuse,faceId:faceIds[triangleIndex]??triangleIndex});
  }
  return out.sort((a,b)=>b.depth-a.depth);
}