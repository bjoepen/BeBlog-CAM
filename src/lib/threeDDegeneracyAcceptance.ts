import type { CurvedFaceDegeneracyCandidate } from './curvedFaceTarget';
import type { DegeneracyClassificationResult } from './threeDDegeneracyClassification';

export type ThreeDDegeneracyAcceptanceEntry={
  faceId:number;
  triangleIndex:number;
  classification:DegeneracyClassificationResult['classification'];
  proofKind:'boundary'|'surface-singularity'|'invalid-for-heightfield'|null;
  reason:string;
};

export type ThreeDDegeneracyAcceptanceSnapshot={
  candidateCount:number;
  acceptedCount:number;
  rejectedCount:number;
  classifications:Record<DegeneracyClassificationResult['classification'],number>;
  entries:ThreeDDegeneracyAcceptanceEntry[];
};

export function buildThreeDDegeneracyAcceptanceSnapshot(
  candidates:CurvedFaceDegeneracyCandidate[],
  classifications:Map<number,DegeneracyClassificationResult>,
):ThreeDDegeneracyAcceptanceSnapshot{
  const counts:ThreeDDegeneracyAcceptanceSnapshot['classifications']={
    BOUNDARY:0,
    SURFACE_SINGULARITY:0,
    INVALID_FOR_HEIGHTFIELD:0,
    UNRESOLVED:0,
  };
  const entries=candidates.map(candidate=>{
    const classification=classifications.get(candidate.triangleIndex);
    const identityMatches=classification?.proof?.candidate.faceId===candidate.faceId
      &&classification?.proof?.candidate.triangleIndex===candidate.triangleIndex;
    const resolved=classification&&identityMatches
      ?classification
      :{classification:'UNRESOLVED' as const,proof:null,reason:classification?'Proof gehört nicht zum konkreten Display-Kandidaten.':'Keine Klassifikation geliefert.'};
    counts[resolved.classification]++;
    return{
      faceId:candidate.faceId,
      triangleIndex:candidate.triangleIndex,
      classification:resolved.classification,
      proofKind:resolved.proof?.kind??null,
      reason:resolved.reason,
    };
  });
  const acceptedCount=counts.BOUNDARY+counts.SURFACE_SINGULARITY;
  return{
    candidateCount:entries.length,
    acceptedCount,
    rejectedCount:entries.length-acceptedCount,
    classifications:counts,
    entries,
  };
}

export function emitThreeDDegeneracyAcceptanceSnapshot(input:{
  operationLabel:string;
  snapshot:ThreeDDegeneracyAcceptanceSnapshot;
}){
  if(!input.snapshot.candidateCount)return;
  console.info('[008H-A24-A4][3D-degeneracy-acceptance]',input);
}
