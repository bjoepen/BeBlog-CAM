import type { AdvisorReport } from './advisorStepFeasibility';
import type { StepToolMatch } from './stepToolMatching';
import type { StepCuttingAdvice } from './stepCuttingAdvice';

/** 011-F3: display-only operation sketches, never executable operations. */
export type StepOperationProposal = {
  featureId: string;
  kind: 'drill';
  method: 'drill' | 'helical-mill';
  toolId: string;
  toolName: string;
  diameterMm: number;
  depthMm: number;
  status: 'conditional';
  spindleRpm: number;
  feedMmMin: number;
  cautions: string[];
};

export function proposeStepOperations(
  report: AdvisorReport | null,
  matches: readonly StepToolMatch[],
  advice: readonly StepCuttingAdvice[]
): StepOperationProposal[] {
  if (!report || report.status !== 'screened' ||
      !Array.isArray(matches) || !Array.isArray(advice)) return [];
  const result: StepOperationProposal[] = [];
  const uniqueFeatures = new Set<string>();
  for (const feature of report.features) {
    if (uniqueFeatures.has(feature.featureId)) return [];
    uniqueFeatures.add(feature.featureId);
    if (feature.kind !== 'hole' || !Number.isFinite(feature.diameterMm) ||
        !Number.isFinite(feature.depthMm) || !(feature.diameterMm! > 0) ||
        !(feature.depthMm! > 0)) continue;
    const matching = matches.filter(match => match.featureId === feature.featureId);
    if (matching.length !== 1 || matching[0].status !== 'conditional') continue;
    for (const candidate of matching[0].candidates) {
      const values = advice.filter(item => item.featureId === feature.featureId &&
        item.toolId === candidate.toolId && item.toolName === candidate.toolName &&
        item.method === candidate.method && item.status === 'conditional');
      if (values.length !== 1 || !Number.isFinite(values[0].spindleRpm) ||
          !Number.isFinite(values[0].feedMmMin) || values[0].spindleRpm <= 0 ||
          values[0].feedMmMin <= 0) continue;
      if (candidate.method !== 'drill' && candidate.method !== 'helical-mill') continue;
      result.push({
        featureId: feature.featureId, kind: 'drill', method: candidate.method,
        toolId: candidate.toolId, toolName: candidate.toolName,
        diameterMm: feature.diameterMm!, depthMm: feature.depthMm!,
        status: 'conditional', spindleRpm: values[0].spindleRpm,
        feedMmMin: values[0].feedMmMin,
        cautions: [...new Set([...feature.reasons, ...candidate.reasons, ...values[0].notes,
          'Nur Operationsvorschlag: Geometrie, Maschinenraum, Werkzeugweg und Preflight nicht freigegeben.'])]
      });
    }
  }
  return result;
}
