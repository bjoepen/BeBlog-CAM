import type { StepCuttingAdvice } from './stepCuttingAdvice';
import type { StepToolMatch } from './stepToolMatching';
import type { StepOperationProposal } from './stepOperationProposals';
import type { ProposalReview } from './stepProposalReview';
import type { StepAdvisorFeatureOverviewEntry, StepAdvisorFeatureOverviewResult } from './stepAdvisorFeatureOverview';

export type StepAdvisorCandidateRow = {
  featureId: string;
  toolId: string;
  toolName: string;
  method: 'drill' | 'helical-mill';
  spindleRpm: number | null;
  feedMmMin: number | null;
  candidateReasons: string[];
  adviceNotes: string[];
  proposal: StepOperationProposal | null;
  proposalCautions: string[];
  review: ProposalReview | null;
  proposalAmbiguous: boolean;
};

export type StepAdvisorMatchRows = {
  match: StepToolMatch;
  rows: StepAdvisorCandidateRow[];
};

export type StepAdvisorFeatureDetails = {
  matchRows: StepAdvisorMatchRows[];
  unresolvedAdvice: StepCuttingAdvice[];
  unmatchedProposals: StepOperationProposal[];
};

export type StepAdvisorFeatureCard = Readonly<{
  featureId: string;
  entry: StepAdvisorFeatureOverviewEntry;
  details: StepAdvisorFeatureDetails | null;
}>;

const identityKey = (toolId: string, method: string) => `${toolId}\u0000${method}`;
type IdentityBearing = {featureId:string;toolId:string;method:string};
type FeatureIdentityIndex<T> = Map<string,Map<string,T[]>>;
type InspectorInputIndex = Readonly<{
  matchesByFeature:Map<string,StepToolMatch[]>;
  adviceByFeature:Map<string,StepCuttingAdvice[]>;
  adviceByFeatureIdentity:FeatureIdentityIndex<StepCuttingAdvice>;
  proposalsByFeature:Map<string,StepOperationProposal[]>;
  proposalsByFeatureIdentity:FeatureIdentityIndex<StepOperationProposal>;
  reviewsByFeatureIdentity:FeatureIdentityIndex<ProposalReview>;
}>;

function addGrouped<T>(index:Map<string,T[]>,key:string,value:T){
  const values=index.get(key);
  if(values)values.push(value);else index.set(key,[value]);
}

function addFeatureIdentity<T extends IdentityBearing>(index:FeatureIdentityIndex<T>,value:T){
  let identities=index.get(value.featureId);
  if(!identities){identities=new Map();index.set(value.featureId,identities);}
  addGrouped(identities,identityKey(value.toolId,value.method),value);
}

/** Indexes each incoming list once per reactive presentation update. Buckets
 * retain insertion order and duplicates so downstream ambiguity checks fail closed.
 */
function indexInspectorInputs(
  matches:readonly StepToolMatch[],
  advice:readonly StepCuttingAdvice[],
  proposals:readonly StepOperationProposal[],
  reviews:readonly ProposalReview[]
):InspectorInputIndex{
  const matchesByFeature=new Map<string,StepToolMatch[]>(),adviceByFeature=new Map<string,StepCuttingAdvice[]>(),proposalsByFeature=new Map<string,StepOperationProposal[]>(),adviceByFeatureIdentity:FeatureIdentityIndex<StepCuttingAdvice>=new Map(),proposalsByFeatureIdentity:FeatureIdentityIndex<StepOperationProposal>=new Map(),reviewsByFeatureIdentity:FeatureIdentityIndex<ProposalReview>=new Map();
  for(const match of matches)addGrouped(matchesByFeature,match.featureId,match);
  for(const item of advice){addGrouped(adviceByFeature,item.featureId,item);addFeatureIdentity(adviceByFeatureIdentity,item);}
  for(const item of proposals){addGrouped(proposalsByFeature,item.featureId,item);addFeatureIdentity(proposalsByFeatureIdentity,item);}
  for(const item of reviews)addFeatureIdentity(reviewsByFeatureIdentity,item);
  return{matchesByFeature,adviceByFeature,adviceByFeatureIdentity,proposalsByFeature,proposalsByFeatureIdentity,reviewsByFeatureIdentity};
}

