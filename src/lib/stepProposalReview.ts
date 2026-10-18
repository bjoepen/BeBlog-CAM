import type { StepOperationProposal } from './stepOperationProposals';

export type ProposalReview = {
  featureId: string;
  toolId: string;
  method: StepOperationProposal['method'];
  status: 'requires-review';
  checks: Array<{ label: string; status: 'open'; reason: string }>;
};

/** 011-F4: explicitly surface unresolved production checks.
 * No checks are marked passed without machine/toolpath evidence.
 */
export function reviewStepProposals(proposals: readonly StepOperationProposal[]): ProposalReview[] {
  if (!Array.isArray(proposals)) return [];
  const reviews: ProposalReview[] = [];
  const seen = new Set<string>();
  for (const proposal of proposals) {
    if (proposal.status !== 'conditional' ||
        (proposal.method !== 'drill' && proposal.method !== 'helical-mill') ||
        !proposal.featureId || !proposal.toolId || !proposal.toolName ||
        !Number.isFinite(proposal.diameterMm) || proposal.diameterMm <= 0 ||
        !Number.isFinite(proposal.depthMm) || proposal.depthMm <= 0 ||
        !Number.isFinite(proposal.spindleRpm) || proposal.spindleRpm <= 0 ||
        !Number.isFinite(proposal.feedMmMin) || proposal.feedMmMin <= 0) return [];
    const key = JSON.stringify([proposal.featureId, proposal.toolId, proposal.method]);
    if (seen.has(key)) return [];
    seen.add(key);
    const checks: ProposalReview['checks'] = [
      { label: 'Werkzeug und Schneidenlänge', status: 'open', reason: 'Reale Werkzeuggeometrie und Auskragung noch nicht nachgewiesen.' },
      { label: 'Maschine und Spannmittel', status: 'open', reason: 'Arbeitsraum, Spindelgrenzen und Kollisionen nicht geprüft.' },
      { label: 'Schnittdaten und Zustellung', status: 'open', reason: 'Richtwerte sind keine freigegebenen Bearbeitungsparameter.' },
      { label: 'Werkzeugweg und Preflight', status: 'open', reason: 'Kein Werkzeugweg erzeugt oder durch den Produktions-Preflight geprüft.' },
      ...(proposal.method === 'helical-mill'
        ? [{ label: 'Helix-Eintritt', status: 'open' as const, reason: 'Helixradius, Steigung, Freiraum und Eintauchfähigkeit nicht geprüft.' }]
        : [{ label: 'Bohrvorgang', status: 'open' as const, reason: 'Bohrerspitze, Spanabfuhr und Eintauchvorschub nicht geprüft.' }])
    ];
    reviews.push({ featureId: proposal.featureId, toolId: proposal.toolId,
      method: proposal.method, status: 'requires-review', checks });
  }
  return reviews;
}
