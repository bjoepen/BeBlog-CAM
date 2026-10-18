<script lang="ts">
  import type { AdvisorReport } from './advisorStepFeasibility';
  import type { StepToolMatch } from './stepToolMatching';
  import type { StepCuttingAdvice } from './stepCuttingAdvice';
  import type { StepOperationProposal } from './stepOperationProposals';
  import type { ProposalReview } from './stepProposalReview';
  export let report: AdvisorReport | null = null;
  export let reason: string | null = null;
  export let toolCount = 0;
  export let matches: StepToolMatch[] = [];
  export let cuttingAdvice: StepCuttingAdvice[] = [];
  export let operationProposals: StepOperationProposal[] = [];
  export let proposalReviews: ProposalReview[] = [];
  let expandedFeatureIds: string[] = [];
  const toggleFeature = (id: string) => {
    expandedFeatureIds = expandedFeatureIds.includes(id)
      ? expandedFeatureIds.filter(value => value !== id)
      : [...expandedFeatureIds, id];
  };
</script>

<section class="placement-section" aria-label="STEP CAM Advisor Vorprüfung">
  <p class="placement-title">CAM Advisor · STEP-Vorprüfung (011-E5B)</p>
  <p class="note">Nur lesende Einschätzung erkannter Bohrungen. Keine Bearbeitung wird erzeugt, geändert oder freigegeben; keine NC-Ausgabe.</p>
  {#if !reason && toolCount === 0}<p class="note"><strong>Werkzeuge:</strong> Keine vollständig validierten Bibliotheksdatensätze im aktuellen Job verfügbar. Es werden keine Werkzeugstrategien als geeignet angenommen.</p>{/if}
  {#if reason}
    <p class="note"><strong>Nicht verfügbar:</strong> {reason}</p>
  {:else if report}
    <p class="note"><strong>Status:</strong> {report.status === 'screened' ? 'Vorprüfung durchgeführt' : 'Nicht verfügbar'} · <strong>Features:</strong> {report.features.length}</p>
    <p class="note"><strong>011-F1 · Werkzeugabgleich:</strong> Nur bedingte Kandidaten aus der bestehenden STEP-Vorprüfung. Reihenfolge ist keine Eignungsrangliste. Keine automatische Werkzeugzuweisung.</p>
    <p class="note"><strong>011-F2 · Schnittdaten:</strong> Rechnerische Startwerte nach Materialprofil, keine automatische Übernahme oder Freigabe.</p>
    <p class="note"><strong>011-F3 · Operationsvorschläge:</strong> Nur lesende Entwürfe, keine Erzeugung oder Änderung von Bearbeitungen.</p>
    <p class="note"><strong>011-F4 · Offene Prüfungen:</strong> Alle Prüfpunkte bleiben ohne realen Werkzeugweg und Produktions-Preflight offen.</p>
    <p class="note"><strong>011-F5 · Übersicht:</strong> Vorschläge und offene Prüfungen pro Feature. Details lassen sich einzeln aufklappen.</p>
    {#each report.features as feature (feature.featureId)}
      <div class="note advisor-feature-card">
        <div class="advisor-feature-header">
          <span class="advisor-feature-symbol" aria-hidden="true">{feature.kind === 'hole' ? '◎' : '?'}</span>
          <div class="advisor-feature-heading">
            <strong>{feature.kind === 'hole' ? 'Bohrung' : 'Nicht klassifizierter Zylinder'} · {feature.featureId}</strong>
            <span>{feature.diameterMm != null && Number.isFinite(feature.diameterMm) ? `Ø ${feature.diameterMm.toFixed(2)} mm` : 'Ø unbekannt'} · {feature.depthMm != null && Number.isFinite(feature.depthMm) ? `Tiefe ${feature.depthMm.toFixed(2)} mm` : 'Tiefe unbekannt'}</span>
            <span>{operationProposals.filter(proposal => proposal.featureId === feature.featureId).length} bedingte Vorschläge · keine Freigabe</span>
          </div>
          <button type="button" class="advisor-details-toggle" aria-expanded={expandedFeatureIds.includes(feature.featureId)} onclick={() => toggleFeature(feature.featureId)}>{expandedFeatureIds.includes(feature.featureId) ? 'Details schließen' : 'Details anzeigen'}</button>
        </div>
        {#if expandedFeatureIds.includes(feature.featureId)}
        <strong>{feature.kind === 'hole' ? 'Bohrung' : 'Nicht klassifizierter Zylinder'} · {feature.featureId}</strong>
        <span> — {feature.coverage}</span>
        {#if feature.diameterMm != null}<span> · Ø {feature.diameterMm.toFixed(2)} mm</span>{/if}
        {#if feature.depthMm != null}<span> · Tiefe {feature.depthMm.toFixed(2)} mm</span>{/if}
        {#each feature.strategies as strategy}
          <p>{strategy.method === 'drill' ? 'Bohren' : 'Helixfräsen'} · {strategy.toolName} · {strategy.status === 'conditional' ? 'bedingt' : 'Kandidat'}</p>
          {#each strategy.reasons as message}<p>{message}</p>{/each}
        {/each}
        {#each matches.filter(match => match.featureId === feature.featureId) as match}
          <p><strong>Bibliotheksabgleich:</strong> {match.candidates.length} bedingte Werkzeug-/Strategiekombinationen</p>
          {#each match.candidates as candidate}
            <p>· {candidate.toolName} ({candidate.method === 'drill' ? 'Bohren' : 'Helixfräsen'}) – nur zur Prüfung, keine Freigabe</p>
          {/each}
          {#each match.reasons as message}<p>{message}</p>{/each}
          {#each cuttingAdvice.filter(advice => advice.featureId === match.featureId) as advice}
            <p><strong>Schnittdaten-Richtwert:</strong> {advice.method === 'drill' ? 'Bohren' : 'Helixfräsen'} · Werkzeug {advice.toolName} ({advice.toolId}) · {advice.spindleRpm.toFixed(0)} U/min · {advice.feedMmMin.toFixed(0)} mm/min (bedingt)</p>
            {#each advice.notes as note}<p>{note}</p>{/each}
          {/each}
        {/each}
        {#each operationProposals.filter(proposal => proposal.featureId === feature.featureId) as proposal}
          <p><strong>Operationsvorschlag (bedingt):</strong> {proposal.method === 'drill' ? 'Bohren' : 'Helixfräsen'} · {proposal.toolName} ({proposal.toolId}) · Ø {proposal.diameterMm.toFixed(2)} mm · Tiefe {proposal.depthMm.toFixed(2)} mm · {proposal.spindleRpm.toFixed(0)} U/min · {proposal.feedMmMin.toFixed(0)} mm/min</p>
          {#each proposalReviews.filter(review => review.featureId === proposal.featureId && review.toolId === proposal.toolId && review.method === proposal.method) as review}
            <p><strong>Prüfstatus:</strong> Freigabe ausstehend · {review.checks.length} offene Punkte</p>
            {#each review.checks as check}<p>Offen · {check.label}: {check.reason}</p>{/each}
          {/each}
          {#each proposal.cautions as caution}<p>{caution}</p>{/each}
        {/each}
        {#each feature.reasons as message}<p>{message}</p>{/each}
        {/if}
      </div>
    {/each}
    {#each report.notes as note}<p class="note">{note}</p>{/each}
  {/if}
</section>

<style>
  .advisor-feature-card { border: 1px solid var(--border, #8b8b8b); border-radius: 0.65rem; padding: 0.8rem; margin: 0.7rem 0; }
  .advisor-feature-header { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; }
  .advisor-feature-symbol { font-size: 1.8rem; line-height: 1; opacity: 0.8; }
  .advisor-feature-heading { display: grid; gap: 0.2rem; flex: 1 1 12rem; min-width: 0; }
  .advisor-feature-heading span { font-size: 0.9rem; }
  .advisor-details-toggle { cursor: pointer; padding: 0.4rem 0.65rem; }
</style>
