<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import GeometryView from './lib/GeometryView.svelte';
  import type { ImportSummary, StockDefinition, PartPlacement, PartOrientation, WorkCoordinateSystem } from './lib/types';
  import { defaultStock, defaultPartPlacement, defaultPartOrientation, defaultWcs } from './lib/types';

  const steps = ['Bauteil', 'Rohling', 'Werkzeuge', 'Bearbeiten', 'Prüfen', 'Fräsen'];
  let activeStep = 'Bauteil';
  let importSummary: ImportSummary | null = null;
  let stock: StockDefinition = { ...defaultStock };
  let placement: PartPlacement = { ...defaultPartPlacement };
  let orientation: PartOrientation = { ...defaultPartOrientation };
  let wcs: WorkCoordinateSystem = { ...defaultWcs };
  let error = '';

  function updateStock(field: 'width' | 'height' | 'thickness', event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    stock = { ...stock, [field]: value };
  }
  function updatePlacementOffset(field: 'offsetX' | 'offsetY' | 'offsetZ', event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    placement = { ...placement, [field]: value };
  }
  function updateRotationZ(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    orientation = { ...orientation, rotationZDeg: value };
  }

  async function importPart() {
    error = '';
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'CAD', extensions: ['step', 'stp', 'dxf'] }] });
    if (!path || Array.isArray(path)) return;
    try {
      importSummary = await invoke<ImportSummary>('inspect_import', { path });
      placement = { ...defaultPartPlacement };
      orientation = { ...defaultPartOrientation };
      wcs = { ...defaultWcs };
    } catch (e) { error = String(e); }
  }
</script>

