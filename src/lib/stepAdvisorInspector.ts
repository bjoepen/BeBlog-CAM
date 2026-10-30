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

/** Builds display rows without guessing from array order or borrowing values.
 * Cutting values are exposed only for one unique, name-consistent identity.
 */
export function buildStepAdvisorCandidateRows(
  match: StepToolMatch,
  advice: readonly StepCuttingAdvice[]
): StepAdvisorCandidateRow[] {
  return match.candidates.map(candidate => {
    const sameIdentityCandidates = match.candidates.filter(item =>
      item.toolId === candidate.toolId && item.method === candidate.method);
    const sameIdentityAdvice = advice.filter(item =>
      item.featureId === match.featureId && item.toolId === candidate.toolId &&
      item.method === candidate.method);
    const exactAdvice = sameIdentityAdvice.filter(item =>
      item.toolName === candidate.toolName && item.status === 'conditional');
    const resolved = sameIdentityCandidates.length === 1 &&
      sameIdentityCandidates[0].toolName === candidate.toolName &&
      sameIdentityAdvice.length === 1 && exactAdvice.length === 1 &&
      Number.isFinite(exactAdvice[0].spindleRpm) && exactAdvice[0].spindleRpm > 0 &&
      Number.isFinite(exactAdvice[0].feedMmMin) && exactAdvice[0].feedMmMin > 0
        ? exactAdvice[0]
        : null;
    return {
      featureId: match.featureId, toolId: candidate.toolId, toolName: candidate.toolName,
      method: candidate.method, spindleRpm: resolved?.spindleRpm ?? null,
      feedMmMin: resolved?.feedMmMin ?? null,
      candidateReasons: [...candidate.reasons],
      adviceNotes: resolved ? [...resolved.notes] : []
    };
  });
}
