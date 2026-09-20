import type { CanonicalToolpath, CanonicalToolpathRun } from './canonicalToolpath';
import type { ThreeDRoughingCanonicalResult } from './threeDRoughingCanonicalSafeEdges';
import type { ThreeDRoughingOperation } from './types';

export type ThreeDRoughingMultiLevelCanonicalResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  levelCount:number;
  runCount:number;
};

const EPS=1e-7;

/**
 * 008H-A9: lossless assembly of already approved A7 level toolpaths.
 *
 * A9 concatenates complete A7 runs in descending level order. It does not
 * merge, reorder or connect runs, invent stay-down certification, or create
 * machine motions. 004T remains the sole authority for approach, plunge and
 * retract materialization between these independent canonical runs.
 */
export function assembleThreeDRoughingCanonicalLevels(
  levels:ThreeDRoughingCanonicalResult[],
  operation:ThreeDRoughingOperation,
):ThreeDRoughingMultiLevelCanonicalResult{
  const errors:string[]=[];
  const warnings:string[]=[];
  const runs:CanonicalToolpathRun[]=[];
  let previousZ=Number.POSITIVE_INFINITY;
  let acceptedLevels=0;

  if(operation.tool.kind!=='end-mill')errors.push('3D Schruppen v1 benötigt einen Schaftfräser.');
  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.stepoverPercent>0&&operation.stepoverPercent<=100))errors.push('Stepover muss zwischen 0 und 100 % liegen.');
  if(!levels.length)errors.push('Keine A7-Level für die Multi-Level-Assembly vorhanden.');

  for(const [index,level] of levels.entries()){
    warnings.push(...level.warnings);
    if(!level.ok||!level.toolpath){
      errors.push(`A7-Level ${index+1} ist nicht kanonisch freigegeben.`);
      continue;
    }
    const toolpath=level.toolpath;
    if(toolpath.operationKind!=='3d-roughing'||toolpath.strategy!=='3d-roughing-safe-edges'){
      errors.push(`A7-Level ${index+1} besitzt keinen freigegebenen 3D-Schrupp-Canonical-Vertrag.`);
      continue;
    }
    if(toolpath.sourceOperationId!==operation.id){
      errors.push(`A7-Level ${index+1} gehört nicht zur aktuellen 3D-Schrupp-Operation.`);
      continue;
    }
    if(Math.abs(toolpath.tool.diameterMm-operation.tool.diameterMm)>EPS||Math.abs(toolpath.stepoverPercent-operation.stepoverPercent)>EPS){
      errors.push(`A7-Level ${index+1} verletzt Werkzeug- oder Stepover-Konsistenz.`);
      continue;
    }
    if(!toolpath.runs.length){
      errors.push(`A7-Level ${index+1} enthält keine freigegebenen Schnitt-Runs.`);
      continue;
    }

    const levelZ=toolpath.runs[0].z;
    if(!Number.isFinite(levelZ)||toolpath.runs.some(run=>Math.abs(run.z-levelZ)>EPS)){
      errors.push(`A7-Level ${index+1} ist kein konstanter Z-Level.`);
      continue;
    }
    if(levelZ>=previousZ-EPS){
      errors.push(`A7-Level ${index+1} verletzt die strikt absteigende Z-Reihenfolge.`);
      continue;
    }
    previousZ=levelZ;
    acceptedLevels++;
    // Preserve A7 run objects and their order exactly; no synthetic links.
    runs.push(...toolpath.runs);
  }

  if(errors.length)return{
    ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],levelCount:0,runCount:0,
  };

  return{
    ok:true,
    toolpath:{
      version:1,
      operationKind:'3d-roughing',
      strategy:'3d-roughing-safe-edges',
      tool:{diameterMm:operation.tool.diameterMm},
      stepoverPercent:operation.stepoverPercent,
      runs,
      sourceOperationId:operation.id,
    },
    errors:[],
    warnings:[...new Set(warnings)],
    levelCount:acceptedLevels,
    runCount:runs.length,
  };
}