<div class="app-shell">
  <header class="topbar"><div><strong>BeBlog CAM</strong><span class="build">001E</span></div><div class="project-name">{importSummary?.fileName ?? 'Neues Projekt'}</div></header>
  <aside class="rail" aria-label="Arbeitsablauf">{#each steps as step, i}<button class:active={activeStep === step} onclick={() => (activeStep = step)}><span>{String(i + 1).padStart(2, '0')}</span>{step}</button>{/each}</aside>
  <main class="workspace">
    <section class="viewport">
      {#if importSummary}
        {#key `${importSummary.kind}:${stock.width}:${stock.height}:${stock.thickness}:${placement.horizontal}:${placement.vertical}:${placement.offsetX}:${placement.offsetY}:${placement.offsetZ}:${orientation.rotationZDeg}:${wcs.x}:${wcs.y}:${wcs.z}`}
          <GeometryView summary={importSummary} {stock} {placement} {orientation} {wcs} />
        {/key}
        <div class="view-label">Aufspannebene → Rohling → Bauteil → WCS</div>
      {:else}
        <div class="empty-state"><div class="mark">B</div><h1>Ein Bauteil öffnen</h1><p>STEP für exakte 3D-BRep-Geometrie oder DXF für planare Konturen.</p><button class="primary" onclick={importPart}>STEP oder DXF öffnen</button></div>
      {/if}
    </section>
    <aside class="inspector">
      {#if activeStep === 'Bauteil'}
        <p class="eyebrow">01 · Bauteil</p><h2>Geometrie</h2>
        {#if importSummary}
          <dl><div><dt>Datei</dt><dd>{importSummary.fileName}</dd></div><div><dt>Format</dt><dd>{importSummary.kind.toUpperCase()}</dd></div><div><dt>Backend</dt><dd>{importSummary.backend}</dd></div><div><dt>Status</dt><dd>{importSummary.status === 'ready' ? 'Bereit' : 'Native STEP-Anbindung fehlt in diesem Build'}</dd></div></dl>
          <div class="placement-section"><p class="placement-title">Modellorientierung</p>
            <div class="placement-grid"><button class:active={orientation.rotationZDeg === 0} onclick={() => orientation = {...orientation, rotationZDeg:0}}>0°</button><button class:active={orientation.rotationZDeg === 90} onclick={() => orientation = {...orientation, rotationZDeg:90}}>90°</button><button class:active={orientation.rotationZDeg === 180} onclick={() => orientation = {...orientation, rotationZDeg:180}}>180°</button></div>
            <div class="placement-grid two"><button class:active={orientation.rotationZDeg === 270} onclick={() => orientation = {...orientation, rotationZDeg:270}}>270°</button><button onclick={() => orientation = {...orientation, rotationZDeg:0}}>Zurücksetzen</button></div>
            <label>Rotation Z <input type="number" step="1" value={orientation.rotationZDeg} oninput={updateRotationZ} /> °</label>
            <p class="note">Das dreht das Bauteil wirklich relativ zum Rohling. Die freie Mausrotation verändert dagegen nur die Kamera.</p>
          </div>
          {#if Object.keys(importSummary.entities).length}<div class="entity-list">{#each Object.entries(importSummary.entities) as [name, count]}<span>{name} <b>{count}</b></span>{/each}</div>{/if}
          {#if importSummary.brep?.cylinderRadiiMm.length}<p class="note">Erkannte Zylinderradien: {importSummary.brep.cylinderRadiiMm.map((r) => `${r.toFixed(3)} mm`).join(' · ')}</p>{/if}
          {#if importSummary.note}<p class="note">{importSummary.note}</p>{/if}<button class="secondary" onclick={importPart}>Anderes Bauteil öffnen</button>
        {:else}<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><button class="primary" onclick={importPart}>Bauteil öffnen</button>{/if}
      {:else if activeStep === 'Rohling'}
        <p class="eyebrow">02 · Rohling</p><h2>Rohling</h2>
        <label>Breite <input type="number" min="0.1" step="0.1" value={stock.width} oninput={(e) => updateStock('width', e)} /> mm</label>
        <label>Länge <input type="number" min="0.1" step="0.1" value={stock.height} oninput={(e) => updateStock('height', e)} /> mm</label>
        <label>Dicke <input type="number" min="0.1" step="0.1" value={stock.thickness} oninput={(e) => updateStock('thickness', e)} /> mm</label>
        <p class="note">Rohlingabmessungen und Bauteillage aktualisieren die Geometrie live.</p>
        <div class="placement-section"><p class="placement-title">Bauteil im Rohling</p>
          <div class="placement-grid"><button class:active={placement.horizontal === 'left'} onclick={() => placement = {...placement, horizontal:'left'}}>Links</button><button class:active={placement.horizontal === 'center'} onclick={() => placement = {...placement, horizontal:'center'}}>Zentriert</button><button class:active={placement.horizontal === 'right'} onclick={() => placement = {...placement, horizontal:'right'}}>Rechts</button></div>
          <div class="placement-grid"><button class:active={placement.vertical === 'front'} onclick={() => placement = {...placement, vertical:'front'}}>Vorne</button><button class:active={placement.vertical === 'center'} onclick={() => placement = {...placement, vertical:'center'}}>Mitte</button><button class:active={placement.vertical === 'back'} onclick={() => placement = {...placement, vertical:'back'}}>Hinten</button></div>
          <details><summary>Feinkorrektur</summary><label>X <input type="number" step="0.1" value={placement.offsetX} oninput={(e) => updatePlacementOffset('offsetX', e)} /> mm</label><label>Y <input type="number" step="0.1" value={placement.offsetY} oninput={(e) => updatePlacementOffset('offsetY', e)} /> mm</label><label>Z <input type="number" step="0.1" value={placement.offsetZ} oninput={(e) => updatePlacementOffset('offsetZ', e)} /> mm</label></details>
        </div>
        <div class="placement-section"><p class="placement-title">Werkstücknullpunkt / WCS</p>
          <div class="placement-grid"><button class:active={wcs.x === 'left'} onclick={() => wcs = {...wcs, x:'left'}}>Links</button><button class:active={wcs.x === 'center'} onclick={() => wcs = {...wcs, x:'center'}}>Mitte</button><button class:active={wcs.x === 'right'} onclick={() => wcs = {...wcs, x:'right'}}>Rechts</button></div>
          <div class="placement-grid"><button class:active={wcs.y === 'front'} onclick={() => wcs = {...wcs, y:'front'}}>Vorne</button><button class:active={wcs.y === 'center'} onclick={() => wcs = {...wcs, y:'center'}}>Mitte</button><button class:active={wcs.y === 'back'} onclick={() => wcs = {...wcs, y:'back'}}>Hinten</button></div>
          <div class="placement-grid two"><button class:active={wcs.z === 'top'} onclick={() => wcs = {...wcs, z:'top'}}>Oberseite</button><button class:active={wcs.z === 'bottom'} onclick={() => wcs = {...wcs, z:'bottom'}}>Unterseite</button></div>
          <p class="note"><strong>Aktiver WCS:</strong> {wcs.x === 'left' ? 'links' : wcs.x === 'center' ? 'mittig' : 'rechts'} · {wcs.y === 'front' ? 'vorne' : wcs.y === 'center' ? 'mittig' : 'hinten'} · {wcs.z === 'top' ? 'Oberseite' : 'Unterseite'}. Das ist der Punkt, den du später am realen Rohling antastest.</p>
        </div>
      {:else}
        <p class="eyebrow">{String(steps.indexOf(activeStep)+1).padStart(2,'0')} · {activeStep}</p><h2>Noch ruhig.</h2><p>Dieser Bereich wird in einem späteren Build aktiviert.</p>
      {/if}
      {#if error}<p class="error">{error}</p>{/if}
    </aside>
  </main>
</div>
