<script lang="ts">
  import { onMount } from 'svelte';
  import { calculateFeedsSpeeds } from './feedsSpeeds';
  import { materialKinds, materialProfiles, setStockMaterial, stockMaterial, type MaterialKind } from './materialContext';
  import {
    createMillingTool,
    migrateMillingTool,
    millingToolDescriptions,
    millingToolKinds,
    millingToolLabels,
    toolGeometrySummary,
    type MillingTool,
    type MillingToolKind
  } from './toolTypes';

  type ToolTab='data'|'calculator'|'library';
  type ToolOperationTransfer={toolId:string;toolName:string;toolKind:MillingToolKind;diameterMm:number;feedMmMin:number;spindleRpm:number};

  export let activeOperationName='Aktive Bearbeitung';
  export let onApplyToOperation:((transfer:ToolOperationTransfer)=>void)|undefined=undefined;

  let activeTab:ToolTab='data';
  let tool:MillingTool=createMillingTool('end-mill','tool-draft');
  let cuttingSpeed=200;
  let maxSpindleRpm=18000, maxFeedMmMin=2000, formulaOpen=false;
  let library:MillingTool[]=[];
  let selectedToolId:string|null=null;
  let libraryMessage='';
  let transferMessage='';
  let appliedMaterial:MaterialKind|null=null;

  const STORAGE_KEY='beblog-cam.tool-library.v1';
  $: materialProfile=materialProfiles[$stockMaterial];
  $: if($stockMaterial!==appliedMaterial){appliedMaterial=$stockMaterial;cuttingSpeed=materialProfile.cuttingSpeedMMin;transferMessage='';}
  $: effectiveChipLoad=tool.chipLoadMm*materialProfile.chipLoadFactor;
  $: calculationDiameter=tool.kind==='v-bit'?tool.maxDiameterMm:tool.diameterMm;
  $: valid=[calculationDiameter,cuttingSpeed,tool.flutes,effectiveChipLoad,maxSpindleRpm,maxFeedMmMin].every(v=>Number.isFinite(v)&&v>0);
  $: calculated=valid?calculateFeedsSpeeds({toolDiameterMm:calculationDiameter,cuttingSpeedMMin:cuttingSpeed,flutes:tool.flutes,chipLoadMm:effectiveChipLoad}):null;
  $: recommendedRpm=calculated?Math.min(calculated.spindleRpm,maxSpindleRpm):null;
  $: feedAtRecommendedRpm=recommendedRpm==null?null:recommendedRpm*tool.flutes*effectiveChipLoad;
  $: recommendedFeed=feedAtRecommendedRpm==null?null:Math.min(feedAtRecommendedRpm,maxFeedMmMin);
  $: rpmLimited=!!calculated&&calculated.spindleRpm>maxSpindleRpm;
  $: feedLimited=feedAtRecommendedRpm!=null&&feedAtRecommendedRpm>maxFeedMmMin;
  $: insideProfile=!rpmLimited&&!feedLimited;
  const n=(v:number|null|undefined,d=0)=>v==null?'—':v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});

  onMount(()=>{
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed)){
          library=parsed.map(migrateMillingTool).filter((item):item is MillingTool=>item!==null);
          persist(library);
        }
      }
    }catch{library=[]}
  });

  function persist(next:MillingTool[]){library=next;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{/* Web preview may not expose storage */}}
  function setSpindlePreset(v:number){maxSpindleRpm=v;transferMessage=''}
  function chooseMaterial(material:MaterialKind){setStockMaterial(material);transferMessage=''}
  function chooseToolKind(kind:MillingToolKind){
    const previousName=tool.name;
    const next=createMillingTool(kind,tool.id);
    tool={...next,name:selectedToolId?previousName:next.name};
    transferMessage='';libraryMessage='';
  }
  function patchTool(patch:Partial<MillingTool>){tool={...tool,...patch} as MillingTool;transferMessage=''}
  function numberValue(event:Event){return Number((event.currentTarget as HTMLInputElement).value)}
  function setNumber(field:string,event:Event){
    const value=numberValue(event);if(!Number.isFinite(value))return;
    patchTool({[field]:value} as Partial<MillingTool>);
    if(tool.kind==='v-bit'&&field==='maxDiameterMm')patchTool({diameterMm:value} as Partial<MillingTool>);
  }
  function saveTool(){
    if(!(tool.diameterMm>0&&tool.flutes>0&&tool.chipLoadMm>0))return;
    const id=selectedToolId??`tool-${Date.now()}`;
    const saved={...tool,id,name:tool.name.trim()||millingToolLabels[tool.kind]} as MillingTool;
    const exists=library.some(item=>item.id===id);
    persist(exists?library.map(item=>item.id===id?saved:item):[...library,saved]);
    tool=saved;selectedToolId=id;libraryMessage=exists?'Werkzeug aktualisiert.':'Werkzeug gespeichert.';transferMessage='';
  }
  function loadTool(saved:MillingTool){tool={...saved} as MillingTool;selectedToolId=saved.id;libraryMessage=`${saved.name} in Werkzeugdaten geladen.`;transferMessage='';activeTab='data'}
  function editTool(saved:MillingTool){loadTool(saved);libraryMessage='Werkzeug zum Bearbeiten geladen.'}
  function deleteTool(id:string){persist(library.filter(item=>item.id!==id));if(selectedToolId===id){selectedToolId=null;tool=createMillingTool('end-mill','tool-draft')}libraryMessage='Werkzeug entfernt.';transferMessage=''}
  function newTool(){selectedToolId=null;tool=createMillingTool('end-mill','tool-draft');activeTab='data';libraryMessage='';transferMessage=''}
  function applyToOperation(){
    if(!onApplyToOperation||recommendedRpm==null||recommendedFeed==null||!(calculationDiameter>0))return;
    onApplyToOperation({toolId:selectedToolId??'tool-calculator',toolName:tool.name.trim()||millingToolLabels[tool.kind],toolKind:tool.kind,diameterMm:calculationDiameter,feedMmMin:Math.round(recommendedFeed),spindleRpm:Math.round(recommendedRpm)});
    transferMessage=`Übernommen in ${activeOperationName}: ${millingToolLabels[tool.kind]} · ${materialProfile.label} · Ø ${n(calculationDiameter,2)} mm · ${n(Math.round(recommendedRpm))} 1/min · ${n(Math.round(recommendedFeed))} mm/min.`;
  }
