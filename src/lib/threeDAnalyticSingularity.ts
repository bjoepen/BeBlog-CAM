import type { CurvedFaceDegeneracyCandidate } from './curvedFaceTarget';
import type { DegeneracyProof } from './threeDDegeneracyClassification';
import type { P3 } from './stepView';

export type PlacedSphereSemantics={
  center:P3;
  axisDirection:P3;
  radiusMm:number;
};

function distance3(a:P3,b:P3){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}

export function proveAnalyticSpherePole(
  candidate:CurvedFaceDegeneracyCandidate,
  sphere:PlacedSphereSemantics,
  tolerance=1e-6,
):DegeneracyProof|null{
  if(!Number.isFinite(sphere.radiusMm)||sphere.radiusMm<=0)return null;
  const axisLength=Math.hypot(sphere.axisDirection.x,sphere.axisDirection.y,sphere.axisDirection.z);
  if(!Number.isFinite(axisLength)||Math.abs(axisLength-1)>tolerance)return null;
  const poles=[
    {x:sphere.center.x+sphere.axisDirection.x*sphere.radiusMm,y:sphere.center.y+sphere.axisDirection.y*sphere.radiusMm,z:sphere.center.z+sphere.axisDirection.z*sphere.radiusMm},
    {x:sphere.center.x-sphere.axisDirection.x*sphere.radiusMm,y:sphere.center.y-sphere.axisDirection.y*sphere.radiusMm,z:sphere.center.z-sphere.axisDirection.z*sphere.radiusMm},
  ];
  const points=[candidate.triangle.a,candidate.triangle.b,candidate.triangle.c];
  const matches=poles.filter(pole=>points.filter(vertex=>distance3(vertex,pole)<=tolerance).length>=2);
  if(matches.length!==1)return null;
  return{
    kind:'surface-singularity',
    candidate:{faceId:candidate.faceId,triangleIndex:candidate.triangleIndex},
    candidatePoints:points.map(vertex=>({...vertex})),
    authority:'analytic-sphere-pole',
    singularityPoint:{...matches[0]},
  };
}
