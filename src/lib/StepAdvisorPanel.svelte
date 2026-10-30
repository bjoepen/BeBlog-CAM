<script lang="ts">
  import type { AdvisorReport } from './advisorStepFeasibility';
  import type { StepToolMatch } from './stepToolMatching';
  import type { StepCuttingAdvice } from './stepCuttingAdvice';
  import type { StepOperationProposal } from './stepOperationProposals';
  import type { ProposalReview } from './stepProposalReview';
  import { toggleExpandedFeature } from './stepAdvisorDisclosure';
  import { buildStepAdvisorFeatureDetails } from './stepAdvisorInspector';
  // The display helper verifies candidate.toolName against advice.toolName in addition to identity fields.

  export let report: AdvisorReport | null = null;
  export let reason: string | null = null;
  export let toolCount = 0;
  export let matches: StepToolMatch[] = [];
  export let cuttingAdvice: StepCuttingAdvice[] = [];
  export let operationProposals: StepOperationProposal[] = [];
  export let proposalReviews: ProposalReview[] = [];
  let expandedFeatureIds: string[] = [];
  const toggleFeature = (id: string) => { expandedFeatureIds = toggleExpandedFeature(expandedFeatureIds, id); };
</script>

<section class="placement-section advisor-inspector" aria-label="STEP CAM Advisor Vorprüfung">
  <p class="placement-title">CAM Advisor · STEP-Vorprüfung (011-E5B)</p>
  <div class="advisor-notice advisor-notice-general"><strong>Nur lesende Vorprüfung</strong><p>Keine Bearbeitung wird erzeugt, geändert oder freigegeben; keine NC-Ausgabe. Kandidaten, Richtwerte und Vorschläge sind stets bedingt.</p></div>
  {#if !reason && toolCount === 0}<div class="advisor-notice advisor-notice-warning"><strong>Werkzeuge nicht verfügbar</strong><p>Keine vollständig validierten Bibliotheksdatensätze im aktuellen Job. Es werden keine Werkzeugstrategien als geeignet angenommen.</p></div>{/if}
  {#if reason}
    <div class="advisor-notice advisor-notice-warning"><strong>Nicht verfügbar</strong><p>{reason}</p></div>
  {:else if report}
    <p class="advisor-summary"><strong>Status:</strong> {report.status === 'screened' ? 'Vorprüfung durchgeführt' : 'Nicht verfügbar'} · <strong>Features:</strong> {report.features.length}</p>
    <p class="advisor-context">Werkzeugabgleich, Schnittdaten und Operationsentwürfe dienen nur der Prüfung: keine automatische Übernahme oder Freigabe. Alle Produktionsprüfungen bleiben ohne realen Werkzeugweg und Preflight offen.</p>
    {#each report.features as feature (feature.featureId)}
      {@const featureProposals = operationProposals.filter(proposal => proposal.featureId === feature.featureId)}
      <article class="advisor-feature-card">
        <header class="advisor-feature-header">
          <span class="advisor-feature-symbol" aria-hidden="true">{feature.kind === 'hole' ? '◎' : '?'}</span>
          <div class="advisor-feature-heading">
            <strong>{feature.kind === 'hole' ? 'Bohrung' : 'Nicht klassifizierter Zylinder'} · {feature.featureId}</strong>
            <span>{feature.diameterMm != null && Number.isFinite(feature.diameterMm) ? `Ø ${feature.diameterMm.toFixed(2)} mm` : 'Ø unbekannt'} · {feature.depthMm != null && Number.isFinite(feature.depthMm) ? `Tiefe ${feature.depthMm.toFixed(2)} mm` : 'Tiefe unbekannt'}</span>
            <span>{featureProposals.length} bedingte Vorschläge · keine Freigabe</span>
          </div>
          <button type="button" class="advisor-details-toggle" aria-expanded={expandedFeatureIds.includes(feature.featureId)} aria-controls={`advisor-feature-${feature.featureId}`} onclick={() => toggleFeature(feature.featureId)}>{expandedFeatureIds.includes(feature.featureId) ? 'Details schließen' : 'Details anzeigen'}</button>
        </header>
        {#if expandedFeatureIds.includes(feature.featureId)}
          {@const detailData = buildStepAdvisorFeatureDetails(feature.featureId, matches, cuttingAdvice)}
          {@const unmatchedStrategies = feature.strategies.filter(strategy => !detailData.matchRows.some(({ match }) => match.candidates.some(candidate => candidate.toolId === strategy.toolId && candidate.toolName === strategy.toolName && candidate.method === strategy.method)))}
          <div class="advisor-feature-details" id={`advisor-feature-${feature.featureId}`}>
            <section class="advisor-detail-section" aria-labelledby={`tools-${feature.featureId}`}>
              <h3 id={`tools-${feature.featureId}`}>Werkzeugkandidaten</h3>
              {#each detailData.matchRows as { match, rows }}
                {#if rows.length}
                  <div class="advisor-table-scroll"><table>
                    <thead><tr><th scope="col">Werkzeug</th><th scope="col">Methode</th><th scope="col">Drehzahl</th><th scope="col">Vorschub</th><th scope="col">Status</th></tr></thead>
                    <tbody>{#each rows as row}
                      <tr><th scope="row"><span class="advisor-tool-name">{row.toolName}</span><span class="advisor-tool-id">{row.toolId}</span></th><td>{row.method === 'drill' ? 'Bohren' : 'Helixfräsen'}</td><td>{row.spindleRpm == null ? 'Nicht verfügbar' : `${row.spindleRpm.toFixed(0)} U/min`}</td><td>{row.feedMmMin == null ? 'Nicht verfügbar' : `${row.feedMmMin.toFixed(0)} mm/min`}</td><td><span class="advisor-status">Bedingt · nicht freigegeben</span></td></tr>
                      {#if row.candidateReasons.length || row.adviceNotes.length}<tr class="advisor-restrictions"><td colspan="5"><strong>Werkzeug-/Methodenhinweise:</strong><ul>{#each [...new Set([...row.candidateReasons, ...row.adviceNotes])] as note}<li>{note}</li>{/each}</ul></td></tr>{/if}
                    {/each}</tbody>
                  </table></div>
                {:else}<p class="advisor-empty">Keine bedingten Werkzeugkandidaten verfügbar.</p>{/if}
                {#each match.reasons as message}<p class="advisor-inline-warning">{message}</p>{/each}
              {/each}
              {#if detailData.unresolvedAdvice.length}<aside class="advisor-method-warning"><strong>Nicht eindeutig zuordenbare Schnittdatenhinweise</strong>{#each detailData.unresolvedAdvice as advice}<p>{advice.toolName} ({advice.toolId}) · {advice.method === 'drill' ? 'Bohren' : 'Helixfräsen'} · Werte nicht verfügbar</p><ul>{#each advice.notes as note}<li>{note}</li>{/each}</ul>{/each}</aside>{/if}
              {#if unmatchedStrategies.length}<aside class="advisor-method-warning"><strong>Nicht zugeordnete Strategiehinweise</strong>{#each unmatchedStrategies as strategy}<p>{strategy.toolName} ({strategy.toolId}) · {strategy.method === 'drill' ? 'Bohren' : 'Helixfräsen'} · nicht freigegeben</p><ul>{#each strategy.reasons as message}<li>{message}</li>{/each}</ul>{/each}</aside>{/if}
            </section>
            <section class="advisor-detail-section" aria-labelledby={`proposals-${feature.featureId}`}>
              <h3 id={`proposals-${feature.featureId}`}>Bedingte Operationsvorschläge</h3>
              {#each featureProposals as proposal}
                {@const reviews = proposalReviews.filter(review => review.featureId === proposal.featureId && review.toolId === proposal.toolId && review.method === proposal.method)}
                <article class="advisor-proposal">
                  <h4>Operationsvorschlag (bedingt) · {proposal.method === 'drill' ? 'Bohren' : 'Helixfräsen'}</h4>
                  <p>{proposal.toolName} ({proposal.toolId}) · Ø {proposal.diameterMm.toFixed(2)} mm · Tiefe {proposal.depthMm.toFixed(2)} mm · {proposal.spindleRpm.toFixed(0)} U/min · {proposal.feedMmMin.toFixed(0)} mm/min</p>
                  {#each reviews as review}<details class="advisor-review"><summary><strong>Prüfstatus:</strong> Freigabe ausstehend · {review.checks.length} offene Punkte</summary><ul>{#each review.checks as check}<li><strong>Offen · {check.label}:</strong> {check.reason}</li>{/each}</ul></details>{/each}
                  {#if proposal.cautions.length}<div class="advisor-method-warning"><strong>Methodenspezifische Einschränkungen</strong><ul>{#each proposal.cautions as caution}<li>{caution}</li>{/each}</ul></div>{/if}
                </article>
              {:else}<p class="advisor-empty">Keine bedingten Operationsvorschläge.</p>{/each}
            </section>
            {#if feature.reasons.length}<aside class="advisor-feature-warning"><strong>Featurespezifische Warnungen</strong><ul>{#each feature.reasons as message}<li>{message}</li>{/each}</ul></aside>{/if}
          </div>
        {/if}
      </article>
    {/each}
    {#if report.notes.length}<div class="advisor-notice advisor-notice-general"><strong>Allgemeine Advisor-Hinweise</strong><ul>{#each report.notes as note}<li>{note}</li>{/each}</ul></div>{/if}
  {/if}
</section>

<style>
  .advisor-inspector { display: grid; gap: 0.7rem; }
  .advisor-inspector p, .advisor-inspector ul { margin: 0.35rem 0 0; }
  .advisor-notice, .advisor-feature-warning, .advisor-method-warning { border-left: 0.25rem solid var(--border, #8b8b8b); border-radius: 0.35rem; padding: 0.65rem 0.8rem; }
  .advisor-notice-general { background: color-mix(in srgb, var(--panel, #fff) 90%, #4f7da8); }
  .advisor-notice-warning, .advisor-feature-warning { border-left-color: var(--warning, #a66b00); background: color-mix(in srgb, var(--panel, #fff) 90%, #d99a25); }
  .advisor-context, .advisor-summary { font-size: 0.92rem; }
  .advisor-feature-card { border: 1px solid var(--border, #8b8b8b); border-radius: 0.65rem; overflow: hidden; }
  .advisor-feature-header { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; padding: 0.8rem; }
  .advisor-feature-symbol { font-size: 1.8rem; line-height: 1; opacity: 0.8; }
  .advisor-feature-heading { display: grid; gap: 0.2rem; flex: 1 1 12rem; min-width: 0; }
  .advisor-feature-heading span { font-size: 0.9rem; }
  .advisor-details-toggle { cursor: pointer; padding: 0.4rem 0.65rem; }
  .advisor-feature-details { display: grid; gap: 0.85rem; border-top: 1px solid var(--border, #8b8b8b); padding: 0.8rem; }
  .advisor-detail-section h3, .advisor-proposal h4 { margin: 0 0 0.5rem; font-size: 1rem; }
  .advisor-table-scroll { max-width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { border-bottom: 1px solid var(--border, #8b8b8b); padding: 0.5rem; text-align: left; vertical-align: top; }
  .advisor-tool-name, .advisor-tool-id { display: block; overflow-wrap: anywhere; }
  .advisor-tool-id { font-size: 0.78rem; font-weight: normal; opacity: 0.75; }
  .advisor-status { white-space: normal; }
  .advisor-restrictions td { padding-top: 0.25rem; font-size: 0.85rem; }
  .advisor-restrictions ul, .advisor-review ul, .advisor-method-warning ul, .advisor-feature-warning ul { padding-left: 1.2rem; }
  .advisor-proposal { border: 1px solid var(--border, #8b8b8b); border-radius: 0.45rem; padding: 0.65rem; }
  .advisor-review { margin-top: 0.6rem; }
  .advisor-review summary { cursor: pointer; }
  .advisor-method-warning { margin-top: 0.6rem; border-left-color: var(--warning, #a66b00); }
  .advisor-inline-warning, .advisor-empty { font-size: 0.9rem; opacity: 0.85; }
  @media (max-width: 36rem) { .advisor-feature-header { align-items: flex-start; } .advisor-details-toggle { width: 100%; } th, td { min-width: 7.5rem; } }
</style>
