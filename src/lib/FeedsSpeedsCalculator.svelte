<script lang="ts">
  import { calculateFeedsSpeeds } from './feedsSpeeds';
  let diameter=6, cuttingSpeed=200, flutes=2, chipLoad=.05;
  let maxSpindleRpm=18000, maxFeedMmMin=2000, formulaOpen=false;
  $: valid=[diameter,cuttingSpeed,flutes,chipLoad,maxSpindleRpm,maxFeedMmMin].every(v=>Number.isFinite(v)&&v>0);
  $: calculated=valid?calculateFeedsSpeeds({toolDiameterMm:diameter,cuttingSpeedMMin:cuttingSpeed,flutes,chipLoadMm:chipLoad}):null;
  $: recommendedRpm=calculated?Math.min(calculated.spindleRpm,maxSpindleRpm):null;
  $: feedAtRecommendedRpm=recommendedRpm==null?null:recommendedRpm*flutes*chipLoad;
  $: recommendedFeed=feedAtRecommendedRpm==null?null:Math.min(feedAtRecommendedRpm,maxFeedMmMin);
  $: rpmLimited=!!calculated&&calculated.spindleRpm>maxSpindleRpm;
  $: feedLimited=feedAtRecommendedRpm!=null&&feedAtRecommendedRpm>maxFeedMmMin;
  $: insideProfile=!rpmLimited&&!feedLimited;
  const n=(v:number|null|undefined,d=0)=>v==null?'—':v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
  function setSpindlePreset(v:number){maxSpindleRpm=v}
</script>

