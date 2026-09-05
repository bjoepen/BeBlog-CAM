import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  WorkCoordinateSystem,
  ZLevelRoughingOperation,
} from './types';
import type { CanonicalToolpath, CanonicalToolpathRun } from './canonicalToolpath';
import type { P3 } from './stepView';
import { buildCurvedFaceTarget } from './curvedFaceTarget';
import { buildCurvedFaceRoughing } from './curvedFaceRoughing';

export type CurvedFaceRoughingOperationState={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  levelCount:number;
  errors:string[];
  warnings:string[];
  targetMinZ:number|null;
  targetMaxZ:number|null;
  safePointCount:number;
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
  for(let i=0;i+2<values.length;i+=3){
    raw.push(rotate({x:values[i],y:values[i+1],z:values[i+2]},orientation));
  }
  if(!raw.length)return null;

  const b=bounds(raw),partWidth=b.maxX-b.minX,partHeight=b.maxY-b.minY;
  const tx=placement.horizontal==='left'
    ?0
    :placement.horizontal==='right'
      ?stock.width-partWidth
      :(stock.width-partWidth)/2;
  const ty=placement.vertical==='front'
    ?0
    :placement.vertical==='back'
      ?stock.height-partHeight
      :(stock.height-partHeight)/2;
  const dx=tx-b.minX+placement.offsetX;
  const dy=ty-b.minY+placement.offsetY;

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

export function buildCurvedFaceRoughingOperationState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:ZLevelRoughingOperation;
}):CurvedFaceRoughingOperationState{
  const {summary,stock,placement,orientation,wcs,operation}=args;
  const errors:string[]=[];
  const warnings:string[]=[];

  if(summary.kind!=='step')errors.push('Gekrümmtes Face-Target-Schruppen benötigt ein STEP/BRep-Modell.');
  if(wcs.z!=='top')errors.push('Gekrümmtes Face-Target-Schruppen benötigt WCS Z auf der Rohlingoberseite.');
  if(!operation.faceIds.length)errors.push('Keine STEP/BRep-Zielfläche gewählt.');
  if(operation.tool.kind&&operation.tool.kind!=='end-mill')errors.push('Gekrümmtes Z-Level-Schruppen benötigt einen Schaftfräser.');
  if(errors.length)return{ok:false,toolpath:null,levelCount:0,errors,warnings,targetMinZ:null,targetMaxZ:null,safePointCount:0};

  const part=placedPart(summary,stock,placement,orientation);
  const faceIds=summary.brep?.displayFaceIds??[];
  if(!part||faceIds.length!==Math.floor(part.length/3)){
    return{
      ok:false,toolpath:null,levelCount:0,
      errors:['STEP/BRep-Triangulation oder Face-ID-Zuordnung konnte nicht rekonstruiert werden.'],
      warnings,targetMinZ:null,targetMaxZ:null,safePointCount:0,
    };
  }

  const target=buildCurvedFaceTarget(part,faceIds,operation.faceIds);
  errors.push(...target.errors);
  warnings.push(...target.warnings);
  if(!target.valid||!target.bounds){
    return{
      ok:false,toolpath:null,levelCount:0,
      errors:[...new Set(errors)],warnings:[...new Set(warnings)],
      targetMinZ:null,targetMaxZ:null,safePointCount:0,
    };
  }

  if(target.bounds.maxZ-target.bounds.minZ<=1e-4){
    return{
      ok:false,toolpath:null,levelCount:0,
      errors:['Die Zielfläche ist planar und gehört zum planaren Face-Target-Pfad.'],
      warnings:[...new Set(warnings)],
      targetMinZ:target.bounds.minZ,targetMaxZ:target.bounds.maxZ,safePointCount:0,
    };
  }

  const roughing=buildCurvedFaceRoughing(
    target,
    stock.thickness,
    operation.tool.diameterMm,
    operation.stepDownMm,
    operation.stepoverPercent,
    operation.finishAllowanceMm,
  );

  errors.push(...roughing.errors);
  warnings.push(...roughing.warnings);
  if(!roughing.valid){
    return{
      ok:false,toolpath:null,levelCount:roughing.levels.length,
      errors:[...new Set(errors)],warnings:[...new Set(warnings)],
      targetMinZ:target.bounds.minZ,targetMaxZ:target.bounds.maxZ,
      safePointCount:roughing.safePointCount,
    };
  }

  const origin=wcsOrigin(stock,wcs);
  const runs:CanonicalToolpathRun[]=[];

  for(const level of roughing.levels){
    for(const chain of level.chains){
      if(chain.points.length<2)continue;
      runs.push({
        kind:'cut',
        z:level.z-origin.z,
        points:chain.points.map(point=>({
          x:point.x-origin.x,
          y:point.y-origin.y,
        })),
        retractAfter:true,
      });
    }
  }

  if(!runs.length){
    errors.push('Der gekrümmte Face-Target-Kernel lieferte keine kanonischen Schruppbahnen.');
    return{
      ok:false,toolpath:null,levelCount:roughing.levels.length,
      errors:[...new Set(errors)],warnings:[...new Set(warnings)],
      targetMinZ:target.bounds.minZ,targetMaxZ:target.bounds.maxZ,
      safePointCount:roughing.safePointCount,
    };
  }

  return{
    ok:true,
    toolpath:{
      version:1,
      operationKind:'z-level-roughing',
      strategy:'raster',
      tool:{diameterMm:operation.tool.diameterMm},
      stepoverPercent:operation.stepoverPercent,
      runs,
    },
    levelCount:roughing.levels.length,
    errors:[],
    warnings:[...new Set(warnings)],
    targetMinZ:target.bounds.minZ,
    targetMaxZ:target.bounds.maxZ,
    safePointCount:roughing.safePointCount,
  };
}