function rowsForMatch(
  match:StepToolMatch,
  adviceByIdentity:ReadonlyMap<string,StepCuttingAdvice[]>,
  proposalsByIdentity:ReadonlyMap<string,StepOperationProposal[]>,
  reviewsByIdentity:ReadonlyMap<string,ProposalReview[]>,
  resolvedAdvice:Set<StepCuttingAdvice>
):StepAdvisorCandidateRow[]{
  const candidatesByIdentity=new Map<string,StepToolMatch['candidates']>();
  for(const candidate of match.candidates){
    const key=identityKey(candidate.toolId,candidate.method),candidates=candidatesByIdentity.get(key);
    if(candidates)candidates.push(candidate);else candidatesByIdentity.set(key,[candidate]);
  }
  return match.candidates.map(candidate=>{
    const key=identityKey(candidate.toolId,candidate.method),sameIdentityCandidates=candidatesByIdentity.get(key)??[];
    const sameIdentityAdvice=adviceByIdentity.get(key)??[];
    const exactAdvice=sameIdentityAdvice.filter(item=>item.toolName===candidate.toolName&&item.status==='conditional');
    const resolved=sameIdentityCandidates.length===1&&sameIdentityCandidates[0].toolName===candidate.toolName&&sameIdentityAdvice.length===1&&exactAdvice.length===1&&Number.isFinite(exactAdvice[0].spindleRpm)&&exactAdvice[0].spindleRpm>0&&Number.isFinite(exactAdvice[0].feedMmMin)&&exactAdvice[0].feedMmMin>0?exactAdvice[0]:null;
    if(resolved)resolvedAdvice.add(resolved);
    const identityProposals=proposalsByIdentity.get(key)??[];
    const exactProposals=identityProposals.filter(item=>item.toolName===candidate.toolName&&resolved!==null&&item.spindleRpm===resolved.spindleRpm&&item.feedMmMin===resolved.feedMmMin);
    const proposal=identityProposals.length===1&&exactProposals.length===1?exactProposals[0]:null;
    const identityReviews=proposal?(reviewsByIdentity.get(key)??[]):[];
    return{
      featureId:match.featureId,toolId:candidate.toolId,toolName:candidate.toolName,method:candidate.method,
      spindleRpm:resolved?.spindleRpm??null,feedMmMin:resolved?.feedMmMin??null,
      candidateReasons:[...candidate.reasons],adviceNotes:resolved?[...resolved.notes]:[],proposal,
      proposalCautions:proposal?[...new Set(proposal.cautions.filter(note=>!candidate.reasons.includes(note)&&!(resolved?.notes.includes(note)??false)))]:[],
      review:identityReviews.length===1?identityReviews[0]:null,
      proposalAmbiguous:identityProposals.length>1||(identityProposals.length===1&&exactProposals.length!==1)||identityReviews.length>1
    };
  });
}

function buildFeatureDetails(featureId:string,index:InspectorInputIndex):StepAdvisorFeatureDetails{
  const featureMatches=index.matchesByFeature.get(featureId)??[],featureAdvice=index.adviceByFeature.get(featureId)??[],featureProposals=index.proposalsByFeature.get(featureId)??[];
  const adviceByIdentity=index.adviceByFeatureIdentity.get(featureId)??new Map(),proposalsByIdentity=index.proposalsByFeatureIdentity.get(featureId)??new Map(),reviewsByIdentity=index.reviewsByFeatureIdentity.get(featureId)??new Map(),resolvedAdvice=new Set<StepCuttingAdvice>();
  const matchRows=featureMatches.map(match=>({match,rows:rowsForMatch(match,adviceByIdentity,proposalsByIdentity,reviewsByIdentity,resolvedAdvice)}));
  const represented=new Set(matchRows.flatMap(({rows})=>rows.filter(row=>row.proposal&&!row.proposalAmbiguous).map(row=>row.proposal!)));
  return{matchRows,unresolvedAdvice:featureAdvice.filter(item=>!resolvedAdvice.has(item)),unmatchedProposals:featureProposals.filter(item=>!represented.has(item))};
}

/** Builds display rows without guessing from array order or borrowing values.
 * Cutting values are exposed only for one unique, name-consistent identity.
 */
export function buildStepAdvisorCandidateRows(
  match:StepToolMatch,
  advice:readonly StepCuttingAdvice[],
  proposals:readonly StepOperationProposal[]=[],
  reviews:readonly ProposalReview[]=[]
):StepAdvisorCandidateRow[]{
  const index=indexInspectorInputs([match],advice,proposals,reviews);
  const identities=index.adviceByFeatureIdentity.get(match.featureId)??new Map(),proposalIdentities=index.proposalsByFeatureIdentity.get(match.featureId)??new Map(),reviewIdentities=index.reviewsByFeatureIdentity.get(match.featureId)??new Map();
  return rowsForMatch(match,identities,proposalIdentities,reviewIdentities,new Set());
}

/** Prepares all presentation data for one feature from a single-pass input index. */
export function buildStepAdvisorFeatureDetails(
  featureId:string,
  matches:readonly StepToolMatch[],
  advice:readonly StepCuttingAdvice[],
  proposals:readonly StepOperationProposal[]=[],
  reviews:readonly ProposalReview[]=[]
):StepAdvisorFeatureDetails{return buildFeatureDetails(featureId,indexInspectorInputs(matches,advice,proposals,reviews));}

/** One presentation card per current G1/G2 feature; recommendations are withheld
 * unless the overview has independently assessed that exact feature/context.
 */
export function buildStepAdvisorFeatureCards(
  overviewResult:StepAdvisorFeatureOverviewResult|null,
  matches:readonly StepToolMatch[],
  advice:readonly StepCuttingAdvice[],
  proposals:readonly StepOperationProposal[],
  reviews:readonly ProposalReview[]
):StepAdvisorFeatureCard[]{
  if(!overviewResult?.ok)return[];
  const index=indexInspectorInputs(matches,advice,proposals,reviews);
  return overviewResult.overview.features.map(entry=>({featureId:entry.featureId,entry,details:entry.feasibility.status==='assessed'?buildFeatureDetails(entry.featureId,index):null}));
}
