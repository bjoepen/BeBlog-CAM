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

function buildRowsForFeatureAdvice(
  match: StepToolMatch,
  adviceByIdentity: ReadonlyMap<string, StepCuttingAdvice[]>,
  resolvedAdvice: Set<StepCuttingAdvice>,
  proposals: readonly StepOperationProposal[],
  reviews: readonly ProposalReview[]
): StepAdvisorCandidateRow[] {
  const candidatesByIdentity = new Map<string, StepToolMatch['candidates']>();
  for (const candidate of match.candidates) {
    const key = identityKey(candidate.toolId, candidate.method);
    const candidates = candidatesByIdentity.get(key) ?? [];
    candidates.push(candidate);
    candidatesByIdentity.set(key, candidates);
  }
  return match.candidates.map(candidate => {
    const key = identityKey(candidate.toolId, candidate.method);
    const sameIdentityCandidates = candidatesByIdentity.get(key) ?? [];
    const sameIdentityAdvice = adviceByIdentity.get(key) ?? [];
    const exactAdvice = sameIdentityAdvice.filter(item =>
      item.toolName === candidate.toolName && item.status === 'conditional');
    const resolved = sameIdentityCandidates.length === 1 &&
      sameIdentityCandidates[0].toolName === candidate.toolName &&
      sameIdentityAdvice.length === 1 && exactAdvice.length === 1 &&
      Number.isFinite(exactAdvice[0].spindleRpm) && exactAdvice[0].spindleRpm > 0 &&
      Number.isFinite(exactAdvice[0].feedMmMin) && exactAdvice[0].feedMmMin > 0
        ? exactAdvice[0]
        : null;
    if (resolved) resolvedAdvice.add(resolved);
    const identityProposals = proposals.filter(item => item.featureId === match.featureId &&
      item.toolId === candidate.toolId && item.method === candidate.method);
    const exactProposals = identityProposals.filter(item => item.toolName === candidate.toolName &&
      resolved !== null && item.spindleRpm === resolved.spindleRpm && item.feedMmMin === resolved.feedMmMin);
    const proposal = identityProposals.length === 1 && exactProposals.length === 1 ? exactProposals[0] : null;
    const identityReviews = proposal ? reviews.filter(item => item.featureId === match.featureId &&
      item.toolId === candidate.toolId && item.method === candidate.method) : [];
    return {
      featureId: match.featureId, toolId: candidate.toolId, toolName: candidate.toolName,
      method: candidate.method, spindleRpm: resolved?.spindleRpm ?? null,
      feedMmMin: resolved?.feedMmMin ?? null,
      candidateReasons: [...candidate.reasons],
      adviceNotes: resolved ? [...resolved.notes] : [],
      proposal,
      proposalCautions: proposal ? [...new Set(proposal.cautions.filter(note =>
        !candidate.reasons.includes(note) && !(resolved?.notes.includes(note) ?? false)))]:[],
      review: identityReviews.length === 1 ? identityReviews[0] : null,
      proposalAmbiguous: identityProposals.length > 1 || (identityProposals.length === 1 && exactProposals.length !== 1) || identityReviews.length > 1
    };
  });
}

function indexAdviceByIdentity(advice: readonly StepCuttingAdvice[]): Map<string, StepCuttingAdvice[]> {
  const adviceByIdentity = new Map<string, StepCuttingAdvice[]>();
  for (const item of advice) {
    const key = identityKey(item.toolId, item.method);
    const values = adviceByIdentity.get(key) ?? [];
    values.push(item);
    adviceByIdentity.set(key, values);
  }
  return adviceByIdentity;
}

/** Builds display rows without guessing from array order or borrowing values.
 * Cutting values are exposed only for one unique, name-consistent identity.
 */
export function buildStepAdvisorCandidateRows(
  match: StepToolMatch,
  advice: readonly StepCuttingAdvice[],
  proposals: readonly StepOperationProposal[] = [],
  reviews: readonly ProposalReview[] = []
): StepAdvisorCandidateRow[] {
  const featureAdvice = advice.filter(item => item.featureId === match.featureId);
  return buildRowsForFeatureAdvice(match, indexAdviceByIdentity(featureAdvice), new Set(), proposals, reviews);
}

/** Prepares all detail-only data for one expanded feature in one pass. */
export function buildStepAdvisorFeatureDetails(
  featureId: string,
  matches: readonly StepToolMatch[],
  advice: readonly StepCuttingAdvice[],
  proposals: readonly StepOperationProposal[] = [],
  reviews: readonly ProposalReview[] = []
): StepAdvisorFeatureDetails {
  const featureMatches = matches.filter(match => match.featureId === featureId);
  const featureAdvice = advice.filter(item => item.featureId === featureId);
  const adviceByIdentity = indexAdviceByIdentity(featureAdvice);
  const resolvedAdvice = new Set<StepCuttingAdvice>();
  const featureProposals = proposals.filter(item => item.featureId === featureId);
  const matchRows = featureMatches.map(match => ({
    match,
    rows: buildRowsForFeatureAdvice(match, adviceByIdentity, resolvedAdvice, featureProposals, reviews)
  }));
  const represented = new Set(matchRows.flatMap(({ rows }) => rows
    .filter(row => row.proposal && !row.proposalAmbiguous)
    .map(row => row.proposal!)));
  return {
    matchRows,
    unresolvedAdvice: featureAdvice.filter(item => !resolvedAdvice.has(item)),
    unmatchedProposals: featureProposals.filter(item => !represented.has(item))
  };
}

/** One presentation card per current G1/G2 feature; recommendations are withheld
 * unless the overview has independently assessed that exact feature/context.
 */
export function buildStepAdvisorFeatureCards(
  overviewResult: StepAdvisorFeatureOverviewResult | null,
  matches: readonly StepToolMatch[],
  advice: readonly StepCuttingAdvice[],
  proposals: readonly StepOperationProposal[],
  reviews: readonly ProposalReview[]
): StepAdvisorFeatureCard[] {
  if (!overviewResult?.ok) return [];
  return overviewResult.overview.features.map(entry => ({
    featureId: entry.featureId,
    entry,
    details: entry.feasibility.status === 'assessed'
      ? buildStepAdvisorFeatureDetails(entry.featureId, matches, advice, proposals, reviews)
      : null
  }));
}
