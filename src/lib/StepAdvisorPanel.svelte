<script lang="ts">
  import type { AdvisorReport } from './advisorStepFeasibility';
  export let report: AdvisorReport | null = null;
  export let reason: string | null = null;
</script>

<section class="placement-section" aria-label="STEP CAM Advisor Vorprüfung">
  <p class="placement-title">CAM Advisor · STEP-Vorprüfung (011-E5B)</p>
  <p class="note">Nur lesende Einschätzung erkannter Bohrungen. Keine Bearbeitung wird erzeugt, geändert oder freigegeben; keine NC-Ausgabe.</p>
  {#if reason}
    <p class="note"><strong>Nicht verfügbar:</strong> {reason}</p>
  {:else if report}
    <p class="note"><strong>Status:</strong> {report.status === 'screened' ? 'Vorprüfung durchgeführt' : 'Nicht verfügbar'} · <strong>Features:</strong> {report.features.length}</p>
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
        {#each feature.reasons as message}<p>{message}</p>{/each}
      </div>
    {/each}
    {#each report.notes as note}<p class="note">{note}</p>{/each}
  {/if}
</section>
