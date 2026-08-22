<script lang="ts">
  import { onMount } from 'svelte';
  import { calculateFeedsSpeeds } from './feedsSpeeds';

  type ToolTab='data'|'calculator'|'library';
  type LibraryTool={id:string;name:string;diameterMm:number;flutes:number;chipLoadMm:number};
  type ToolOperationTransfer={toolId:string;toolName:string;diameterMm:number;feedMmMin:number;spindleRpm:number};

  export let activeOperationName='Aktive Bearbeitung';
  export let onApplyToOperation:((transfer:ToolOperationTransfer)=>void)|undefined=undefined;

  let activeTab:ToolTab='data';
  let diameter=6, cuttingSpeed=200, flutes=2, chipLoad=.05;
  let maxSpindleRpm=18000, maxFeedMmMin=2000, formulaOpen=false;
  let toolName='Schaftfräser 6 mm';
  let library:LibraryTool[]=[];
  let selectedToolId:string|null=null;
  let libraryMessage='';
  let transferMessage='';

  const STORAGE_KEY='beblog-cam.tool-library.v1';
  $: valid=[diameter,cuttingSpeed,flutes,chipLoad,maxSpindleRpm,maxFeedMmMin].every(v=>Number.isFinite(v)&&v>0);
  $: calculated=valid?calculateFeedsSpeeds({toolDiameterMm:diameter,cuttingSpeedMMin:cuttingSpeed,flutes,chipLoadMm:chipLoad}):null;
  $: recommendedRpm=calculated?Math.min(calculated.spindleRpm,maxSpindleRpm):null;
  $: feedAtRecommendedRpm=recommendedRpm==null?null:recommendedRpm*flutes*chipLoad;
  $: recommendedFeed=feedAtRecommendedRpm==null?null:Math.min(feedAtRecommendedRpm,maxFeedMmMin);
  $: rpmLimited=!!calculated&&calculated.spindleRpm>maxSpindleRpm;
  $: feedLimited=feedAtRecommendedRpm!=null&&feedAtRecommendedRpm>maxFeedMmMin;
  $: insideProfile=!rpmLimited&&!feedLimited;
  const n=(v:number|null|undefined,d=0)=>v==null?'—':v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});

  onMount(()=>{
    try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))library=parsed.filter(isLibraryTool)}}catch{library=[]}
  });

  function isLibraryTool(value:unknown):value is LibraryTool{
    if(!value||typeof value!=='object')return false;
    const t=value as Partial<LibraryTool>;
    return typeof t.id==='string'&&typeof t.name==='string'&&Number.isFinite(t.diameterMm)&&Number.isFinite(t.flutes)&&Number.isFinite(t.chipLoadMm);
  }
  function persist(next:LibraryTool[]){library=next;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{/* localStorage kann im Web-Preview fehlen */}}
  function setSpindlePreset(v:number){maxSpindleRpm=v;transferMessage=''}
  function saveTool(){
    if(!(diameter>0&&flutes>0&&chipLoad>0))return;
    const id=selectedToolId??`tool-${Date.now()}`;
    const tool:LibraryTool={id,name:toolName.trim()||`Fräser ${n(diameter,2)} mm`,diameterMm:diameter,flutes:Math.round(flutes),chipLoadMm:chipLoad};
    const exists=library.some(item=>item.id===id);
    persist(exists?library.map(item=>item.id===id?tool:item):[...library,tool]);
    selectedToolId=id;libraryMessage=exists?'Werkzeug aktualisiert.':'Werkzeug gespeichert.';transferMessage='';
  }
  function loadTool(tool:LibraryTool){
    selectedToolId=tool.id;toolName=tool.name;diameter=tool.diameterMm;flutes=tool.flutes;chipLoad=tool.chipLoadMm;libraryMessage=`${tool.name} in Werkzeugdaten geladen.`;transferMessage='';activeTab='data';
  }
  function editTool(tool:LibraryTool){selectedToolId=tool.id;toolName=tool.name;diameter=tool.diameterMm;flutes=tool.flutes;chipLoad=tool.chipLoadMm;activeTab='data';libraryMessage='Werkzeug zum Bearbeiten geladen.';transferMessage=''}
  function deleteTool(id:string){persist(library.filter(tool=>tool.id!==id));if(selectedToolId===id)selectedToolId=null;libraryMessage='Werkzeug entfernt.';transferMessage=''}
  function newTool(){selectedToolId=null;toolName='Neues Werkzeug';diameter=3;flutes=2;chipLoad=.03;activeTab='data';libraryMessage='';transferMessage=''}
  function applyToOperation(){
    if(!onApplyToOperation||recommendedRpm==null||recommendedFeed==null||!(diameter>0))return;
    onApplyToOperation({toolId:selectedToolId??'tool-calculator',toolName:toolName.trim()||`Fräser ${n(diameter,2)} mm`,diameterMm:diameter,feedMmMin:Math.round(recommendedFeed),spindleRpm:Math.round(recommendedRpm)});
    transferMessage=`Übernommen in ${activeOperationName}: Ø ${n(diameter,2)} mm · ${n(Math.round(recommendedRpm))} 1/min · ${n(Math.round(recommendedFeed))} mm/min.`;
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
      <header class="page-title"><span class="cutter">▥</span><div><h1>Werkzeugdaten</h1><p>Werkzeuggeometrie und Anzahl der wirksamen Schneiden definieren.</p></div></header>
      <p class="section-label">WERKZEUG</p>
      <section class="name-card">
        <b class="field-label">Werkzeugname</b>
        <div class="name-row">
          <input type="text" bind:value={toolName}/>
          <button class="quiet" onclick={newTool}>Neu</button>
          <button class="primary-action" onclick={saveTool}>{selectedToolId?'Aktualisieren':'In Bibliothek speichern'}</button>
        </div>
      </section>
      <section class="diameter-card">
        <div class="field-block"><b>Werkzeug-Ø (d)</b><span class="input-line"><input class="numeric-input" type="number" min="0.1" step="0.1" bind:value={diameter}/><em>mm</em></span></div>
        <div class="tool-drawing" aria-hidden="true"><svg viewBox="0 0 360 90"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22h180c20 0 31 12 31 23s-11 23-31 23H15z"/><path d="M15 22c35 8 47 42 84 46M50 22c35 8 47 42 84 46M85 22c35 8 47 42 84 46M120 22c28 7 40 30 68 43"/><path d="M230 15v60M225 22h10M225 68h10"/></g><text x="242" y="49" font-size="14" fill="currentColor">{n(diameter,2)} mm</text></svg></div>
      </section>
      <div class="two-cards">
        <section class="field-card"><div class="field-block"><b>Schneidenzahl (z)</b><span class="input-line"><input class="numeric-input" type="number" min="1" step="1" bind:value={flutes}/><em>Z</em></span><small>Anzahl der wirksamen Schneiden</small></div></section>
        <section class="field-card"><div class="field-block"><b>Zahnvorschub (fz)</b><span class="input-line"><input class="numeric-input" type="number" min=".001" step=".005" bind:value={chipLoad}/><em>mm</em></span><small>Vorschub pro Zahn</small></div></section>
      </div>
      <section class="recognized"><span>✓</span><div><b>Werkzeug erkannt</b><p>{flutes}-schneidiger Fräser Ø {n(diameter,2)} mm</p></div></section>
      {#if libraryMessage}<p class="inline-message">{libraryMessage}</p>{/if}
      <button class="formula-toggle" onclick={()=>formulaOpen=!formulaOpen}><span>☷ &nbsp; Formeln &amp; Erklärung</span><b>{formulaOpen?'⌃':'⌄'}</b></button>
      {#if formulaOpen}<section class="formula"><code>n = (vc × 1000) / (π × d)</code><code>vf = n × z × fz</code><p>Die vollständige Berechnung und Maschinenbegrenzung liegt im Tab „Drehzahl &amp; Vorschub“.</p></section>{/if}
    </main>

    <aside class="side-column">
      <section class="results"><div class="result-head"><b>AKTUELLER RECHENSTAND</b><span class:warning={!insideProfile}>{insideProfile?'✓ Im Maschinenprofil':'↘ Maschinenlimit aktiv'}</span></div><div class="result-values"><div><p>Drehzahl (n)</p><strong>{n(recommendedRpm)} <small>1/min</small></strong></div><div><p>Vorschub (vf)</p><strong>{n(recommendedFeed)} <small>mm/min</small></strong></div></div></section>
      <section class="card"><h3>Nächster Schritt</h3><p class="body-copy">Werkzeuggeometrie speichern oder direkt zu <b>Drehzahl &amp; Vorschub</b> wechseln. Dort werden Schnittgeschwindigkeit und Maschinenlimits transparent berechnet.</p><button class="wide-button" onclick={()=>activeTab='calculator'}>Drehzahl &amp; Vorschub öffnen →</button></section>
      <section class="hint"><b>ⓘ &nbsp; WERKZEUGBIBLIOTHEK</b><p>Gespeichert werden ausschließlich Werkzeugdaten. Material- und Maschinenwerte bleiben bewusst getrennt, damit kein verstecktes Preset entsteht.</p></section>
    </aside>
  </div>

  {:else if activeTab==='calculator'}
  <div class="content-grid">
    <main class="main-column">
      <header class="page-title"><span class="calc-icon">∑</span><div><h1>Drehzahl &amp; Vorschub</h1><p>Rechnerischen Ausgangspunkt und reale Maschinenlimits getrennt betrachten.</p></div></header>
      <p class="section-label">ZERSPANUNGSDATEN</p>
      <div class="two-cards">
        <section class="field-card"><div class="field-block"><b>Schnittgeschwindigkeit (vc)</b><span class="input-line"><input class="numeric-input" type="number" min="1" step="5" bind:value={cuttingSpeed}/><em>m/min</em></span><small>Herstellerangabe oder bewährter Richtwert</small></div></section>
        <section class="field-card"><div class="field-block"><b>Zahnvorschub (fz)</b><span class="input-line"><input class="numeric-input" type="number" min=".001" step=".005" bind:value={chipLoad}/><em>mm</em></span><small>Wird aus Werkzeugdaten übernommen</small></div></section>
      </div>
      <section class="hero-result"><div><span>Rechnerisch</span><strong>{n(calculated?.spindleRpm)} <small>1/min</small></strong><small>{n(calculated?.feedMmMin)} mm/min</small></div><div class="arrow">→</div><div><span>Für Maschinenprofil</span><strong>{n(recommendedRpm)} <small>1/min</small></strong><small>{n(recommendedFeed)} mm/min</small></div></section>
      <section class="card machine-wide"><h3>Maschinenprofil <small>(optional, aber sichtbar)</small></h3><div class="machine-fields"><label>Max. Drehzahl <span class="mini-input"><input class="machine-input" type="number" min="1" step="500" bind:value={maxSpindleRpm}/><em>1/min</em></span></label><label>Max. Vorschub (XY) <span class="mini-input"><input class="machine-input" type="number" min="1" step="100" bind:value={maxFeedMmMin}/><em>mm/min</em></span></label></div><div class="presets"><button class:active={maxSpindleRpm===12000} onclick={()=>setSpindlePreset(12000)}>12.000</button><button class:active={maxSpindleRpm===18000} onclick={()=>setSpindlePreset(18000)}>18.000</button><button class:active={maxSpindleRpm===24000} onclick={()=>setSpindlePreset(24000)}>24.000</button><button class:active={maxSpindleRpm===30000} onclick={()=>setSpindlePreset(30000)}>30.000</button></div><p class="status" class:warning={!insideProfile}>{insideProfile?'✓ Rechnerische Werte liegen innerhalb der Maschinenlimits.':'Maschinenlimit reduziert die rechnerischen Werte.'}</p></section>
      <button class="formula-toggle" onclick={()=>formulaOpen=!formulaOpen}><span>☷ &nbsp; Formeln &amp; Erklärung</span><b>{formulaOpen?'⌃':'⌄'}</b></button>
      {#if formulaOpen}<section class="formula"><code>n = (vc × 1000) / (π × d)</code><code>vf = n × z × fz</code><code>vf_begrenzt = n_begrenzt × z × fz</code><p>Wird die Drehzahl begrenzt, bleibt die Zahnlast erhalten; der Vorschub wird passend zur realen Spindeldrehzahl neu berechnet.</p></section>{/if}
    </main>
    <aside class="side-column">
      <section class="results"><div class="result-head"><b>EMPFOHLENE EINSTELLUNGEN</b><span class:warning={!insideProfile}>{insideProfile?'✓ Im Maschinenprofil':'↘ Maschinenlimit aktiv'}</span></div><div class="result-values"><div><p>Drehzahl</p><strong>{n(recommendedRpm)} <small>1/min</small></strong></div><div><p>Vorschub</p><strong>{n(recommendedFeed)} <small>mm/min</small></strong></div></div></section>
      <section class="card"><h3>Aktives Werkzeug</h3><div class="kv"><span>Name</span><b>{toolName}</b></div><div class="kv"><span>Durchmesser</span><b>{n(diameter,2)} mm</b></div><div class="kv"><span>Schneiden</span><b>{flutes}</b></div><div class="kv"><span>fz</span><b>{n(chipLoad,3)} mm</b></div></section>
      <section class="apply-card"><div><h3>In aktive Bearbeitung übernehmen</h3><p>Ziel: <b>{activeOperationName}</b></p><p>Übernommen werden ausschließlich Werkzeug, Durchmesser, empfohlene Drehzahl und Vorschub. Tiefe, Zustellung, Eintauchvorschub und Sicherheits-Z bleiben unverändert.</p></div><button class="primary-action apply-button" disabled={!onApplyToOperation||recommendedRpm==null||recommendedFeed==null} onclick={applyToOperation}>Werkzeug &amp; Schnittdaten übernehmen</button>{#if transferMessage}<p class="transfer-message">✓ {transferMessage}</p>{/if}</section>
      <section class="card"><h3>Material · Schnellwahl</h3><div class="material-grid"><button>Holz / MDF</button><button>Kunststoff</button><button>Aluminium</button><button>Stahl</button></div><small>Noch ohne automatische Werte. Presets folgen erst mit dokumentierter Datenbasis.</small></section>
      <section class="hint"><b>ⓘ &nbsp; TRANSPARENZ</b><p>BeBlog CAM zeigt rechnerischen Wert und Maschinenbegrenzung getrennt. Es wird kein versteckter „Hobby-CNC-Faktor“ angewendet. Die CAM-Bearbeitung ändert sich erst durch den expliziten Übernehmen-Button.</p></section>
    </aside>
  </div>

  {:else}
  <div class="library-page">
    <header class="library-head"><div><h1>Werkzeugbibliothek</h1><p>Eigene Fräser lokal speichern, wiederverwenden und gezielt bearbeiten.</p></div><button class="primary-action" onclick={newTool}>+ Neues Werkzeug</button></header>
    {#if library.length===0}
      <section class="library-empty"><strong>Noch keine Werkzeuge gespeichert.</strong><p>Lege unter „Werkzeugdaten“ dein erstes Werkzeug an. Die Bibliothek bleibt lokal auf diesem Rechner.</p><button class="wide-button" onclick={()=>activeTab='data'}>Werkzeug anlegen →</button></section>
    {:else}
      <div class="library-grid">
        {#each library as tool}
          <article class:selected={selectedToolId===tool.id} class="tool-card">
            <div class="tool-card-head"><span class="tool-chip">Ø {n(tool.diameterMm,2)}</span><button class="delete" title="Werkzeug löschen" onclick={()=>deleteTool(tool.id)}>×</button></div>
            <h3>{tool.name}</h3><p>{tool.flutes} Schneiden · fz {n(tool.chipLoadMm,3)} mm</p>
            <div class="tool-actions"><button onclick={()=>editTool(tool)}>Bearbeiten</button><button class="primary-action" onclick={()=>loadTool(tool)}>Auswählen</button></div>
          </article>
        {/each}
      </div>
    {/if}
    {#if libraryMessage}<p class="inline-message library-msg">{libraryMessage}</p>{/if}
    <section class="hint library-hint"><b>Gate 11C · Bibliothek</b><p>Werkzeugdaten werden persistent gespeichert. Das Laden eines Bibliothekswerkzeugs verändert weiterhin keine CAM-Bearbeitung. Die Übergabe erfolgt ausschließlich im Rechner über „Werkzeug &amp; Schnittdaten übernehmen“.</p></section>
  </div>
  {/if}
</div>

<style>
:global(.workspace:has(.tools-page)){grid-template-columns:minmax(0,1fr)!important;min-width:0!important}
:global(.workspace:has(.tools-page)>.viewport){display:none!important}
:global(.workspace:has(.tools-page)>.inspector){display:block!important;width:auto!important;min-width:0!important;padding:0!important;border-left:0!important;overflow:auto!important;background:#fbfbf9!important}
.tools-page{box-sizing:border-box;width:100%;min-width:0;min-height:100%;padding:0 34px 30px;color:#202622;font-size:13px}.tabs{height:60px;display:flex;align-items:end;gap:38px;border-bottom:1px solid #dddeda}.tabs button{padding:0 10px 15px;border:0;background:transparent;font:inherit;cursor:pointer;color:#626964}.tabs button.active{font-weight:700;color:#202622;border-bottom:2px solid #275b3d}.count{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:5px;border-radius:999px;background:#eef1ec;font-size:10px}.content-grid{display:grid;grid-template-columns:minmax(520px,1.05fr) minmax(470px,.95fr);gap:30px;width:min(1260px,100%);margin:22px auto 0}.main-column{padding-right:28px;border-right:1px solid #e0e1dc;min-width:0}.page-title{display:flex;align-items:center;gap:15px}.page-title h1,.library-head h1{margin:0;font-size:27px}.page-title p,.library-head p{margin:5px 0;color:#656b67}.cutter{font-size:36px;transform:rotate(90deg)}.calc-icon{display:grid;place-items:center;width:42px;height:42px;border:1px solid #ccd2cb;border-radius:9px;font-size:23px}.section-label{margin:30px 0 16px;font-weight:700;letter-spacing:.06em}.diameter-card,.field-card,.card,.results,.recognized,.hint,.formula,.name-card,.hero-result,.library-empty,.tool-card,.apply-card{border:1px solid #dfe1dc;border-radius:11px;background:#fff}.name-card{padding:18px;margin-bottom:14px}.field-label{display:block;margin-bottom:10px}.name-row{display:grid;grid-template-columns:minmax(250px,1fr) auto auto;gap:10px;align-items:center}.name-row input{width:100%;min-width:0;height:42px;padding:0 13px;border:1px solid #cfd3cd;border-radius:7px;background:#fff;font-size:14px}.quiet,.primary-action,.wide-button,.tool-actions button,.delete{height:42px;border:1px solid #d5d9d3;border-radius:7px;background:#fff;padding:0 14px;color:#354039;cursor:pointer;white-space:nowrap}.primary-action{background:#285f40;color:#fff;border-color:#285f40}.primary-action:disabled{background:#dfe5df;border-color:#dfe5df;color:#78807a;cursor:not-allowed}.diameter-card{display:grid;grid-template-columns:230px minmax(280px,1fr);gap:24px;align-items:center;padding:20px}.field-block{display:grid;gap:12px;min-width:0}.input-line,.mini-input{display:grid;grid-template-columns:minmax(150px,210px) auto;align-items:center;gap:10px}.numeric-input,.machine-input{box-sizing:border-box!important;width:100%!important;min-width:150px!important;height:44px!important;padding:0 38px 0 12px!important;border:1px solid #cfd3cd!important;border-radius:7px!important;background:#fff!important;text-align:left!important;font-size:16px!important;font-weight:650!important;font-variant-numeric:tabular-nums!important}.machine-input{min-width:160px!important}.input-line em,.mini-input em{font-style:normal;white-space:nowrap}.tool-drawing{min-width:0;overflow:hidden}.tool-drawing svg{width:100%;height:auto;display:block}.two-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.field-card{padding:18px}.field-card small{color:#656b67}.recognized{display:flex;gap:14px;align-items:center;margin-top:14px;padding:18px;background:#f1f7ed;border-color:#d6e5ce}.recognized>span{display:grid;place-items:center;width:28px;height:28px;border:2px solid #2e704b;border-radius:50%;color:#2e704b;font-weight:700}.recognized p{margin:5px 0 0}.inline-message{margin:10px 0 0;padding:9px 11px;border-radius:7px;background:#eef6ea;color:#2d6342}.formula-toggle{width:100%;height:50px;display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:0 18px;border:1px solid #dfe1dc;border-radius:10px;background:#fff;cursor:pointer}.formula{display:grid;gap:8px;margin-top:8px;padding:14px}.formula code{padding:7px;background:#f5f5f2;border-radius:5px}.formula p{margin:0;color:#666}.side-column{display:grid;align-content:start;gap:12px;min-width:0}.results{padding:18px;background:#f0f7eb;border-color:#d4e5cc}.result-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.result-head>span,.status{padding:6px 9px;border-radius:7px;background:#e0efda;color:#28623f;font-size:11px}.warning{background:#f8edd1!important;color:#76591f!important}.result-values{display:grid;grid-template-columns:1fr 1fr;margin-top:14px}.result-values>div+div{border-left:1px solid #cfdcc8;padding-left:24px}.result-values p{margin:0 0 8px}.result-values strong{font-size:27px;color:#255c3d}.result-values small,.kv small,.hero-result small{font-size:11px}.card{padding:16px;min-width:0}.card h3,.apply-card h3{margin:0 0 13px;font-size:14px}.card h3 small{font-weight:400}.body-copy{line-height:1.55;color:#59605c}.wide-button{width:100%;margin-top:10px}.material-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.material-grid button,.presets button{padding:8px;border:1px solid #d8dad5;border-radius:6px;background:#fff;cursor:pointer}.card>small{display:block;margin-top:10px;color:#707570;font-size:10px}.card label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:11px 0;font-size:11px}.mini-input{grid-template-columns:160px auto}.mini-input em{font-size:10px}.status{margin:12px 0 0}.kv{display:flex;justify-content:space-between;gap:8px;margin:10px 0}.hint{padding:14px 16px;background:#f1f6fb;border-color:#cbdced;color:#275d9b}.hint p{margin:7px 0 0;color:#303b43;line-height:1.45}.hero-result{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-top:14px;padding:22px;background:#f5f8f2}.hero-result>div:not(.arrow){display:grid;gap:7px}.hero-result strong{font-size:26px;color:#285f40}.arrow{font-size:25px;color:#8c948f}.machine-wide{margin-top:14px}.machine-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.presets{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.presets button.active{background:#285f40;color:#fff;border-color:#285f40}.apply-card{padding:16px;background:#f8faf7;border-color:#cfdacf}.apply-card p{margin:6px 0;color:#59605c;line-height:1.45}.apply-button{width:100%;margin-top:10px}.transfer-message{padding:9px 11px!important;border-radius:7px;background:#e9f4e5;color:#28623f!important}.library-page{width:min(1180px,100%);margin:0 auto;padding:28px 0}.library-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.tool-card{padding:16px}.tool-card.selected{border-color:#76947d;background:#f5f8f3}.tool-card-head{display:flex;align-items:center;justify-content:space-between}.tool-chip{padding:5px 8px;border-radius:999px;background:#eef2ed;font-size:11px;font-weight:700}.delete{padding:0 8px;border:0;background:transparent;font-size:18px;color:#8b5d58}.tool-card h3{margin:16px 0 6px}.tool-card p{margin:0;color:#69706b}.tool-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:16px}.library-empty{padding:26px;text-align:center}.library-empty p{color:#666d68}.library-msg{max-width:520px}.library-hint{margin-top:20px}.tools-page:after{content:'Klarheit schafft präzise Späne.';display:block;margin:24px 0 0;font-size:12px;color:#303833}
@media(max-width:1180px){.tools-page{padding-inline:18px}.content-grid{grid-template-columns:1fr;max-width:820px}.main-column{padding-right:0;border-right:0}.library-grid{grid-template-columns:1fr 1fr}.name-row{grid-template-columns:minmax(220px,1fr) auto}.name-row .primary-action{grid-column:1/-1;width:100%}}
@media(max-width:820px){.tabs{gap:12px;overflow:auto}.content-grid{margin-top:14px}.diameter-card,.two-cards,.machine-fields{grid-template-columns:1fr}.tool-drawing{display:none}.result-values{grid-template-columns:1fr}.result-values>div+div{border-left:0;border-top:1px solid #cfdcc8;padding:14px 0 0;margin-top:14px}.name-row{grid-template-columns:1fr 1fr}.name-row input{grid-column:1/-1}.name-row .primary-action{grid-column:1/-1}.library-grid{grid-template-columns:1fr}.library-head{align-items:flex-start;flex-direction:column}.presets{grid-template-columns:1fr 1fr}.input-line{grid-template-columns:minmax(180px,1fr) auto}.numeric-input,.machine-input{min-width:180px!important}}
</style>