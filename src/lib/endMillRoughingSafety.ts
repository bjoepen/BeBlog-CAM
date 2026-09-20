import type { CurvedFaceTarget } from './curvedFaceTarget';
import { curvedFaceTargetZAt } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
import { partSafetyUpperZAt } from './partSafetySurface';

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
 * Target Surface Truth owns machining intent: the cutter centre must lie on the
 * selected target. Complete Part Safety Truth owns cutter-footprint protection:
 * every projected part surface below the disk contributes its upper-envelope Z.
 * A disk sample outside the selected target is therefore not unresolved merely
 * because it crosses a face boundary. A sample with no projected part material
 * contributes no protected height. Genuine invalid geometry remains fail-closed.
 */
export function endMillRoughingSafetyAt(
  target:CurvedFaceTarget,
  partSafety:PartSafetySurface,
  x:number,
  y:number,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  sampleStepMm=.25,
):EndMillRoughingSafetyResult{
  if(!target.valid||!target.bounds)return{valid:false,safety:null,error:'Gekrümmte Zielfläche ist ungültig.'};
  if(!partSafety.valid||!partSafety.bounds)return{valid:false,safety:null,error:'Part Safety Truth ist ungültig.'};
  if(!(cutterRadiusMm>0))return{valid:false,safety:null,error:'Fräserradius muss größer als 0 sein.'};
  if(!(finishAllowanceMm>=0))return{valid:false,safety:null,error:'Schlichtaufmaß darf nicht negativ sein.'};
  if(!(sampleStepMm>0))return{valid:false,safety:null,error:'Abtastschritt muss größer als 0 sein.'};

  // Selection still owns machining intent. Part Safety must never expand the
  // operation centre domain beyond the selected target faces.
  const centerZ=curvedFaceTargetZAt(target,x,y);
  if(centerZ===null)return{valid:false,safety:null,error:'XY liegt außerhalb der ausgewählten Zielfläche.'};

  const step=Math.min(sampleStepMm,Math.max(.05,cutterRadiusMm/8));
  const samples=Math.max(1,Math.ceil((cutterRadiusMm*2)/step));
  let surfaceMaxZ=centerZ;

  for(let iy=0;iy<=samples;iy++){
    const dy=-cutterRadiusMm+(2*cutterRadiusMm*iy)/samples;
    for(let ix=0;ix<=samples;ix++){
      const dx=-cutterRadiusMm+(2*cutterRadiusMm*ix)/samples;
      if(dx*dx+dy*dy>cutterRadiusMm*cutterRadiusMm+EPS)continue;
      const partZ=partSafetyUpperZAt(partSafety,x+dx,y+dy);
      if(partZ!==null)surfaceMaxZ=Math.max(surfaceMaxZ,partZ);
    }
  }

  if(!Number.isFinite(surfaceMaxZ))return{valid:false,safety:null,error:'Für die Fräser-Stirnfläche konnte keine sichere 3D-Höhe bestimmt werden.'};

  return{
    valid:true,
    safety:{x,y,safeZ:surfaceMaxZ+finishAllowanceMm,surfaceMaxZ,finishAllowanceMm},
    error:null,
  };
}
