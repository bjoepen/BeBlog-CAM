<script lang="ts">
  import type { AdvisorReport } from './advisorStepFeasibility';
  import type { StepToolMatch } from './stepToolMatching';
  import type { StepCuttingAdvice } from './stepCuttingAdvice';
  export let report: AdvisorReport | null = null;
  export let reason: string | null = null;
  export let toolCount = 0;
  export let matches: StepToolMatch[] = [];
  export let cuttingAdvice: StepCuttingAdvice[] = [];
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
    {#each report.features as feature (feature.featureId)}
      <div class="note">
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
            <p><strong>Schnittdaten-Richtwert:</strong> {advice.method === 'drill' ? 'Bohren' : 'Helixfräsen'} · Werkzeug {advice.toolId} · {advice.spindleRpm.toFixed(0)} U/min · {advice.feedMmMin.toFixed(0)} mm/min (bedingt)</p>
            {#each advice.notes as note}<p>{note}</p>{/each}
          {/each}
        {/each}
        {#each feature.reasons as message}<p>{message}</p>{/each}
      </div>
    {/each}
    {#each report.notes as note}<p class="note">{note}</p>{/each}
  {/if}
</section>
