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
  boundaryDiagnostics:CurvedFaceTarget['boundaryDiagnostics'];
};

function bounds(points:P3[]){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
}


function placedOuterBoundaryGeometry(summary:ImportSummary,orientation:PartOrientation,faceIds:number[],part:P3[]):import('./curvedFaceTarget').CurvedFaceBoundaryGeometry[]|null{
  const source=buildOrientedStepManufacturingFeatureSource(summary,orientation);
  if(!source.ok)return null;
  const selected=new Set(faceIds);
  const outerWires=source.source.wires.filter(wire=>selected.has(wire.faceId)&&wire.outer===true);
  if(!outerWires.length)return null;

  const rawValues=summary.brep?.displayVertices??[],orientedRaw:P3[]=[];
  for(let i=0;i+2<rawValues.length;i+=3)orientedRaw.push(orientPoint3({x:rawValues[i],y:rawValues[i+1],z:rawValues[i+2]},orientation));
  if(!orientedRaw.length||!part.length)return null;
  const rawBounds=bounds(orientedRaw),placedBounds=bounds(part);
  const offset={x:placedBounds.minX-rawBounds.minX,y:placedBounds.minY-rawBounds.minY,z:placedBounds.minZ-rawBounds.minZ};
  const place=(tuple:[number,number,number]):P3=>({x:tuple[0]+offset.x,y:tuple[1]+offset.y,z:tuple[2]+offset.z});

  const boundaries:import('./curvedFaceTarget').CurvedFaceBoundaryGeometry[]=[];
  for(const wire of outerWires)for(const edgeId of wire.edgeIds){
    const edge=source.source.edges[edgeId];
    if(!edge)return null;
    if(edge.kind==='line'){boundaries.push({kind:'line',wireId:wire.wireId,edgeId,start:place(edge.start),end:place(edge.end)});continue;}
    if(edge.kind==='circle'&&edge.center&&edge.radiusMm&&edge.axisDirection){
      boundaries.push({kind:'circle',wireId:wire.wireId,edgeId,center:place(edge.center),axisDirection:{x:edge.axisDirection[0],y:edge.axisDirection[1],z:edge.axisDirection[2]},radiusMm:edge.radiusMm});
      continue;
    }
    return null;
  }
  return boundaries.length?boundaries:null;
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
  if(errors.length)return{ok:false,target:null,errors,warnings,triangleCount:0,boundaryDiagnostics:[]};

  const part=buildPlacedPartTriangles(summary,stock,placement,orientation);
  const displayFaceIds=summary.brep?.displayFaceIds??[];
  if(!part||displayFaceIds.length!==Math.floor(part.length/3)){
    return{ok:false,target:null,errors:['STEP/BRep-Triangulation oder Face-ID-Zuordnung konnte nicht rekonstruiert werden.'],warnings,triangleCount:0,boundaryDiagnostics:[]};
  }

  const outerBoundaryGeometry=placedOuterBoundaryGeometry(summary,orientation,faceIds,part);
  const target=buildCurvedFaceTarget(part,displayFaceIds,faceIds,undefined,outerBoundaryGeometry??undefined);
  warnings.push(...target.warnings);
  errors.push(...target.errors);
  return{
    ok:target.valid&&errors.length===0,
    target:target.valid&&errors.length===0?target:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:target.triangles.length,
    boundaryDiagnostics:target.boundaryDiagnostics,
  };
}