</script>

<div class="tools-page">
  <nav class="tabs" aria-label="Werkzeugbereich">
    <button class:active={activeTab==='data'} onclick={()=>activeTab='data'}>Werkzeugdaten</button>
    <button class:active={activeTab==='calculator'} onclick={()=>activeTab='calculator'}>Drehzahl &amp; Vorschub</button>
    <button class:active={activeTab==='library'} onclick={()=>activeTab='library'}>Werkzeugbibliothek <span class="count">{library.length}</span></button>
  </nav>

  {#if activeTab==='data'}
  <div class="content-grid">
    <main class="main-column">
      <header class="page-title"><span class="cutter">▥</span><div><h1>Werkzeugdaten</h1><p>Erst den Fräsertyp wählen, dann nur die dafür relevanten technischen Daten erfassen.</p></div></header>
      <p class="section-label">FRÄSERTYP</p>
      <section class="type-card">
        <div class="type-grid">
          {#each millingToolKinds as kind}
            <button class:active={tool.kind===kind} aria-pressed={tool.kind===kind} onclick={()=>chooseToolKind(kind)}><b>{millingToolLabels[kind]}</b><span>{millingToolDescriptions[kind]}</span></button>
          {/each}
        </div>
      </section>

      <p class="section-label">TECHNISCHE DATEN</p>
      <section class="name-card">
        <b class="field-label">Werkzeugname</b>
        <div class="name-row">
          <input type="text" value={tool.name} oninput={e=>patchTool({name:(e.currentTarget as HTMLInputElement).value})}/>
          <button class="quiet" onclick={newTool}>Neu</button>
          <button class="primary-action" onclick={saveTool}>{selectedToolId?'Aktualisieren':'In Bibliothek speichern'}</button>
        </div>
      </section>

      <div class="adaptive-grid">
        <section class="field-card"><div class="field-block"><b>{tool.kind==='v-bit'?'Maximal-Ø':'Werkzeug-Ø'} (d)</b><span class="input-line"><input class="numeric-input" type="number" min="0.1" step="0.1" value={tool.kind==='v-bit'?tool.maxDiameterMm:tool.diameterMm} oninput={e=>setNumber(tool.kind==='v-bit'?'maxDiameterMm':'diameterMm',e)}/><em>mm</em></span></div></section>
        <section class="field-card"><div class="field-block"><b>{tool.kind==='face-mill'?'Schneiden / Platten':'Schneidenzahl'} (z)</b><span class="input-line"><input class="numeric-input" type="number" min="1" step="1" value={tool.flutes} oninput={e=>setNumber('flutes',e)}/><em>Z</em></span></div></section>
        <section class="field-card"><div class="field-block"><b>Zahnvorschub (fz)</b><span class="input-line"><input class="numeric-input" type="number" min=".001" step=".005" value={tool.chipLoadMm} oninput={e=>setNumber('chipLoadMm',e)}/><em>mm</em></span><small>Werkzeug-Basiswert; Materialfaktor folgt im Rechner.</small></div></section>

        {#if tool.kind==='end-mill'||tool.kind==='ball-nose'}
          <section class="field-card"><div class="field-block"><b>Schneidenlänge</b><span class="input-line"><input class="numeric-input" type="number" min="0.1" step="0.1" value={tool.cuttingLengthMm} oninput={e=>setNumber('cuttingLengthMm',e)}/><em>mm</em></span></div></section>
          <section class="field-card"><div class="field-block"><b>Schaft-Ø</b><span class="input-line"><input class="numeric-input" type="number" min="0.1" step="0.1" value={tool.shaftDiameterMm} oninput={e=>setNumber('shaftDiameterMm',e)}/><em>mm</em></span></div></section>
          {#if tool.kind==='ball-nose'}<section class="field-card readonly"><div class="field-block"><b>Kugelradius</b><strong>R {n(tool.diameterMm/2,2)} mm</strong><small>Wird aus dem Werkzeugdurchmesser abgeleitet.</small></div></section>{/if}
        {:else if tool.kind==='face-mill'}
          <section class="field-card"><div class="field-block"><b>Max. Schnitttiefe (ap)</b><span class="input-line"><input class="numeric-input" type="number" min="0.05" step="0.1" value={tool.maxDepthOfCutMm} oninput={e=>setNumber('maxDepthOfCutMm',e)}/><em>mm</em></span><small>Technische Werkzeuggrenze, keine automatische CAM-Zustellung.</small></div></section>
        {:else}
          <section class="field-card"><div class="field-block"><b>Spitzenwinkel</b><span class="input-line"><input class="numeric-input" type="number" min="1" max="179" step="1" value={tool.angleDeg} oninput={e=>setNumber('angleDeg',e)}/><em>°</em></span></div></section>
          <section class="field-card"><div class="field-block"><b>Spitzen-Ø</b><span class="input-line"><input class="numeric-input" type="number" min="0.01" step="0.05" value={tool.tipDiameterMm} oninput={e=>setNumber('tipDiameterMm',e)}/><em>mm</em></span></div></section>
        {/if}
      </div>

      <section class="recognized"><span>✓</span><div><b>{millingToolLabels[tool.kind]}</b><p>{toolGeometrySummary(tool)} · {tool.flutes} Schneide{tool.flutes===1?'':'n'}</p></div></section>
      {#if libraryMessage}<p class="inline-message">{libraryMessage}</p>{/if}
      <button class="formula-toggle" onclick={()=>formulaOpen=!formulaOpen}><span>☷ &nbsp; Formeln &amp; Erklärung</span><b>{formulaOpen?'⌃':'⌄'}</b></button>
      {#if formulaOpen}<section class="formula"><code>n = (vc × 1000) / (π × d)</code><code>fz_material = fz_werkzeug × Materialfaktor</code><code>vf = n × z × fz_material</code><p>001T trennt Werkzeuggeometrie und Schnittdaten. Der Werkzeugtyp definiert die erforderlichen Geometriefelder; Material und Maschinenlimit beeinflussen anschließend die Schnittdaten.</p></section>{/if}
    </main>

    <aside class="side-column">
      <section class="results"><div class="result-head"><b>AKTUELLER RECHENSTAND</b><span class:warning={!insideProfile}>{insideProfile?'✓ Im Maschinenprofil':'↘ Maschinenlimit aktiv'}</span></div><div class="result-values"><div><p>Drehzahl (n)</p><strong>{n(recommendedRpm)} <small>1/min</small></strong></div><div><p>Vorschub (vf)</p><strong>{n(recommendedFeed)} <small>mm/min</small></strong></div></div></section>
      <section class="card"><h3>Aktiver Fräsertyp</h3><div class="kv"><span>Typ</span><b>{millingToolLabels[tool.kind]}</b></div><p class="body-copy">{millingToolDescriptions[tool.kind]}</p></section>
      <section class="card"><h3>Werkstoffkontext</h3><div class="kv"><span>Rohling</span><b>{materialProfile.label}</b></div><div class="kv"><span>vc Startprofil</span><b>{n(materialProfile.cuttingSpeedMMin)} m/min</b></div><div class="kv"><span>fz-Faktor</span><b>{n(materialProfile.chipLoadFactor,2)}</b></div></section>
      <section class="card"><h3>Nächster Schritt</h3><p class="body-copy">Werkzeug speichern oder zu <b>Drehzahl &amp; Vorschub</b> wechseln. Dort werden Fräser, Werkstoff und Maschinenlimits zusammengeführt.</p><button class="wide-button" onclick={()=>activeTab='calculator'}>Drehzahl &amp; Vorschub öffnen →</button></section>
    </aside>
  </div>

  {:else if activeTab==='calculator'}
  <div class="content-grid">
    <main class="main-column">
      <header class="page-title"><span class="calc-icon">∑</span><div><h1>Drehzahl &amp; Vorschub</h1><p>{millingToolLabels[tool.kind]}, Werkstoff und reale Maschinenlimits getrennt betrachten.</p></div></header>
      <p class="section-label">ZERSPANUNGSDATEN · {materialProfile.label.toUpperCase()}</p>
      <div class="two-cards">
        <section class="field-card"><div class="field-block"><b>Schnittgeschwindigkeit (vc)</b><span class="input-line"><input class="numeric-input" type="number" min="1" step="5" bind:value={cuttingSpeed}/><em>m/min</em></span><small>Startwert aus {materialProfile.label}; bewusst überschreibbar.</small></div></section>
        <section class="field-card"><div class="field-block"><b>Zahnvorschub Werkzeug (fz)</b><span class="input-line"><input class="numeric-input" type="number" min=".001" step=".005" value={tool.chipLoadMm} oninput={e=>setNumber('chipLoadMm',e)}/><em>mm</em></span><small>Wirksam für {materialProfile.label}: {n(effectiveChipLoad,3)} mm/Z.</small></div></section>
      </div>
      {#if tool.kind==='v-bit'}<p class="note-line">Für 001T wird die Schnittdatenrechnung beim V-Fräser mit dem maximalen Werkzeugdurchmesser durchgeführt. Eine tiefenabhängige wirksame Schneidenbreite folgt erst mit einer V-Carve-Strategie.</p>{/if}
      <section class="hero-result"><div><span>Rechnerisch</span><strong>{n(calculated?.spindleRpm)} <small>1/min</small></strong><small>{n(calculated?.feedMmMin)} mm/min</small></div><div class="arrow">→</div><div><span>Für Maschinenprofil</span><strong>{n(recommendedRpm)} <small>1/min</small></strong><small>{n(recommendedFeed)} mm/min</small></div></section>
      <section class="card machine-wide"><h3>Maschinenprofil <small>(optional, aber sichtbar)</small></h3><div class="machine-fields"><label>Max. Drehzahl <span class="mini-input"><input class="machine-input" type="number" min="1" step="500" bind:value={maxSpindleRpm}/><em>1/min</em></span></label><label>Max. Vorschub (XY) <span class="mini-input"><input class="machine-input" type="number" min="1" step="100" bind:value={maxFeedMmMin}/><em>mm/min</em></span></label></div><div class="presets"><button class:active={maxSpindleRpm===12000} onclick={()=>setSpindlePreset(12000)}>12.000</button><button class:active={maxSpindleRpm===18000} onclick={()=>setSpindlePreset(18000)}>18.000</button><button class:active={maxSpindleRpm===24000} onclick={()=>setSpindlePreset(24000)}>24.000</button><button class:active={maxSpindleRpm===30000} onclick={()=>setSpindlePreset(30000)}>30.000</button></div><p class="status" class:warning={!insideProfile}>{insideProfile?'✓ Rechnerische Werte liegen innerhalb der Maschinenlimits.':'Maschinenlimit reduziert die rechnerischen Werte.'}</p></section>
    </main>
    <aside class="side-column">
      <section class="results"><div class="result-head"><b>EMPFOHLENE EINSTELLUNGEN</b><span class:warning={!insideProfile}>{insideProfile?'✓ Im Maschinenprofil':'↘ Maschinenlimit aktiv'}</span></div><div class="result-values"><div><p>Drehzahl</p><strong>{n(recommendedRpm)} <small>1/min</small></strong></div><div><p>Vorschub</p><strong>{n(recommendedFeed)} <small>mm/min</small></strong></div></div></section>
      <section class="card"><h3>Aktives Werkzeug</h3><div class="kv"><span>Typ</span><b>{millingToolLabels[tool.kind]}</b></div><div class="kv"><span>Name</span><b>{tool.name}</b></div><div class="kv"><span>Rechen-Ø</span><b>{n(calculationDiameter,2)} mm</b></div><div class="kv"><span>Schneiden</span><b>{tool.flutes}</b></div><div class="kv"><span>fz Werkzeug</span><b>{n(tool.chipLoadMm,3)} mm</b></div><div class="kv"><span>fz wirksam</span><b>{n(effectiveChipLoad,3)} mm</b></div></section>
      <section class="apply-card"><div><h3>In aktive Bearbeitung übernehmen</h3><p>Ziel: <b>{activeOperationName}</b></p><p>Übernommen werden Werkzeugname, Fräsertyp, Rechen-Ø sowie die aus <b>{materialProfile.label}</b> berechnete Drehzahl und der Vorschub. Die bestehende Operation ändert sich erst mit diesem Button.</p></div><button class="primary-action apply-button" disabled={!onApplyToOperation||recommendedRpm==null||recommendedFeed==null} onclick={applyToOperation}>Werkzeug &amp; Schnittdaten übernehmen</button>{#if transferMessage}<p class="transfer-message">✓ {transferMessage}</p>{/if}</section>
      <section class="card"><h3>Werkstoff des Rohlings</h3><div class="material-grid">{#each materialKinds as material}<button class:active={$stockMaterial===material} aria-pressed={$stockMaterial===material} onclick={()=>chooseMaterial(material)}>{materialProfiles[material].shortLabel}</button>{/each}</div><div class="material-summary"><b>{materialProfile.label}</b><span>vc {n(materialProfile.cuttingSpeedMMin)} m/min · fz-Faktor {n(materialProfile.chipLoadFactor,2)}</span></div></section>
    </aside>
  </div>

  {:else}
  <div class="library-page">
    <header class="library-head"><div><h1>Werkzeugbibliothek</h1><p>Fräser mit Typ und typabhängiger Geometrie lokal speichern und wiederverwenden.</p></div><button class="primary-action" onclick={newTool}>+ Neues Werkzeug</button></header>
    {#if library.length===0}
      <section class="library-empty"><strong>Noch keine Werkzeuge gespeichert.</strong><p>Lege unter „Werkzeugdaten“ dein erstes Werkzeug an.</p><button class="wide-button" onclick={()=>activeTab='data'}>Werkzeug anlegen →</button></section>
    {:else}
      <div class="library-grid">
        {#each library as saved}
          <article class:selected={selectedToolId===saved.id} class="tool-card">
            <div class="tool-card-head"><span class="tool-chip">{millingToolLabels[saved.kind]}</span><button class="delete" title="Werkzeug löschen" onclick={()=>deleteTool(saved.id)}>×</button></div>
            <h3>{saved.name}</h3><p>{toolGeometrySummary(saved)}</p><small>{saved.flutes} Schneide{saved.flutes===1?'':'n'} · fz {n(saved.chipLoadMm,3)} mm</small>
            <div class="tool-actions"><button onclick={()=>editTool(saved)}>Bearbeiten</button><button class="primary-action" onclick={()=>loadTool(saved)}>Auswählen</button></div>
          </article>
        {/each}
      </div>
    {/if}
    {#if libraryMessage}<p class="inline-message library-msg">{libraryMessage}</p>{/if}
    <section class="hint library-hint"><b>001T · Werkzeugtyp</b><p>Ältere Bibliothekswerkzeuge ohne Typ werden einmalig als Schaftfräser migriert. Werkstoffdaten bleiben weiterhin getrennt und gehören zum Rohling.</p></section>
  </div>
  {/if}
</div>

<style>
:global(.workspace:has(.tools-page)){grid-template-columns:minmax(0,1fr)!important;min-width:0!important}
:global(.workspace:has(.tools-page)>.viewport){display:none!important}
:global(.workspace:has(.tools-page)>.inspector){display:block!important;width:auto!important;min-width:0!important;padding:0!important;border-left:0!important;overflow:auto!important;background:#fbfbf9!important}
.tools-page{box-sizing:border-box;width:100%;min-width:0;min-height:100%;padding:0 34px 30px;color:#202622;font-size:13px}.tabs{height:60px;display:flex;align-items:end;gap:38px;border-bottom:1px solid #dddeda}.tabs button{padding:0 10px 15px;border:0;background:transparent;font:inherit;cursor:pointer;color:#626964}.tabs button.active{font-weight:700;color:#202622;border-bottom:2px solid #275b3d}.count{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:5px;border-radius:999px;background:#eef1ec;font-size:10px}.content-grid{display:grid;grid-template-columns:minmax(520px,1.05fr) minmax(430px,.95fr);gap:30px;width:min(1260px,100%);margin:22px auto 0}.main-column{padding-right:28px;border-right:1px solid #e0e1dc;min-width:0}.page-title{display:flex;align-items:center;gap:15px}.page-title h1,.library-head h1{margin:0;font-size:27px}.page-title p,.library-head p{margin:5px 0;color:#656b67}.cutter{font-size:36px;transform:rotate(90deg)}.calc-icon{display:grid;place-items:center;width:42px;height:42px;border:1px solid #ccd2cb;border-radius:9px;font-size:23px}.section-label{margin:28px 0 12px;font-weight:700;letter-spacing:.06em}.type-card,.field-card,.card,.results,.recognized,.hint,.formula,.name-card,.hero-result,.library-empty,.tool-card,.apply-card{border:1px solid #dfe1dc;border-radius:11px;background:#fff}.type-card{padding:10px}.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.type-grid button{display:grid;gap:5px;text-align:left;padding:14px;border:1px solid #d7dbd5;border-radius:8px;background:#fff;color:#303833;cursor:pointer}.type-grid button span{font-size:11px;line-height:1.4;color:#6b716d}.type-grid button.active{border-color:#6f8c78;background:#f1f6ef;box-shadow:inset 0 0 0 1px #b5c9b9}.name-card{padding:18px;margin-bottom:14px}.field-label{display:block;margin-bottom:10px}.name-row{display:grid;grid-template-columns:minmax(250px,1fr) auto auto;gap:10px;align-items:center}.name-row input{width:100%;min-width:0;height:42px;padding:0 13px;border:1px solid #cfd3cd;border-radius:7px;background:#fff;font-size:14px}.quiet,.primary-action,.wide-button,.tool-actions button,.delete{height:42px;border:1px solid #d5d9d3;border-radius:7px;background:#fff;padding:0 14px;color:#354039;cursor:pointer;white-space:nowrap}.primary-action{background:#285f40;color:#fff;border-color:#285f40}.primary-action:disabled{background:#dfe5df;border-color:#dfe5df;color:#78807a;cursor:not-allowed}.adaptive-grid,.two-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field-card{padding:18px}.field-card small{color:#656b67}.field-card.readonly{background:#f7f8f5}.field-block{display:grid;gap:12px;min-width:0}.input-line,.mini-input{display:grid;grid-template-columns:minmax(150px,210px) auto;align-items:center;gap:10px}.numeric-input,.machine-input{box-sizing:border-box!important;width:100%!important;min-width:140px!important;height:44px!important;padding:0 12px!important;border:1px solid #cfd3cd!important;border-radius:7px!important;background:#fff!important;text-align:left!important;font-size:16px!important;font-weight:650!important;font-variant-numeric:tabular-nums!important}.input-line em,.mini-input em{font-style:normal;white-space:nowrap}.recognized{display:flex;gap:14px;align-items:center;margin-top:14px;padding:18px;background:#f1f7ed;border-color:#d6e5ce}.recognized>span{display:grid;place-items:center;width:28px;height:28px;border:2px solid #2e704b;border-radius:50%;color:#2e704b;font-weight:700}.recognized p{margin:5px 0 0}.inline-message{margin:10px 0 0;padding:9px 11px;border-radius:7px;background:#eef6ea;color:#2d6342}.formula-toggle{width:100%;height:50px;display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:0 18px;border:1px solid #dfe1dc;border-radius:10px;background:#fff;cursor:pointer}.formula{display:grid;gap:8px;margin-top:8px;padding:14px}.formula code{padding:7px;background:#f5f5f2;border-radius:5px}.formula p{margin:0;color:#666}.side-column{display:grid;align-content:start;gap:12px;min-width:0}.results{padding:18px;background:#f0f7eb;border-color:#d4e5cc}.result-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.result-head>span,.status{padding:6px 9px;border-radius:7px;background:#e0efda;color:#28623f;font-size:11px}.warning{background:#f8edd1!important;color:#76591f!important}.result-values{display:grid;grid-template-columns:1fr 1fr;margin-top:14px}.result-values>div+div{border-left:1px solid #cfdcc8;padding-left:24px}.result-values p{margin:0 0 8px}.result-values strong{font-size:27px;color:#255c3d}.result-values small,.hero-result small{font-size:11px}.card{padding:16px;min-width:0}.card h3,.apply-card h3{margin:0 0 13px;font-size:14px}.body-copy{line-height:1.55;color:#59605c}.wide-button{width:100%;margin-top:10px}.material-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.material-grid button,.presets button{padding:8px;border:1px solid #d8dad5;border-radius:6px;background:#fff;cursor:pointer}.material-grid button.active{background:#e9ece8;border-color:#59675f}.material-summary{display:grid;gap:3px;margin-top:10px;padding:9px 10px;border-radius:7px;background:#f3f5f1}.material-summary span{font-size:11px;color:#626963}.machine-wide{margin-top:14px}.machine-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.presets{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.presets button.active{background:#285f40;color:#fff;border-color:#285f40}.status{margin:12px 0 0}.kv{display:flex;justify-content:space-between;gap:12px;margin:10px 0}.hint{padding:14px 16px;background:#f1f6fb;border-color:#cbdced;color:#275d9b}.hint p{margin:7px 0 0;color:#303b43;line-height:1.45}.hero-result{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-top:14px;padding:22px;background:#f5f8f2}.hero-result>div:not(.arrow){display:grid;gap:7px}.hero-result strong{font-size:26px;color:#285f40}.arrow{font-size:25px;color:#8c948f}.apply-card{padding:16px;background:#f8faf7;border-color:#cfdacf}.apply-card p{margin:6px 0;color:#59605c;line-height:1.45}.apply-button{width:100%;margin-top:10px}.transfer-message{padding:9px 11px!important;border-radius:7px;background:#e9f4e5;color:#28623f!important}.note-line{padding:10px 12px;border-radius:8px;background:#f7f4ea;color:#6b5b2e;font-size:11px;line-height:1.45}.library-page{width:min(1180px,100%);margin:0 auto;padding:28px 0}.library-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.tool-card{padding:16px}.tool-card.selected{border-color:#76947d;background:#f5f8f3}.tool-card-head{display:flex;align-items:center;justify-content:space-between}.tool-chip{padding:5px 8px;border-radius:999px;background:#eef2ed;font-size:11px;font-weight:700}.delete{padding:0 8px;border:0;background:transparent;font-size:18px;color:#8b5d58}.tool-card h3{margin:16px 0 6px}.tool-card p{margin:0 0 6px;color:#69706b;line-height:1.4}.tool-card small{color:#69706b}.tool-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:16px}.library-empty{padding:26px;text-align:center}.library-empty p{color:#666d68}.library-msg{max-width:520px}.library-hint{margin-top:20px}
@media(max-width:1180px){.tools-page{padding-inline:18px}.content-grid{grid-template-columns:1fr;max-width:820px}.main-column{padding-right:0;border-right:0}.library-grid{grid-template-columns:1fr 1fr}.name-row{grid-template-columns:minmax(220px,1fr) auto}.name-row .primary-action{grid-column:1/-1;width:100%}}
@media(max-width:820px){.tabs{gap:12px;overflow:auto}.type-grid,.adaptive-grid,.two-cards,.machine-fields{grid-template-columns:1fr}.name-row{grid-template-columns:1fr 1fr}.name-row input{grid-column:1/-1}.name-row .primary-action{grid-column:1/-1}.library-grid{grid-template-columns:1fr}.library-head{align-items:flex-start;flex-direction:column}.presets{grid-template-columns:1fr 1fr}.result-values{grid-template-columns:1fr}.result-values>div+div{border-left:0;border-top:1px solid #cfdcc8;padding:14px 0 0;margin-top:14px}}
</style>
