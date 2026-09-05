import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  SurfaceFinishingOperation,
  WorkCoordinateSystem,
} from './types';
import type { P3 } from './stepView';
import type { CanonicalToolpath } from './canonicalToolpath';
import { buildCurvedFaceTarget } from './curvedFaceTarget';
import { buildSurfaceFinishingCanonicalToolpath } from './surfaceFinishingToolpath';

export type SurfaceFinishingOperationState={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  triangleCount:number;
  chainCount:number;
  contactPointCount:number;
};

function rotate(point:P3,orientation:PartOrientation):P3{
  const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return{x:point.x*c-point.y*s,y:point.x*s+point.y*c,z:point.z};
}

function bounds(points:P3[]){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
}

function placedPart(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation):P3[]|null{
  if(summary.kind!=='step')return null;
  const values=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(rotate({x:values[i],y:values[i+1],z:values[i+2]},orientation));
  if(!raw.length)return null;

  const b=bounds(raw),partWidth=b.maxX-b.minX,partHeight=b.maxY-b.minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-partWidth:(stock.width-partWidth)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-partHeight:(stock.height-partHeight)/2;
  const dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;
  return raw.map(point=>({x:point.x+dx,y:point.y+dy,z:point.z-b.minZ+placement.offsetZ}));
}

function wcsOrigin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{
  return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0};
}

export function buildSurfaceFinishingOperationState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:SurfaceFinishingOperation;
}):SurfaceFinishingOperationState{
  const {summary,stock,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];

  if(summary.kind!=='step')errors.push('3D Schlichten benötigt ein STEP/BRep-Modell.');
  if(wcs.z!=='top')errors.push('3D Schlichten benötigt WCS Z auf der Rohlingoberseite.');
  if(!operation.faceIds.length)errors.push('Keine STEP/BRep-Fläche für 3D Schlichten gewählt.');
  if(operation.tool.kind!=='ball-nose')errors.push('3D Schlichten benötigt einen Vollradiusfräser.');
  if(errors.length)return{ok:false,toolpath:null,errors,warnings,triangleCount:0,chainCount:0,contactPointCount:0};

  const part=placedPart(summary,stock,placement,orientation);
  const faceIds=summary.brep?.displayFaceIds??[];
  if(!part||faceIds.length!==Math.floor(part.length/3)){
    return{ok:false,toolpath:null,errors:['STEP/BRep-Triangulation oder Face-ID-Zuordnung konnte nicht rekonstruiert werden.'],warnings,triangleCount:0,chainCount:0,contactPointCount:0};
  }

  const target=buildCurvedFaceTarget(part,faceIds,operation.faceIds);
  warnings.push(...target.warnings);
  errors.push(...target.errors);
  if(!target.valid)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],triangleCount:target.triangles.length,chainCount:0,contactPointCount:0};

  const built=buildSurfaceFinishingCanonicalToolpath(target,operation,wcsOrigin(stock,wcs));
  errors.push(...built.errors);
  warnings.push(...built.warnings);

  return{
    ok:built.ok&&errors.length===0,
    toolpath:built.ok&&errors.length===0?built.toolpath:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:target.triangles.length,
    chainCount:built.chainCount,
    contactPointCount:built.contactPointCount,
  };
}
