import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  SurfaceFinishingOperation,
  WorkCoordinateSystem,
} from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import type { P3 } from './stepView';
import { buildThreeDSurfaceTargetState } from './threeDSurfaceTargetState';
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

  const surface=buildThreeDSurfaceTargetState({summary,stock,placement,orientation,faceIds:operation.faceIds,operationLabel:'3D Schlichten'});
  warnings.push(...surface.warnings);
  errors.push(...surface.errors);
  if(!surface.ok||!surface.target)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],triangleCount:surface.triangleCount,chainCount:0,contactPointCount:0};

  const target=surface.target;
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
