<script lang="ts">
  import type { AdvisorReport } from './advisorStepFeasibility';
  import type { StepToolMatch } from './stepToolMatching';
  import type { StepCuttingAdvice } from './stepCuttingAdvice';
  import type { StepOperationProposal } from './stepOperationProposals';
  import type { ProposalReview } from './stepProposalReview';
  import type { StepAdvisorFeatureOverviewResult } from './stepAdvisorFeatureOverview';
  import type { StepClassifiedFeature } from './stepFeatureClassification';
  import { buildStepAdvisorFeatureCards } from './stepAdvisorInspector';

  export let report: AdvisorReport | null = null;
  export let featureOverview: StepAdvisorFeatureOverviewResult | null = null;
  export let reason: string | null = null;
  export let toolCount = 0;
  export let matches: StepToolMatch[] = [];
  export let cuttingAdvice: StepCuttingAdvice[] = [];
  export let operationProposals: StepOperationProposal[] = [];
  export let proposalReviews: ProposalReview[] = [];
  $: featureCards=buildStepAdvisorFeatureCards(featureOverview,matches,cuttingAdvice,operationProposals,proposalReviews);

  const featureLabel=(kind:StepClassifiedFeature['geometryKind'])=>kind==='hole'?'Bohrung':kind==='unclassified-cylinder'?'Nicht klassifizierter Zylinder':kind==='planar-face'?'Planare Fläche':kind==='contour-wire'?'Kontur':kind==='planar-region'?'Planare Region':'Ungeklärte Begrenzung';
  const recognitionLabel=(status:StepClassifiedFeature['recognitionStatus'])=>status==='recognized'?'Geometrisch erkannt':status==='candidate'?'Geometrischer Kandidat':status==='unsupported'?'Nicht unterstützt':'Ungeklärt';
  const confidenceLabel=(confidence:StepClassifiedFeature['confidence'])=>confidence==='verified-conservative-recognition'?'Konservativ verifiziert':confidence==='verified-native-geometry'?'Native Geometrie verifiziert':confidence==='verified-reconstructed-geometry'?'Rekonstruktion verifiziert':'Unvollständige Geometrieevidenz';
  const boundaryReasonLabel=(resolution:string)=>resolution==='unsupported-curve'?'Nicht unterstützte Kurve':resolution==='reconstruction-failed'?'Rekonstruktion fehlgeschlagen':resolution==='geometric-closure-mismatch'?'Geometrische Schließung stimmt nicht':'Ebene stimmt nicht mit Begrenzung überein';
  const measurementLabel=(feature:StepClassifiedFeature)=>feature.geometryKind==='hole'?`Ø ${feature.geometry.diameterMm.toFixed(2)} mm · Tiefe ${feature.geometry.depthMm.toFixed(2)} mm`:feature.geometryKind==='unclassified-cylinder'?`Radius ${feature.geometry.radiusMm.toFixed(2)} mm`:feature.geometryKind==='planar-face'?`${feature.geometry.wireCount} Begrenzungen · Normale [${feature.geometry.normal.map(value=>value.toFixed(3)).join(', ')}]`:feature.geometryKind==='contour-wire'?`${feature.geometry.topology==='closed'?'geschlossen':'offen'} · Z ${feature.geometry.zMm.toFixed(2)} mm · ${feature.geometry.areaMm2.toFixed(2)} mm²`:feature.geometryKind==='planar-region'?`${feature.geometry.areaMm2.toFixed(2)} mm² · ${feature.geometry.islandCount} Inseln`:`${boundaryReasonLabel(feature.geometry.resolution)} · nativ ${feature.geometry.nativeClosed?'geschlossen':'offen'}`;
  const referencesLabel=(feature:StepClassifiedFeature)=>`Flächen ${feature.sourceReferences.faceIds.join(', ')||'–'} · Wires ${feature.sourceReferences.wireIds.join(', ')||'–'} · Kanten ${feature.sourceReferences.edgeIds.join(', ')||'–'}`;
  const coverageLabel=(coverage:string)=>coverage==='DIRECT'?'Direkte Abdeckung':coverage==='ALTERNATIVE'?'Alternative Abdeckung':coverage==='CONDITIONAL'?'Bedingte Abdeckung':coverage==='NOT_COVERED'?'Nicht abgedeckt':'Unbekannt';
  const methodLabel=(method:'drill'|'helical-mill')=>method==='drill'?'Bohren':'Helixfräsen';
