import type { P3 } from './stepView';

export type DegeneracyClassification=
  |'BOUNDARY'
  |'SURFACE_SINGULARITY'
  |'INVALID_FOR_HEIGHTFIELD'
  |'UNRESOLVED';

export type DegeneracyCandidateIdentity={faceId:number;triangleIndex:number};

export type DegeneracyProof=
  |{kind:'boundary';candidate:DegeneracyCandidateIdentity;candidatePoints:P3[];wireId:number;edgeId:number}
  |{kind:'surface-singularity';candidate:DegeneracyCandidateIdentity;candidatePoints:P3[];edgeId:number;degeneratedPoint:P3}
  |{kind:'invalid-for-heightfield';candidate:DegeneracyCandidateIdentity;candidatePoints:P3[];reason:string};

export type DegeneracyClassificationResult={
  classification:DegeneracyClassification;
  proof:DegeneracyProof|null;
  reason:string;
};

/**
 * 008H-A24-A2b2 classification boundary.
 *
 * This function does not discover geometry. It only turns one already proven,
 * concrete BRep fact into the corresponding classification. Producers of a
 * proof remain responsible for establishing that fact from their authoritative
 * source (A20/A23 boundary truth, future exact singularity proof, or existing
 * heightfield ambiguity truth).
 *
 * No proof, multiple proofs, or contradictory proofs are UNRESOLVED.
 */
export function classifyProvenDegeneracy(
  proofs:DegeneracyProof[],
):DegeneracyClassificationResult{
  const sameCandidate=proofs.length>0&&proofs.every(proof=>
    proof.candidate.faceId===proofs[0].candidate.faceId
    &&proof.candidate.triangleIndex===proofs[0].candidate.triangleIndex
  );
  if(proofs.length!==1||!sameCandidate){
    return{
      classification:'UNRESOLVED',
      proof:null,
      reason:proofs.length===0
        ?'Keine eindeutige native BRep-Klassifikation für den XY-degenerierten Kandidaten bewiesen.'
        :'Mehrere konkurrierende Degeneracy-Beweise für denselben Kandidaten; Klassifikation bleibt fail-closed.',
    };
  }

  const proof=proofs[0];
  if(proof.kind==='boundary')return{
    classification:'BOUNDARY',
    proof,
    reason:'Der konkrete Kandidat ist durch die autoritative BRep-Boundary-Semantik bewiesen.',
  };
  if(proof.kind==='surface-singularity')return{
    classification:'SURFACE_SINGULARITY',
    proof,
    reason:'Der konkrete Kandidat ist durch explizite native BRep-Singularitätssemantik bewiesen.',
  };
  return{
    classification:'INVALID_FOR_HEIGHTFIELD',
    proof,
    reason:proof.reason,
  };
}
