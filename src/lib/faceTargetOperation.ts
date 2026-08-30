import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  WorkCoordinateSystem,
  ZLevelRoughingOperation,
} from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import type { P3 } from './stepView';
import { buildFaceTargetRoughing } from './faceTargetRoughing';
import { buildFaceTargetRasterToolpath } from './faceTargetToolpath';

export type FaceTargetOperationState={
  toolpath:CanonicalToolpath;
  targetZ:number;
  roughBottomZ:number;
  levelCount:number;
};

function rotate(point:P3,orientation:PartOrientation):P3{
  const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return{x:point.x*c-point.y*s,y:point.x*s+point.y*c,z:point.z};
}

function bounds(points:P3[]){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
  return{
    minX:Math.min(...xs),maxX:Math.max(...xs),
    minY:Math.min(...ys),maxY:Math.max(...ys),
    minZ:Math.min(...zs),maxZ:Math.max(...zs),
  };
}

function placedPart(
  summary:ImportSummary,
  stock:StockDefinition,
  placement:PartPlacement,
  orientation:PartOrientation,
):P3[]|null{
  if(summary.kind!=='step')return null;
  const values=summary.brep?.displayVertices??[];
  const raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(rotate({x:values[i],y:values[i+1],z:values[i+2]},orientation));
  if(!raw.length)return null;

  const b=bounds(raw),partWidth=b.maxX-b.minX,partHeight=b.maxY-b.minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-partWidth:(stock.width-partWidth)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-partHeight:(stock.height-partHeight)/2;
  const dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;

  return raw.map(point=>({
    x:point.x+dx,
    y:point.y+dy,
    z:point.z-b.minZ+placement.offsetZ,
  }));
}

function wcsOrigin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{
  return{
    x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,
    y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,
    z:wcs.z==='top'?stock.thickness:0,
  };
}

/**
 * Reconstruct a face-target canonical toolpath without any viewport state.
 *
 * Source of truth:
 * STEP BRep display triangles + setup + ZLevelRoughingOperation.faceIds.
 */
export function buildFaceTargetOperationState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:ZLevelRoughingOperation;
}):FaceTargetOperationState|null{
  const {summary,stock,placement,orientation,wcs,operation}=args;
  if(summary.kind!=='step'||wcs.z!=='top'||!operation.faceIds.length)return null;

  const part=placedPart(summary,stock,placement,orientation);
  const displayFaceIds=summary.brep?.displayFaceIds??[];
  if(!part||displayFaceIds.length!==Math.floor(part.length/3))return null;

  const target=buildFaceTargetRoughing(
    part,
    displayFaceIds,
    operation.faceIds,
    stock.thickness,
    Math.max(.1,operation.stepDownMm),
    Math.max(0,operation.finishAllowanceMm),
  );
  if(!target)return null;

  const toolpath=buildFaceTargetRasterToolpath(
    target,
    operation.tool.diameterMm,
    operation.stepoverPercent,
    wcsOrigin(stock,wcs),
  );
  if(!toolpath)return null;

  return{
    toolpath,
    targetZ:target.targetZ,
    roughBottomZ:target.roughBottomZ,
    levelCount:target.levels.length,
  };
}