</script>

<section class="placement-section advisor-inspector" aria-label="STEP CAM Advisor Vorprüfung">
  <p class="placement-title">Bearbeitungsmöglichkeiten · STEP</p>
  <p class="advisor-safety">Nur lesende Vorprüfung. Werkzeugkandidaten und bedingte Vorschläge erzeugen oder ändern keine CAM-Operation und geben keine Fertigung frei. Die Produktionsfreigabe richtet sich ausschließlich nach dem tatsächlichen Job-Preflight.</p>
  {#if reason}
    <div class="advisor-notice advisor-notice-warning" role="status"><strong>Advisor nicht verfügbar</strong><p>{reason}</p></div>
  {:else if !featureOverview || !featureOverview.ok}
    <div class="advisor-notice advisor-notice-warning" role="status"><strong>Merkmalsübersicht nicht verfügbar</strong><ul>{#each featureOverview?.errors ?? ['Keine aktuelle STEP-Klassifikation vorhanden.'] as message}<li>{message}</li>{/each}</ul></div>
  {:else}
    <p class="advisor-summary">{featureOverview.overview.features.length} geometrische Merkmale · {report?.status==='screened'?'Advisor-Vorprüfung durchgeführt':'Advisor-Bewertung nicht verfügbar'}</p>
    {#if !toolCount}<div class="advisor-notice advisor-notice-warning"><strong>Werkzeuge nicht verfügbar</strong><p>Keine vollständig validierten Bibliotheksdatensätze. Es werden keine geeigneten Werkzeuge angenommen.</p></div>{/if}
    {#if !featureOverview.overview.features.length}<p class="advisor-empty">Keine STEP-Merkmale für diese Geometrie erfasst.</p>{/if}
    <div class="advisor-feature-list">
      {#each featureCards as card (card.featureId)}
        {@const entry = card.entry}
        {@const detailData = card.details}
        <article class="advisor-feature-card" data-feature-id={entry.featureId}>
          <header class="advisor-feature-header">
            <div class="advisor-feature-heading">
              <h3>{featureLabel(entry.classification.geometryKind)}</h3>
              <span class="advisor-measurements">{measurementLabel(entry.classification)}</span>
              <span class="advisor-recognition">{recognitionLabel(entry.classification.recognitionStatus)} · {confidenceLabel(entry.classification.confidence)}</span>
              <small class="advisor-internal-id">Interne Zuordnung · {entry.featureId}</small>
            </div>
            <span class="advisor-assessment" class:assessed={entry.feasibility.status==='assessed'}>
              {entry.feasibility.status==='assessed'?`Advisor · ${coverageLabel(entry.feasibility.assessment.coverage)}`:'Advisor · nicht bewertet'}
            </span>
          </header>

          <section class="advisor-options" aria-label="Bearbeitungsmöglichkeiten">
            <h4>Bearbeitungsmöglichkeiten</h4>
            {#if entry.feasibility.status!=='assessed'}
              <p class="advisor-empty">Noch keine Bearbeitungsempfehlung verfügbar.</p>
            {:else if !detailData || detailData.matchRows.every(({rows})=>rows.length===0)}
              <p class="advisor-empty">Noch keine Bearbeitungsempfehlung verfügbar.</p>
              {#each detailData?.matchRows ?? [] as {match}}{#each match.reasons as message}<p class="advisor-option-note">{message}</p>{/each}{/each}
            {:else}
              {#each detailData.matchRows as {match,rows}, matchIndex}
                {#each rows as row}
                  <article class="advisor-option" data-feature-id={row.featureId} data-tool-id={row.toolId} data-method={row.method}>
                    <div class="advisor-option-main">
                      <strong>{row.toolName}</strong>
                      <span>{methodLabel(row.method)}</span>
                      <span>{row.spindleRpm===null?'Drehzahl nicht verfügbar':`${row.spindleRpm.toFixed(0)} U/min`}</span>
                      <span>{row.feedMmMin===null?'Vorschub nicht verfügbar':`${row.feedMmMin.toFixed(0)} mm/min`}</span>
                    </div>
                    <div class="advisor-option-status">
                      <span class="candidate-status">{match.status==='conditional'?'Werkzeugkandidat · bedingt':'Kein Werkzeugkandidat'}</span>
                      {#if row.proposalAmbiguous}<span class="option-warning">Vorschlagszuordnung mehrdeutig</span>
                      {:else if row.proposal}<span class="proposal-status">Operationsvorschlag · bedingt, nicht übernommen</span>
                      {:else}<span class="option-note">Kein vollständiger Operationsvorschlag</span>{/if}
                      {#if row.review}<span class="review-status">{row.review.checks.length} offene Prüfungen</span>
                      {:else if row.proposal}<span class="review-status">Prüfstatus nicht eindeutig zugeordnet</span>{/if}
                      {#if row.proposal&&row.review?.checks.length}<span class="key-blocker">{row.review.checks[0].label}: {row.review.checks[0].reason}</span>{/if}
                    </div>
                    {#if row.candidateReasons.length||row.adviceNotes.length||row.proposalCautions.length||row.review?.checks.length}
                      <details class="option-details"><summary>Hinweise und offene Prüfungen</summary>
                        {#if row.candidateReasons.length}<section><strong>Kandidatenhinweise</strong><ul>{#each row.candidateReasons as message}<li>{message}</li>{/each}</ul></section>{/if}
                        {#if row.adviceNotes.length}<section><strong>Schnittdatenhinweise</strong><ul>{#each row.adviceNotes as message}<li>{message}</li>{/each}</ul></section>{/if}
                        {#if row.proposalCautions.length}<section><strong>Zusätzliche Vorschlagseinschränkungen</strong><ul>{#each row.proposalCautions as message}<li>{message}</li>{/each}</ul></section>{/if}
                        {#if row.review?.checks.length}<section><strong>Offene Prüfungen</strong><ul>{#each row.review.checks as check}<li><strong>{check.label}:</strong> {check.reason}</li>{/each}</ul></section>{/if}
                      </details>
                    {/if}
                  </article>
                {/each}
                {#each match.reasons as message}<p class="advisor-option-note">{message}</p>{/each}
              {/each}
            {/if}
            {#if detailData?.unresolvedAdvice.length}<details class="diagnostic-details"><summary>Nicht eindeutig zuordenbare Schnittdaten · {detailData.unresolvedAdvice.length}</summary><ul>{#each detailData.unresolvedAdvice as advice}<li>{advice.toolName} ({advice.toolId}) · {methodLabel(advice.method)}: {advice.notes.join(' ')}</li>{/each}</ul></details>{/if}
            {#if detailData?.unmatchedProposals.length}<details class="diagnostic-details"><summary>Nicht zuordenbare Operationsvorschläge · {detailData.unmatchedProposals.length}</summary><ul>{#each detailData.unmatchedProposals as proposal}<li>{proposal.toolName} ({proposal.toolId}) · {methodLabel(proposal.method)} · keine eindeutige Kandidatenzuordnung.</li>{/each}</ul></details>{/if}
          </section>

          <details class="geometry-details">
            <summary>Geometrische Details und Einschränkungen</summary>
            <div class="geometry-detail-content">
              <p><strong>Native Referenzen:</strong> {referencesLabel(entry.classification)}</p>
              <section><strong>Geometrische Evidenz</strong><ul>{#each entry.classification.evidence as evidence}<li>{evidence.statement}</li>{/each}</ul></section>
              <section><strong>Mögliche Interpretationen · nicht bewiesen</strong>{#if entry.classification.manufacturingInterpretations.length}<ul>{#each entry.classification.manufacturingInterpretations as interpretation}<li>{interpretation.explanation}</li>{/each}</ul>{:else}<p>Keine positive Fertigungsinterpretation.</p>{/if}</section>
              <section><strong>Unbekannt und eingeschränkt</strong><ul>{#each entry.classification.unknowns as unknown}<li>{unknown.statement}</li>{/each}{#each entry.classification.limitations as limitation}<li>{limitation}</li>{/each}</ul></section>
              {#if entry.feasibility.status==='assessed'}<section><strong>Advisor-Begründung</strong><ul>{#each entry.feasibility.assessment.reasons as message}<li>{message}</li>{/each}</ul></section>{:else}<p><strong>Bewertung nicht verfügbar:</strong> {entry.feasibility.reason}</p>{/if}
            </div>
          </details>
        </article>
      {/each}
    </div>
    {#if report?.notes.length}<details class="diagnostic-details"><summary>Allgemeine Advisor-Hinweise · {report.notes.length}</summary><ul>{#each report.notes as note}<li>{note}</li>{/each}</ul></details>{/if}
  {/if}
</section>

<style>
  .advisor-inspector{display:grid;gap:.65rem}.advisor-inspector p,.advisor-inspector ul{margin:.3rem 0 0}.advisor-safety,.advisor-summary{font-size:.83rem;line-height:1.4;color:#59635d}.advisor-feature-list{display:grid;gap:.6rem}.advisor-notice,.advisor-option-note{border-left:.22rem solid #9a6a19;border-radius:.3rem;padding:.55rem .7rem;background:#fbf5e8}.advisor-notice p{margin-top:.25rem}.advisor-feature-card{border:1px solid #d5d9d4;border-radius:.55rem;overflow:hidden;background:rgba(255,255,255,.42)}.advisor-feature-header{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:.45rem;padding:.65rem .7rem .4rem}.advisor-feature-heading{display:grid;gap:.16rem;min-width:0}.advisor-feature-heading h3{font-size:.96rem;margin:0}.advisor-measurements{font-size:.86rem;font-weight:600}.advisor-recognition,.advisor-internal-id{font-size:.76rem;color:#606a64}.advisor-internal-id{overflow-wrap:anywhere}.advisor-assessment{font-size:.76rem;font-weight:650;padding:.2rem .4rem;border-radius:.35rem;background:#f0eee7}.advisor-assessment.assessed{background:#e9f0eb}.advisor-options{display:grid;gap:.4rem;padding:.2rem .7rem .65rem}.advisor-options h4{margin:.15rem 0 0;font-size:.82rem}.advisor-empty,.option-note{font-size:.82rem;color:#636b66}.advisor-option{display:grid;gap:.35rem;border:1px solid #e0e2de;border-radius:.4rem;padding:.5rem;background:#fafaf8}.advisor-option-main{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(4.5rem,.8fr) auto auto;gap:.35rem .6rem;align-items:baseline;font-size:.78rem}.advisor-option-main strong{overflow-wrap:anywhere}.advisor-option-status{display:flex;flex-wrap:wrap;gap:.3rem .5rem;align-items:baseline;font-size:.73rem}.candidate-status{font-weight:650}.proposal-status{color:#76591f}.review-status{font-weight:600}.option-warning,.key-blocker{color:#8d3029}.key-blocker{flex-basis:100%;font-size:.74rem}.option-details,.geometry-details,.diagnostic-details{font-size:.78rem}.option-details summary,.geometry-details summary,.diagnostic-details summary{cursor:pointer;padding:.2rem 0;color:#56615b}.option-details section{margin-top:.3rem}.geometry-details{border-top:1px solid #e4e5e1;padding:.45rem .7rem .6rem}.geometry-detail-content{display:grid;gap:.35rem;padding-top:.35rem}.geometry-detail-content p,.geometry-detail-content ul{margin:.2rem 0 0}.diagnostic-details{padding:.3rem .7rem}.diagnostic-details ul{padding-left:1.2rem}.advisor-option-note{margin:0!important;font-size:.78rem}.advisor-option ul,.geometry-details ul{padding-left:1.2rem}.advisor-feature-card section{margin:.25rem 0}.advisor-feature-card section>ul{margin-top:.15rem}@media(max-width:36rem){.advisor-option-main{grid-template-columns:1fr 1fr}.advisor-option-main strong{grid-column:1/-1}}
</style>
