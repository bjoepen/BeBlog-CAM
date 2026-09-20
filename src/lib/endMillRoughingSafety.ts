import type { CurvedFaceTarget } from './curvedFaceTarget';
import { curvedFaceTargetZAt } from './curvedFaceTarget';

export type EndMillRoughingSafetyPoint={
  x:number;
  y:number;
  safeZ:number;
  surfaceMaxZ:number;
  finishAllowanceMm:number;
};

export type EndMillRoughingSafetyResult={
  valid:boolean;
  safety:EndMillRoughingSafetyPoint|null;
  error:string|null;
};

const EPS=1e-7;

/**
 * Conservative 3-axis safety truth for a flat end mill.
 *
 * The complete circular cutter face must remain above the selected target
 * surface plus finishing allowance. This is intentionally not a toolpath
 * strategy: it answers only the local cutter-center Z safety question.
 */
export function endMillRoughingSafetyAt(
  target:CurvedFaceTarget,
  x:number,
  y:number,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  sampleStepMm=.25,
):EndMillRoughingSafetyResult{
  if(!target.valid||!target.bounds)return{valid:false,safety:null,error:'Gekrümmte Zielfläche ist ungültig.'};
  if(!(cutterRadiusMm>0))return{valid:false,safety:null,error:'Fräserradius muss größer als 0 sein.'};
  if(!(finishAllowanceMm>=0))return{valid:false,safety:null,error:'Schlichtaufmaß darf nicht negativ sein.'};
  if(!(sampleStepMm>0))return{valid:false,safety:null,error:'Abtastschritt muss größer als 0 sein.'};

  // The centre itself must belong to the selected machining surface.
  const centerZ=curvedFaceTargetZAt(target,x,y);
  if(centerZ===null)return{valid:false,safety:null,error:'XY liegt außerhalb der ausgewählten Zielfläche.'};

  // Sample the complete cutter disk on a deterministic Cartesian lattice.
  // Any uncovered sample fails closed: A3 must never infer safe cutter support
  // from geometry outside the selected Surface Truth.
  const step=Math.min(sampleStepMm,Math.max(.05,cutterRadiusMm/8));
  const samples=Math.max(1,Math.ceil((cutterRadiusMm*2)/step));
  let surfaceMaxZ=-Infinity;

  for(let iy=0;iy<=samples;iy++){
    const dy=-cutterRadiusMm+(2*cutterRadiusMm*iy)/samples;
    for(let ix=0;ix<=samples;ix++){
      const dx=-cutterRadiusMm+(2*cutterRadiusMm*ix)/samples;
      if(dx*dx+dy*dy>cutterRadiusMm*cutterRadiusMm+EPS)continue;
      const z=curvedFaceTargetZAt(target,x+dx,y+dy);
      if(z===null){
        return{valid:false,safety:null,error:'Fräser-Stirnfläche ist nicht vollständig durch die ausgewählte 3D-Zielfläche belegt.'};
      }
      surfaceMaxZ=Math.max(surfaceMaxZ,z);
    }
  }

  if(!Number.isFinite(surfaceMaxZ))return{valid:false,safety:null,error:'Für die Fräser-Stirnfläche konnte keine sichere 3D-Höhe bestimmt werden.'};

  return{
    valid:true,
    safety:{x,y,safeZ:surfaceMaxZ+finishAllowanceMm,surfaceMaxZ,finishAllowanceMm},
    error:null,
  };
}
