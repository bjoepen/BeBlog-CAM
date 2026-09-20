import type { CurvedFaceTarget } from './curvedFaceTarget';
import { buildCurvedFaceTarget } from './curvedFaceTarget';
import { orientPoint3 } from './partOrientation';
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

  const target=buildCurvedFaceTarget(part,displayFaceIds,faceIds);
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
