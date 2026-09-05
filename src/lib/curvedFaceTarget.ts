import type { P3 } from './stepView';

export type CurvedFaceTriangle={
  a:P3;
  b:P3;
  c:P3;
};

export type CurvedFaceTarget={
  valid:boolean;
  faceIds:number[];
  triangles:CurvedFaceTriangle[];
  bounds:{minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}|null;
  errors:string[];
  warnings:string[];
};

const EPS=1e-8;

function area2(a:P3,b:P3,c:P3){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function barycentricXY(t:CurvedFaceTriangle,x:number,y:number){
  const {a,b,c}=t;
  const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<=EPS)return null;
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
  const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
  const w=1-u-v;
  if(u<-1e-7||v<-1e-7||w<-1e-7)return null;
  return{u,v,w};
}

export function curvedFaceTargetZAt(
  target:CurvedFaceTarget,
  x:number,
  y:number,
):number|null{
  if(!target.valid)return null;
  let hit:number|null=null;

  for(const triangle of target.triangles){
    const bc=barycentricXY(triangle,x,y);
    if(!bc)continue;
    const z=bc.u*triangle.a.z+bc.v*triangle.b.z+bc.w*triangle.c.z;
    if(hit===null){
      hit=z;
      continue;
    }

    // A selected surface used by 3-axis top machining must be single-valued
    // in XY. Two materially different Z values at the same XY point indicate
    // an overhang / vertical fold and are not a valid curved face target.
    if(Math.abs(hit-z)>1e-4)return null;
  }

  return hit;
}

export function buildCurvedFaceTarget(
  partTriangles:P3[],
  displayFaceIds:number[],
  selectedFaceIds:number[],
):CurvedFaceTarget{
  const errors:string[]=[];
  const warnings:string[]=[];
  const selected=new Set(selectedFaceIds);

  if(!selected.size)errors.push('Keine STEP/BRep-Fläche ausgewählt.');
  if(displayFaceIds.length!==Math.floor(partTriangles.length/3)){
    errors.push('STEP/BRep Face-ID-Zuordnung ist unvollständig.');
  }

  const triangles:CurvedFaceTriangle[]=[];
  for(let i=0;i+2<partTriangles.length;i+=3){
    const faceId=displayFaceIds[Math.floor(i/3)];
    if(!selected.has(faceId))continue;
    const a=partTriangles[i],b=partTriangles[i+1],c=partTriangles[i+2];

    // For a height field z(x,y), each projected triangle must have non-zero XY area.
    if(Math.abs(area2(a,b,c))<=EPS){
      errors.push(`Ausgewählte Fläche ${faceId} enthält eine vertikale oder XY-degenerierte Dreiecksprojektion.`);
      continue;
    }
    triangles.push({a,b,c});
  }

  if(!triangles.length&&!errors.length){
    errors.push('Die ausgewählte STEP/BRep-Fläche enthält keine Triangulation.');
  }

  let bounds:CurvedFaceTarget['bounds']=null;
  if(triangles.length){
    const points=triangles.flatMap(t=>[t.a,t.b,t.c]);
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
    bounds={
      minX:Math.min(...xs),maxX:Math.max(...xs),
      minY:Math.min(...ys),maxY:Math.max(...ys),
      minZ:Math.min(...zs),maxZ:Math.max(...zs),
    };

    if(bounds.maxZ-bounds.minZ<=1e-4){
      warnings.push('Die ausgewählte Fläche ist praktisch planar; Curved Face Target ist dafür nicht erforderlich.');
    }

    // Conservative single-valued proof on a regular sample lattice.
    const nx=24,ny=24;
    for(let iy=0;iy<=ny;iy++){
      const y=bounds.minY+(bounds.maxY-bounds.minY)*iy/ny;
      for(let ix=0;ix<=nx;ix++){
        const x=bounds.minX+(bounds.maxX-bounds.minX)*ix/nx;
        let hit:number|null=null;
        for(const triangle of triangles){
          const bc=barycentricXY(triangle,x,y);
          if(!bc)continue;
          const z=bc.u*triangle.a.z+bc.v*triangle.b.z+bc.w*triangle.c.z;
          if(hit===null)hit=z;
          else if(Math.abs(hit-z)>1e-4){
            errors.push(`Ausgewählte Fläche ist bei X ${x.toFixed(3)} / Y ${y.toFixed(3)} mm nicht eindeutig als Z(x,y) definiert.`);
            iy=ny+1;
            break;
          }
        }
      }
    }
  }

  return{
    valid:errors.length===0&&triangles.length>0,
    faceIds:[...selected],
    triangles,
    bounds,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
  };
}