<div class="tools-page">
  <nav class="tabs"><button class="active">Werkzeugdaten</button><button>Drehzahl &amp; Vorschub</button><button>Werkzeugbibliothek</button></nav>
  <div class="content-grid">
    <main class="main-column">
      <header class="page-title"><span class="cutter">▥</span><div><h1>Werkzeugdaten</h1><p>Werkzeuggeometrie und Anzahl der wirksamen Schneiden definieren.</p></div></header>
      <p class="section-label">WERKZEUG</p>
      <section class="diameter-card">
        <label><b>Werkzeug-Ø (d)</b><span class="input-line"><input type="number" min="0.1" step="0.1" bind:value={diameter}/><em>mm</em></span></label>
        <div class="tool-drawing" aria-hidden="true"><svg viewBox="0 0 360 90"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M15 22h180c20 0 31 12 31 23s-11 23-31 23H15z"/><path d="M15 22c35 8 47 42 84 46M50 22c35 8 47 42 84 46M85 22c35 8 47 42 84 46M120 22c28 7 40 30 68 43"/><path d="M230 15v60M225 22h10M225 68h10"/></g><text x="242" y="49" font-size="14" fill="currentColor">{n(diameter,2)} mm</text></svg></div>
      </section>
      <div class="two-cards">
        <section class="field-card"><label><b>Schneidenzahl (z)</b><span class="input-line"><input type="number" min="1" step="1" bind:value={flutes}/><em>Z</em></span><small>Anzahl der wirksamen Schneiden</small></label></section>
        <section class="field-card"><label><b>Zahnvorschub (fz)</b><span class="input-line"><input type="number" min=".001" step=".005" bind:value={chipLoad}/><em>mm</em></span><small>Vorschub pro Zahn</small></label></section>
      </div>
      <section class="recognized"><span>✓</span><div><b>Werkzeug erkannt</b><p>{flutes}-schneidiger Fräser Ø {n(diameter,2)} mm</p></div></section>
      <button class="formula-toggle" onclick={()=>formulaOpen=!formulaOpen}><span>☷ &nbsp; Formeln &amp; Erklärung</span><b>{formulaOpen?'⌃':'⌄'}</b></button>
      {#if formulaOpen}<section class="formula"><label>Schnittgeschwindigkeit (vc)<span class="input-line"><input type="number" min="1" step="5" bind:value={cuttingSpeed}/><em>m/min</em></span></label><code>n = (vc × 1000) / (π × d)</code><code>vf = n × z × fz</code><p>Wird die Drehzahl begrenzt, wird der Vorschub mit derselben Zahnlast neu berechnet.</p></section>{/if}
    </main>

    <aside class="side-column">
      <section class="results">
        <div class="result-head"><b>ERGEBNISSE</b><span class:warning={!insideProfile}>{insideProfile?'✓ Im Maschinenprofil':'↘ Maschinenlimit aktiv'}</span></div>
        <div class="result-values"><div><p>Drehzahl (n)</p><strong>{n(recommendedRpm)} <small>1/min</small></strong></div><div><p>Vorschub (vf)</p><strong>{n(recommendedFeed)} <small>mm/min</small></strong></div></div>
      </section>
      <section class="card"><h3>Material · Schnellwahl</h3><div class="material-grid"><button>Holz / MDF</button><button>Kunststoff</button><button>Aluminium</button><button>Stahl</button></div><small>Material-Presets folgen erst mit dokumentierter Datenbasis. Die Auswahl verändert noch keine Werte.</small></section>
      <div class="side-pair">
        <section class="card"><h3>Maschinenprofil <small>(optional)</small></h3><label>Max. Drehzahl <span class="mini-input"><input type="number" bind:value={maxSpindleRpm}/><em>1/min</em></span></label><label>Max. Vorschub (XY) <span class="mini-input"><input type="number" bind:value={maxFeedMmMin}/><em>mm/min</em></span></label><p class="status" class:warning={!insideProfile}>{insideProfile?'✓ Werte liegen innerhalb der Maschinenlimits.':'Maschinenlimit reduziert die Werte.'}</p></section>
        <section class="card"><h3>Empfohlene Einstellungen</h3><div class="kv"><span>Drehzahl</span><b>{n(recommendedRpm)} <small>1/min</small></b></div><div class="kv"><span>Vorschub</span><b>{n(recommendedFeed)} <small>mm/min</small></b></div><p class="blue-note">{rpmLimited?'Drehzahl durch Maschinenprofil begrenzt; Vorschub passend zur Zahnlast berechnet.':feedLimited?'Vorschub durch Maschinenprofil begrenzt.':'Die rechnerischen Werte benötigen keine Begrenzung.'}</p></section>
      </div>
      <div class="side-pair">
        <section class="card"><h3>Schnelle Spindel-Profile</h3><div class="presets"><button class:active={maxSpindleRpm===12000} onclick={()=>setSpindlePreset(12000)}>12.000 1/min</button><button class:active={maxSpindleRpm===18000} onclick={()=>setSpindlePreset(18000)}>18.000 1/min</button><button class:active={maxSpindleRpm===24000} onclick={()=>setSpindlePreset(24000)}>24.000 1/min</button><button class:active={maxSpindleRpm===30000} onclick={()=>setSpindlePreset(30000)}>30.000 1/min</button></div></section>
        <section class="card"><h3>Schnell-Referenz</h3><div class="ref"><span>Holz / MDF</span><b>hohe Drehzahl, hoher Vorschub</b><span>Aluminium</span><b>Spanabfuhr und Kühlung beachten</b><span>Kunststoff</span><b>mäßige Drehzahl, scharfe Werkzeuge</b></div></section>
      </div>
      <section class="hint"><b>ⓘ &nbsp; HINWEIS</b><p>vc-, fz- und Z-Werte sind Empfehlungen des Werkzeugherstellers oder bewährte Richtwerte. Bei Unsicherheit konservativ starten und Ergebnisse beobachten.</p></section>
    </aside>
  </div>
</div>

<style>
:global(.workspace:has(.tools-page)){grid-template-columns:minmax(0,1fr)!important;min-width:0!important}
:global(.workspace:has(.tools-page)>.viewport){display:none!important}
:global(.workspace:has(.tools-page)>.inspector){display:block!important;width:auto!important;min-width:0!important;padding:0!important;border-left:0!important;overflow:auto!important;background:#fbfbf9!important}
.tools-page{box-sizing:border-box;width:100%;min-width:0;min-height:100%;padding:0 28px 26px;color:#202622;font-size:13px}.tabs{height:58px;display:flex;align-items:end;gap:36px;border-bottom:1px solid #dddeda}.tabs button{padding:0 10px 14px;border:0;background:transparent;font:inherit;cursor:pointer}.tabs button.active{font-weight:700;border-bottom:2px solid #275b3d}.content-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:22px;width:min(1320px,100%);margin:20px auto 0}.main-column{padding-right:22px;border-right:1px solid #e0e1dc;min-width:0}.page-title{display:flex;align-items:center;gap:15px}.page-title h1{margin:0;font-size:26px}.page-title p{margin:5px 0;color:#656b67}.cutter{font-size:36px;transform:rotate(90deg)}.section-label{margin:30px 0 16px;font-weight:600;letter-spacing:.06em}.diameter-card,.field-card,.card,.results,.recognized,.hint,.formula{border:1px solid #dfe1dc;border-radius:11px;background:#fff}.diameter-card{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:18px;align-items:center;padding:20px}.diameter-card label,.field-card label{display:grid;gap:12px}.input-line,.mini-input{display:flex;align-items:center;gap:8px}.input-line input{width:100%;min-width:0;padding:9px 12px;border:1px solid #d6d9d3;border-radius:7px;font-weight:700}.input-line em,.mini-input em{font-style:normal;white-space:nowrap}.tool-drawing{min-width:0;overflow:hidden}.tool-drawing svg{width:100%;height:auto;display:block}.two-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.field-card{padding:18px}.field-card small{color:#656b67}.recognized{display:flex;gap:14px;align-items:center;margin-top:14px;padding:18px;background:#f1f7ed;border-color:#d6e5ce}.recognized>span{display:grid;place-items:center;width:28px;height:28px;border:2px solid #2e704b;border-radius:50%;color:#2e704b;font-weight:700}.recognized p{margin:5px 0 0}.formula-toggle{width:100%;display:flex;justify-content:space-between;margin-top:14px;padding:15px 18px;border:1px solid #dfe1dc;border-radius:10px;background:#fff;cursor:pointer}.formula{display:grid;gap:8px;margin-top:8px;padding:14px}.formula label{display:grid;grid-template-columns:1fr minmax(160px,220px);align-items:center}.formula code{padding:7px;background:#f5f5f2;border-radius:5px}.formula p{margin:0;color:#666}.side-column{display:grid;align-content:start;gap:12px;min-width:0}.results{padding:18px;background:#f0f7eb;border-color:#d4e5cc}.result-head{display:flex;justify-content:space-between;align-items:center}.result-head>span,.status{padding:6px 9px;border-radius:7px;background:#e0efda;color:#28623f;font-size:11px}.warning{background:#f8edd1!important;color:#76591f!important}.result-values{display:grid;grid-template-columns:1fr 1fr;margin-top:14px}.result-values>div+div{border-left:1px solid #cfdcc8;padding-left:24px}.result-values p{margin:0 0 8px}.result-values strong{font-size:27px;color:#255c3d}.result-values small,.kv small{font-size:11px}.card{padding:16px;min-width:0}.card h3{margin:0 0 13px;font-size:14px}.card h3 small{font-weight:400}.material-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.material-grid button,.presets button{padding:8px;border:1px solid #d8dad5;border-radius:6px;background:#fff;cursor:pointer}.card>small{display:block;margin-top:10px;color:#707570;font-size:10px}.side-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.card label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:9px 0;font-size:11px}.mini-input{min-width:0}.mini-input input{width:74px;min-width:0;padding:7px;border:1px solid #d6d9d3;border-radius:6px;text-align:right}.mini-input em{font-size:10px}.status{margin:10px 0 0}.kv{display:flex;justify-content:space-between;gap:8px;margin:10px 0}.blue-note{padding:9px;border-radius:6px;background:#edf4fa;color:#49657d;font-size:10px;line-height:1.4}.presets{display:grid;grid-template-columns:1fr 1fr;gap:6px}.presets button{font-size:10px;min-width:0}.presets button.active{background:#285f40;color:#fff;border-color:#285f40}.ref{display:grid;grid-template-columns:.8fr 1.2fr;gap:8px;font-size:10px}.ref b{font-weight:500;color:#535a56}.hint{padding:14px 16px;background:#f1f6fb;border-color:#cbdced;color:#275d9b}.hint p{margin:7px 0 0;color:#303b43;line-height:1.45}.tools-page:after{content:'🦟  Klarheit schafft präzise Späne.';display:block;margin:24px 0 0;font-size:12px;color:#303833}
@media(max-width:1180px){.tools-page{padding-inline:18px}.content-grid{grid-template-columns:1fr;max-width:820px}.main-column{padding-right:0;border-right:0}.side-pair{grid-template-columns:1fr 1fr}}
@media(max-width:820px){.tabs{gap:12px;overflow:auto}.content-grid{margin-top:14px}.diameter-card,.two-cards,.side-pair{grid-template-columns:1fr}.tool-drawing{display:none}.result-values{grid-template-columns:1fr}.result-values>div+div{border-left:0;border-top:1px solid #cfdcc8;padding:14px 0 0;margin-top:14px}.formula label{grid-template-columns:1fr}}
</style>