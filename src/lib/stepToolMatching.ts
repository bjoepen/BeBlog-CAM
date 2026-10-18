import type { AdvisorReport, AdvisorStrategy } from './advisorStepFeasibility';
import type { MillingTool } from './toolTypes';
import { isMillingTool } from './toolTypes';

export type StepToolMatch = {
  featureId: string;
  status: 'conditional' | 'none';
  candidates: Array<{ toolId: string; toolName: string; method: AdvisorStrategy['method']; reasons: string[] }>;
  reasons: string[];
};

/** 011-F1: read-only candidates from the existing STEP feasibility screen.
 * Never elevate a conditional strategy to a production-ready recommendation.
 * No geometry inference, operation mutations, or NC output.
 */
export function matchStepTools(report: AdvisorReport | null, tools: readonly MillingTool[], libraryReady: boolean): StepToolMatch[] {
  if (!libraryReady || !report || report.status !== 'screened' || !Array.isArray(tools) ||
      !tools.every(isMillingTool) || new Set(tools.map(t => t.id)).size !== tools.length) return [];
  const available = new Map(tools.map(tool => [tool.id, tool]));
  return report.features.map(feature => {
    if (feature.kind !== 'hole') return {
      featureId: feature.featureId, status: 'none' as const, candidates: [],
      reasons: ['Geometrie nicht als Bohrung klassifiziert; keine Werkzeugzuordnung.']
    };
    const candidates = feature.strategies
      .filter(strategy => strategy.status === 'conditional' || strategy.status === 'candidate')
      .filter(strategy => available.get(strategy.toolId)?.name === strategy.toolName)
      .map(strategy => ({
        toolId: strategy.toolId, toolName: strategy.toolName, method: strategy.method,
        reasons: [...strategy.reasons]
      }))
      .sort((a,b) => (a.method === 'drill' ? 0 : 1) - (b.method === 'drill' ? 0 : 1) ||
        a.toolName.localeCompare(b.toolName, 'de') || a.toolId.localeCompare(b.toolId));
    return {
      featureId: feature.featureId, status: candidates.length ? 'conditional' as const : 'none' as const,
      candidates, reasons: candidates.length ? [] : [...feature.reasons, 'Kein aktuell validiertes Werkzeug mit bestehender Strategie gefunden.']
    };
  });
}
