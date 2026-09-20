import type { P3 } from './stepView';

export type PartSafetyTriangle={a:P3;b:P3;c:P3};
type PartSafetySpatialIndex={minX:number;minY:number;cellWidth:number;cellHeight:number;columns:number;rows:number;cells:number[][]};

export type PartSafetySurface={
  valid:boolean;
  triangles:PartSafetyTriangle[];
  bounds:{minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}|null;
  spatialIndex:PartSafetySpatialIndex|null;
  errors:string[];
};

const EPS=1e-8;

function barycentricXY(t:PartSafetyTriangle,x:number,y:number){
  const {a,b,c}=t;
  const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<=EPS)return null;
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
  const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
  const w=1-u-v;
  return u>=-1e-7&&v>=-1e-7&&w>=-1e-7?{u,v,w}:null;
}

function buildSpatialIndex(triangles:PartSafetyTriangle[],bounds:NonNullable<PartSafetySurface['bounds']>):PartSafetySpatialIndex{
  const count=Math.max(1,triangles.length);
  const aspect=Math.max(1e-6,(bounds.maxX-bounds.minX)/Math.max(1e-6,bounds.maxY-bounds.minY));
  const columns=Math.max(1,Math.min(128,Math.ceil(Math.sqrt(count*aspect))));
  const rows=Math.max(1,Math.min(128,Math.ceil(count/columns)));
  const cellWidth=Math.max(EPS,(bounds.maxX-bounds.minX)/columns);
  const cellHeight=Math.max(EPS,(bounds.maxY-bounds.minY)/rows);
  const cells=Array.from({length:columns*rows},()=>[] as number[]);
  const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,Math.floor(v)));
  triangles.forEach((triangle,index)=>{
    const minX=Math.min(triangle.a.x,triangle.b.x,triangle.c.x),maxX=Math.max(triangle.a.x,triangle.b.x,triangle.c.x);
    const minY=Math.min(triangle.a.y,triangle.b.y,triangle.c.y),maxY=Math.max(triangle.a.y,triangle.b.y,triangle.c.y);
    const x0=clamp((minX-bounds.minX)/cellWidth,columns-1),x1=clamp((maxX-bounds.minX)/cellWidth,columns-1);
    const y0=clamp((minY-bounds.minY)/cellHeight,rows-1),y1=clamp((maxY-bounds.minY)/cellHeight,rows-1);
    for(let row=y0;row<=y1;row++)for(let column=x0;column<=x1;column++)cells[row*columns+column].push(index);
  });
  return{minX:bounds.minX,minY:bounds.minY,cellWidth,cellHeight,columns,rows,cells};
}

export function buildPartSafetySurface(partTriangles:P3[]):PartSafetySurface{
  const errors:string[]=[];
  if(!partTriangles.length||partTriangles.length%3!==0)errors.push('Part Safety Truth benötigt eine vollständige STEP/BRep-Triangulation.');
  if(partTriangles.some(point=>![point.x,point.y,point.z].every(Number.isFinite)))errors.push('Part Safety Truth enthält nicht-endliche Koordinaten.');
  if(errors.length)return{valid:false,triangles:[],bounds:null,spatialIndex:null,errors};

  const triangles:PartSafetyTriangle[]=[];
  for(let i=0;i+2<partTriangles.length;i+=3)triangles.push({a:partTriangles[i],b:partTriangles[i+1],c:partTriangles[i+2]});
  const xs=partTriangles.map(p=>p.x),ys=partTriangles.map(p=>p.y),zs=partTriangles.map(p=>p.z);
  const bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  return{valid:true,triangles,bounds,spatialIndex:buildSpatialIndex(triangles,bounds),errors:[]};
}

export function translatePartSafetySurface(surface:PartSafetySurface,offset:P3):PartSafetySurface{
  if(!surface.valid||!surface.bounds)return surface;
  const shift=(p:P3):P3=>({x:p.x+offset.x,y:p.y+offset.y,z:p.z+offset.z});
  const triangles=surface.triangles.map(t=>({a:shift(t.a),b:shift(t.b),c:shift(t.c)}));
  const bounds={minX:surface.bounds.minX+offset.x,maxX:surface.bounds.maxX+offset.x,minY:surface.bounds.minY+offset.y,maxY:surface.bounds.maxY+offset.y,minZ:surface.bounds.minZ+offset.z,maxZ:surface.bounds.maxZ+offset.z};
  return{valid:true,triangles,bounds,spatialIndex:buildSpatialIndex(triangles,bounds),errors:[]};
}

/**
 * Upper-envelope truth for 3-axis top machining.
 * Multiple shell intersections are intentional: the highest finite Z protects
 * the complete part. XY-degenerate/vertical display triangles do not define a
 * height-field patch and are ignored rather than invalidating the whole part.
 * null means that the complete part has no projected material at this XY.
 */
export function partSafetyUpperZAt(surface:PartSafetySurface,x:number,y:number):number|null{
  if(!surface.valid||!surface.bounds||!surface.spatialIndex)return null;
  const b=surface.bounds,index=surface.spatialIndex;
  if(x<b.minX-EPS||x>b.maxX+EPS||y<b.minY-EPS||y>b.maxY+EPS)return null;
  const column=Math.max(0,Math.min(index.columns-1,Math.floor((x-index.minX)/index.cellWidth)));
  const row=Math.max(0,Math.min(index.rows-1,Math.floor((y-index.minY)/index.cellHeight)));
  let upper:number|null=null;
  for(const triangleIndex of index.cells[row*index.columns+column]){
    const triangle=surface.triangles[triangleIndex],bc=barycentricXY(triangle,x,y);
    if(!bc)continue;
    const z=bc.u*triangle.a.z+bc.v*triangle.b.z+bc.w*triangle.c.z;
    if(Number.isFinite(z)&&(upper===null||z>upper))upper=z;
  }
  return upper;
}
