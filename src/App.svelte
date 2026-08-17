<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import GeometryView from './lib/GeometryView.svelte';
  import type { ImportSummary, StockDefinition } from './lib/types';
  import { defaultStock } from './lib/types';

  const steps = ['Bauteil', 'Rohling', 'Werkzeuge', 'Bearbeiten', 'Prüfen', 'Fräsen'];
  let activeStep = 'Bauteil';
  let importSummary: ImportSummary | null = null;
  let stock: StockDefinition = { ...defaultStock };
  let error = '';

  async function importPart() {
    error = '';
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'CAD', extensions: ['step', 'stp', 'dxf'] }]
    });
    if (!path || Array.isArray(path)) return;
    try {
      importSummary = await invoke<ImportSummary>('inspect_import', { path });
    } catch (e) {
      error = String(e);
    }
  }
</script>

<div class="app-shell">
  <header class="topbar">
    <div>
      <strong>BeBlog CAM</strong>
      <span class="build">001C</span>
    </div>
    <div class="project-name">{importSummary?.fileName ?? 'Neues Projekt'}</div>
  </header>

  <aside class="rail" aria-label="Arbeitsablauf">
    {#each steps as step, i}
      <button class:active={activeStep === step} onclick={() => (activeStep = step)}>
        <span>{String(i + 1).padStart(2, '0')}</span>{step}
      </button>
    {/each}
  </aside>

  <main class="workspace">
    <section class="viewport">
      {#if importSummary}
        {#key importSummary.kind}
          <GeometryView summary={importSummary} {stock} />
        {/key}
        <div class="view-label">Aufspannebene → Rohling → Bauteil → WCS</div>
      {:else}
        <div class="empty-state">
          <div class="mark">B</div>
          <h1>Ein Bauteil öffnen</h1>
          <p>STEP für exakte 3D-BRep-Geometrie oder DXF für planare Konturen.</p>
          <button class="primary" onclick={importPart}>STEP oder DXF öffnen</button>
        </div>
      {/if}
    </section>

    <aside class="inspector">
      {#if activeStep === 'Bauteil'}
        <p class="eyebrow">01 · Bauteil</p>
        <h2>Geometrie</h2>
        {#if importSummary}
          <dl>
            <div><dt>Datei</dt><dd>{importSummary.fileName}</dd></div>
            <div><dt>Format</dt><dd>{importSummary.kind.toUpperCase()}</dd></div>
            <div><dt>Backend</dt><dd>{importSummary.backend}</dd></div>
            <div><dt>Status</dt><dd>{importSummary.status === 'ready' ? 'Bereit' : 'Native STEP-Anbindung fehlt in diesem Build'}</dd></div>
          </dl>
          {#if Object.keys(importSummary.entities).length}
            <div class="entity-list">
              {#each Object.entries(importSummary.entities) as [name, count]}
                <span>{name} <b>{count}</b></span>
              {/each}
            </div>
          {/if}
          {#if importSummary.brep?.cylinderRadiiMm.length}
            <p class="note">Erkannte Zylinderradien: {importSummary.brep.cylinderRadiiMm.map((r) => `${r.toFixed(3)} mm`).join(' · ')}</p>
          {/if}
          {#if importSummary.note}<p class="note">{importSummary.note}</p>{/if}
          <button class="secondary" onclick={importPart}>Anderes Bauteil öffnen</button>
        {:else}
          <p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p>
          <button class="primary" onclick={importPart}>Bauteil öffnen</button>
        {/if}
      {:else if activeStep === 'Rohling'}
        <p class="eyebrow">02 · Rohling</p>
        <h2>Abmessungen</h2>
        <label>Breite <input type="number" bind:value={stock.width} /> mm</label>
        <label>Länge <input type="number" bind:value={stock.height} /> mm</label>
        <label>Dicke <input type="number" bind:value={stock.thickness} /> mm</label>
        <details><summary>Position im Rohling</summary>
          <label>X-Rand <input type="number" bind:value={stock.offsetX} /> mm</label>
          <label>Y-Rand <input type="number" bind:value={stock.offsetY} /> mm</label>
        </details>
        <p class="note">Die Aufspannebene ist nur die räumliche Referenz. BeBlog CAM modelliert keine Maschine.</p>
      {:else}
        <p class="eyebrow">{String(steps.indexOf(activeStep)+1).padStart(2,'0')} · {activeStep}</p>
        <h2>Noch ruhig.</h2>
        <p>Dieser Bereich wird in einem späteren Build aktiviert. Die Navigation steht bereits an ihrer endgültigen Stelle.</p>
      {/if}
      {#if error}<p class="error">{error}</p>{/if}
    </aside>
  </main>
</div>
