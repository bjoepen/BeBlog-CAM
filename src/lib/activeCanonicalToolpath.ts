import type { CanonicalToolpath } from './canonicalToolpath';
import { buildFacingToolpath } from './facingToolpath';
import { generateContourGcode } from './gcode';
import { canonicalContourToolpathFromGcode } from './contourCanonicalToolpath';
import { buildPocketCanonicalToolpath } from './pocketCanonicalToolpath';
import { buildCarveCanonicalToolpath } from './carveCanonicalToolpath';
import { buildDrillCanonicalToolpath } from './drillCanonicalToolpath';
import { buildModelRoughingOperationState } from './modelRoughingOperation';
import { buildSurfaceFinishingOperationState } from './surfaceFinishingOperation';
import type {
  CamOperation,
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  StockMode,
  WorkCoordinateSystem,
} from './types';

export function buildActiveCanonicalToolpath(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  stockMode:StockMode;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:CamOperation;
}):CanonicalToolpath|null{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;

  if(operation.kind==='facing'){
    if(stockMode==='none')return null;
    return buildFacingToolpath({stock,wcs,operation}).toolpath;
  }

  if(operation.kind==='contour'){
    const generated=generateContourGcode({summary,stock,stockMode,placement,orientation,wcs,operation});
    if(!generated.ok)return null;
    return canonicalContourToolpathFromGcode(generated.code,operation.tool.diameterMm);
  }

  if(operation.kind==='pocket'){
    return buildPocketCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
  }

  if(operation.kind==='carve'){
    return buildCarveCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
  }

  if(operation.kind==='surface-finishing'){
    const state=buildSurfaceFinishingOperationState({summary,stock,placement,orientation,wcs,operation});
    return state.ok?state.toolpath:null;
  }
  if(operation.kind==='z-level-roughing'){if((operation.roughingMode??'face-target')!=='model')return null;const state=buildModelRoughingOperationState({summary,stock,placement,orientation,wcs,operation});return state.ok?state.toolpath:null;}
  return buildDrillCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
}
