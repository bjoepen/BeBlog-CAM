import type { CurvedFaceTarget } from './curvedFaceTarget';
import { buildCurvedFaceTarget } from './curvedFaceTarget';
import { orientPoint3 } from './partOrientation';
import { buildOrientedStepManufacturingFeatureSource } from './stepManufacturingFeatures';
import type { P3 } from './stepView';
import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
} from './types';

export type ThreeDSurfaceTargetState={
  ok:boolean;
  target:CurvedFaceTarget|null;
  errors:string[];
  warnings:string[];
  triangleCount:number;
};

function bounds(points:P3[]){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
}


function placedOuterBoundaryPolylines(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation,faceIds:number[],part:P3[]):P3[][]|null{
  const source=buildOrientedStepManufacturingFeatureSource(summary,orientation);
  if(!source.ok)return null;
  const selected=new Set(faceIds);
  const outerWires=source.source.wires.filter(wire=>selected.has(wire.faceId)&&wire.outer===true);
  if(!outerWires.length)return null;

  const rawValues=summary.brep?.displayVertices??[],orientedRaw:P3[]=[];
  for(let i=0;i+2<rawValues.length;i+=3)orientedRaw.push(orientPoint3({x:rawValues[i],y:rawValues[i+1],z:rawValues[i+2]},orientation));
  if(!orientedRaw.length||!part.length)return null;
  const rawBounds=bounds(orientedRaw),placedBounds=bounds(part);
  const dx=placedBounds.minX-rawBounds.minX,dy=placedBounds.minY-rawBounds.minY,dz=placedBounds.minZ-rawBounds.minZ;
  const place=(tuple:[number,number,number]):P3=>({x:tuple[0]+dx,y:tuple[1]+dy,z:tuple[2]+dz});

  const polylines:P3[][]=[];
  for(const wire of outerWires){
    for(const edgeId of wire.edgeIds){
      const edge=source.source.edges[edgeId];
      if(!edge)return null;
      if(edge.kind==='line'){polylines.push([place(edge.start),place(edge.end)]);continue;}
      if(edge.kind==='circle'&&edge.center&&edge.radiusMm&&edge.axisDirection&&Math.abs(Math.abs(edge.axisDirection[2])-1)<=1e-5){
        const center=place(edge.center),r=edge.radiusMm;
        const start=place(edge.start),end=place(edge.end);
        if(edge.closed||Math.hypot(start.x-end.x,start.y-end.y)<=1e-5){
          polylines.push(Array.from({length:257},(_,i)=>{const a=i/256*Math.PI*2;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r,z:center.z};}));
          continue;
        }
        const a0=Math.atan2(start.y-center.y,start.x-center.x),a1=Math.atan2(end.y-center.y,end.x-center.x);
        let ccw=edge.axisDirection[2]>=0;if(edge.orientation==='reversed')ccw=!ccw;
        let d=a1-a0;if(ccw){while(d<=0)d+=Math.PI*2}else{while(d>=0)d-=Math.PI*2}
        const steps=Math.max(32,Math.ceil(Math.abs(d)/(Math.PI/128)));
        polylines.push(Array.from({length:steps+1},(_,i)=>{const a=a0+d*i/steps;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r,z:center.z};}));
        continue;
      }
      return null;
    }
  }
  return polylines.length?polylines:null;
}

export function buildPlacedPartTriangles(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation):P3[]|null{
  if(summary.kind!=='step')return null;
  const values=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(orientPoint3({x:values[i],y:values[i+1],z:values[i+2]},orientation));
  if(!raw.length)return null;

  const b=bounds(raw),partWidth=b.maxX-b.minX,partHeight=b.maxY-b.minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-partWidth:(stock.width-partWidth)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-partHeight:(stock.height-partHeight)/2;
  const dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;
  return raw.map(point=>({x:point.x+dx,y:point.y+dy,z:point.z-b.minZ+placement.offsetZ}));
}

export function buildThreeDSurfaceTargetState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  faceIds:number[];
  operationLabel:string;
}):ThreeDSurfaceTargetState{
  const {summary,stock,placement,orientation,faceIds,operationLabel}=args;
  const errors:string[]=[],warnings:string[]=[];

  if(summary.kind!=='step')errors.push(`${operationLabel} benötigt ein STEP/BRep-Modell.`);
  if(!faceIds.length)errors.push(`Keine STEP/BRep-Fläche für ${operationLabel} gewählt.`);
  if(errors.length)return{ok:false,target:null,errors,warnings,triangleCount:0};

  const part=buildPlacedPartTriangles(summary,stock,placement,orientation);
  const displayFaceIds=summary.brep?.displayFaceIds??[];
  if(!part||displayFaceIds.length!==Math.floor(part.length/3)){
    return{ok:false,target:null,errors:['STEP/BRep-Triangulation oder Face-ID-Zuordnung konnte nicht rekonstruiert werden.'],warnings,triangleCount:0};
  }

  const outerBoundaryPolylines=placedOuterBoundaryPolylines(summary,stock,placement,orientation,faceIds,part);
  const target=buildCurvedFaceTarget(part,displayFaceIds,faceIds,undefined,outerBoundaryPolylines??undefined);
  warnings.push(...target.warnings);
  errors.push(...target.errors);
  return{
    ok:target.valid&&errors.length===0,
    target:target.valid&&errors.length===0?target:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:target.triangles.length,
  };
}
