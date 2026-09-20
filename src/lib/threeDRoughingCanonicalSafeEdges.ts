import type { CanonicalToolpath, CanonicalToolpathRun } from './canonicalToolpath';
import type { ThreeDRoughingSafeChains } from './threeDRoughingSafeChains';
import type { ThreeDRoughingOperation } from './types';

export type ThreeDRoughingCanonicalResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  runCount:number;
};

const EPS=1e-7;

/**
 * 008H-A7: lossless canonical materialization of already proven A6 edges.
 *
 * Every A6 safe edge becomes one independent constant-Z canonical cut run.
 * A7 does not interpolate geometry, reorder/merge edges, certify stay-down,
 * create machine motions or choose plunge/retract behaviour. 004T remains the
 * sole authority for safe approach, plunge and retract materialization.
 */
export function buildThreeDRoughingCanonicalSafeEdges(
  safe:ThreeDRoughingSafeChains,
  operation:ThreeDRoughingOperation,
):ThreeDRoughingCanonicalResult{
  const errors:string[]=[];
  const warnings=[...safe.warnings];

  if(!safe.valid)errors.push('3D-Schrupp-Safe-Chains sind ungültig.');
  if(operation.tool.kind!=='end-mill')errors.push('3D Schruppen v1 benötigt einen Schaftfräser.');
  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.stepoverPercent>0&&operation.stepoverPercent<=100))errors.push('Stepover muss zwischen 0 und 100 % liegen.');

  const runs:CanonicalToolpathRun[]=[];
  if(!errors.length){
    for(const [index,chain] of safe.chains.entries()){
      if(chain.samples.length!==2){
        errors.push(`A6 Safe-Chain ${index+1} ist keine freigegebene Zwei-Punkt-Kante.`);
        continue;
      }
      const [from,to]=chain.samples;
      if(from.state!=='removable'||to.state!=='removable'){
        errors.push(`A6 Safe-Chain ${index+1} enthält keinen ausschließlich REMOVABLE-geprüften Schnitt.`);
        continue;
      }
      if(Math.abs(chain.cutZ-safe.cutZ)>EPS||Math.abs(from.cutZ-chain.cutZ)>EPS||Math.abs(to.cutZ-chain.cutZ)>EPS){
        errors.push(`A6 Safe-Chain ${index+1} verletzt den konstanten Z-Level-Vertrag.`);
        continue;
      }
      const dx=to.x-from.x,dy=to.y-from.y;
      if(!(Math.hypot(dx,dy)>EPS)||Math.abs(dx)>EPS&&Math.abs(dy)>EPS){
        errors.push(`A6 Safe-Chain ${index+1} ist keine unmittelbare orthogonale Schnittkante.`);
        continue;
      }
      runs.push({
        kind:'cut',
        z:chain.cutZ,
        points:[{x:from.x,y:from.y},{x:to.x,y:to.y}],
      });
    }
  }

  if(errors.length)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],runCount:0};
  if(!runs.length)return{ok:false,toolpath:null,errors:['A6 enthält keine kanonisch materialisierbare sichere Schnittkante.'],warnings:[...new Set(warnings)],runCount:0};

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
    runCount:runs.length,
  };
}
