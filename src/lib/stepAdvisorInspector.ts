import type { StepCuttingAdvice } from './stepCuttingAdvice';
import type { StepToolMatch } from './stepToolMatching';

export type StepAdvisorCandidateRow = {
  featureId: string;
  toolId: string;
  toolName: string;
  method: 'drill' | 'helical-mill';
  spindleRpm: number | null;
  feedMmMin: number | null;
  candidateReasons: string[];
  adviceNotes: string[];
};

export type StepAdvisorMatchRows = {
  match: StepToolMatch;
  rows: StepAdvisorCandidateRow[];
};

export type StepAdvisorFeatureDetails = {
  matchRows: StepAdvisorMatchRows[];
  unresolvedAdvice: StepCuttingAdvice[];
};

const identityKey = (toolId: string, method: string) => `${toolId}\u0000${method}`;

function buildRowsForFeatureAdvice(
  match: StepToolMatch,
  adviceByIdentity: ReadonlyMap<string, StepCuttingAdvice[]>,
  resolvedAdvice: Set<StepCuttingAdvice>
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
    return {
      featureId: match.featureId, toolId: candidate.toolId, toolName: candidate.toolName,
      method: candidate.method, spindleRpm: resolved?.spindleRpm ?? null,
      feedMmMin: resolved?.feedMmMin ?? null,
      candidateReasons: [...candidate.reasons],
      adviceNotes: resolved ? [...resolved.notes] : []
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
  advice: readonly StepCuttingAdvice[]
): StepAdvisorCandidateRow[] {
  const featureAdvice = advice.filter(item => item.featureId === match.featureId);
  return buildRowsForFeatureAdvice(match, indexAdviceByIdentity(featureAdvice), new Set());
}

/** Prepares all detail-only data for one expanded feature in one pass. */
export function buildStepAdvisorFeatureDetails(
  featureId: string,
  matches: readonly StepToolMatch[],
  advice: readonly StepCuttingAdvice[]
): StepAdvisorFeatureDetails {
  const featureMatches = matches.filter(match => match.featureId === featureId);
  const featureAdvice = advice.filter(item => item.featureId === featureId);
  const adviceByIdentity = indexAdviceByIdentity(featureAdvice);
  const resolvedAdvice = new Set<StepCuttingAdvice>();
  const matchRows = featureMatches.map(match => ({
    match,
    rows: buildRowsForFeatureAdvice(match, adviceByIdentity, resolvedAdvice)
  }));
  return {
    matchRows,
    unresolvedAdvice: featureAdvice.filter(item => !resolvedAdvice.has(item))
  };
}
