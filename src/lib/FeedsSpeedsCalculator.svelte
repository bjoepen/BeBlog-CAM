<script lang="ts">
  import { calculateFeedsSpeeds } from './feedsSpeeds';

  let diameter=6;
  let cuttingSpeed=200;
  let flutes=2;
  let chipLoad=.05;
  let machineProfileEnabled=true;
  let maxSpindleRpm=18000;
  let maxFeedMmMin=2000;
  let formulaOpen=false;

  $: valid=[diameter,cuttingSpeed,flutes,chipLoad,maxSpindleRpm,maxFeedMmMin].every(v=>Number.isFinite(v)&&v>0);
  $: calculated=valid?calculateFeedsSpeeds({toolDiameterMm:diameter,cuttingSpeedMMin:cuttingSpeed,flutes,chipLoadMm:chipLoad}):null;
  $: recommendedRpm=calculated?(machineProfileEnabled?Math.min(calculated.spindleRpm,maxSpindleRpm):calculated.spindleRpm):null;
  $: feedAtRecommendedRpm=recommendedRpm==null?null:recommendedRpm*flutes*chipLoad;
  $: recommendedFeed=feedAtRecommendedRpm==null?null:(machineProfileEnabled?Math.min(feedAtRecommendedRpm,maxFeedMmMin):feedAtRecommendedRpm);
  $: rpmLimited=!!calculated&&machineProfileEnabled&&calculated.spindleRpm>maxSpindleRpm;
  $: feedLimited=feedAtRecommendedRpm!=null&&machineProfileEnabled&&feedAtRecommendedRpm>maxFeedMmMin;
  $: insideProfile=!rpmLimited&&!feedLimited;

  const n=(value:number|null|undefined,digits=0)=>value==null?'—':value.toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  function reset(){diameter=6;cuttingSpeed=200;flutes=2;chipLoad=.05;machineProfileEnabled=true;maxSpindleRpm=18000;maxFeedMmMin=2000;}
  function setSpindlePreset(value:number){maxSpindleRpm=value;machineProfileEnabled=true;}
</script>

<div class="tool-shell">
  <header class="tool-head">
    <div class="tool-title">
      <div class="endmill-icon" aria-hidden="true">▥</div>
      <div><h1>Drehzahl & Vorschub</h1><p>Schnittdaten für Werkzeug und Material berechnen</p></div>
    </div>
    <label class="profile-toggle"><span>Hobby-CNC Profil</span><input type="checkbox" bind:checked={machineProfileEnabled}/><i></i></label>
  </header>

  <div class="tool-columns">
    <div class="left-column">
      <section class="input-card">
        <label><span>Werkzeug-Ø</span><div class="field"><input type="number" min="0.1" step="0.1" bind:value={diameter}/><b>mm</b></div></label>
        <label><span>Schnittgeschwindigkeit</span><div class="field"><input type="number" min="1" step="5" bind:value={cuttingSpeed}/><b>m/min</b></div></label>
        <label><span>Schneidenzahl</span><div class="field"><input type="number" min="1" step="1" bind:value={flutes}/><b>Z</b></div></label>
        <label><span>Zahnvorschub (fz)</span><div class="field"><input type="number" min="0.001" step="0.005" bind:value={chipLoad}/><b>mm</b></div></label>
      </section>

      {#if !valid}<p class="validation">Alle Werte müssen größer als 0 sein.</p>{/if}

      <section class="hero-result">
        <div><span>Drehzahl (n)</span><strong>{n(recommendedRpm)} <small>1/min</small></strong></div>
        <div class="divider"></div>
        <div><span>Vorschub (vf)</span><strong>{n(recommendedFeed)} <small>mm/min</small></strong></div>
        <div class:limited={!insideProfile} class="profile-state">{insideProfile?'✓ Im Maschinenprofil':'↘ Maschinenlimit aktiv'}</div>
      </section>

      <div class="advice-grid">
        <section class="card tips">
          <h3>Schnitttipps (Hobby-CNC)</h3>
          <p>✓ Rechnerische Werte als Startpunkt behandeln.</p>
          <p>✓ Bei unsicherer Aufspannung zunächst 10–20 % konservativer fahren.</p>
          <p>✓ Kleine Fräser und lange Auskragung besonders vorsichtig behandeln.</p>
          <p>✓ Werkzeugherstellerangaben haben Vorrang.</p>
        </section>
        <section class="card materials">
          <h3>Material · Schnellwahl</h3>
          <div class="material-buttons"><button>Holz / MDF</button><button>Kunststoff</button><button>Aluminium</button><button>Stahl</button></div>
          <p>Material-Presets folgen erst mit dokumentierter Datenbasis. Die Auswahl verändert in 11A noch keine Werte.</p>
        </section>
      </div>

      <section class="info-note"><strong>Hinweis</strong><span>Die Werte sind nachvollziehbare Richtwerte. Bei kleinen Werkzeugen, unsicherer Aufspannung oder einer leichten Maschine konservativ starten und das Fräsbild beobachten.</span></section>

      <button class="formula-toggle" onclick={()=>formulaOpen=!formulaOpen}><span>Formeln & Erklärung</span><b>{formulaOpen?'⌃':'⌄'}</b></button>
      {#if formulaOpen}<section class="formula"><code>n = (vc × 1000) / (π × d)</code><code>vf = n × z × fz</code><p>Wird die Spindeldrehzahl durch das Maschinenprofil begrenzt, wird der Vorschub mit derselben Zahnlast neu berechnet. So bleibt fz transparent erhalten.</p></section>{/if}
    </div>

    <aside class="right-column">
      <section class="card calculated-card">
        <h3>Berechnete Werte</h3>
        <div class="metric"><span>Drehzahl (n)</span><strong>{n(calculated?.spindleRpm)} <small>1/min</small></strong></div>
        <div class="metric"><span>Vorschub (vf)</span><strong>{n(calculated?.feedMmMin)} <small>mm/min</small></strong></div>
      </section>

      <section class="card machine-card">
        <div class="card-head"><h3>Maschinenprofil</h3><button onclick={reset}>Zurücksetzen</button></div>
        <label><span>Max. Drehzahl</span><div class="compact-field"><input type="number" min="1" step="500" bind:value={maxSpindleRpm}/><b>1/min</b></div></label>
        <label><span>Max. Vorschub</span><div class="compact-field"><input type="number" min="1" step="100" bind:value={maxFeedMmMin}/><b>mm/min</b></div></label>
        <div class="machine-message" class:warning={!insideProfile}>{insideProfile?'✓ Werte liegen innerhalb der Maschinenlimits.':'Maschinenlimit reduziert die rechnerischen Werte.'}</div>
      </section>

      <section class="card recommended-card">
        <h3>Empfohlene Einstellungen</h3>
        <div class="compare"><span>Drehzahl</span><strong>{n(calculated?.spindleRpm)} → {n(recommendedRpm)} <small>1/min</small></strong></div>
        <div class="compare"><span>Vorschub</span><strong>{n(calculated?.feedMmMin)} → {n(recommendedFeed)} <small>mm/min</small></strong></div>
        {#if rpmLimited}<p>Die Drehzahl ist durch die Spindel begrenzt; der Vorschub wurde passend zur Zahnlast neu berechnet.</p>{:else if feedLimited}<p>Der Vorschub ist durch das Maschinenprofil begrenzt.</p>{:else}<p>Die rechnerischen Werte benötigen keine Begrenzung.</p>{/if}
      </section>

      <section class="card preset-card">
        <h3>Schnelle Spindel-Profile</h3>
        <div class="presets"><button class:active={maxSpindleRpm===12000} onclick={()=>setSpindlePreset(12000)}>12.000</button><button class:active={maxSpindleRpm===18000} onclick={()=>setSpindlePreset(18000)}>18.000</button><button class:active={maxSpindleRpm===24000} onclick={()=>setSpindlePreset(24000)}>24.000</button></div>
        <small>1/min · oder Wert oben frei eingeben</small>
      </section>

      <section class="card quick-ref"><h3>Schnell-Referenz</h3><p><span>Holz / MDF</span><b>hohe Drehzahl, passende Spanlast</b></p><p><span>Aluminium</span><b>Spanabfuhr und Steifigkeit beachten</b></p><p><span>Kunststoff</span><b>Wärme vermeiden</b></p></section>
    </aside>
  </div>

  <div class="flea-signoff" title="Der CNC-Floh passt auf die Zahlen auf">
    <svg viewBox="0 0 120 76" role="img" aria-label="CNC-Floh"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="54" cy="39" rx="19" ry="23"/><circle cx="48" cy="32" r="2" fill="currentColor"/><circle cx="61" cy="32" r="2" fill="currentColor"/><path d="M47 44c5 4 10 4 15 0M37 25 25 15m13 31-17 7m20 5-12 13m40-45 13-10m-9 30 18 8m-20 5 12 12"/><path d="M82 18h15v34H82zM86 23h7M86 29h7M86 35h7M86 41h7"/></g></svg>
    <span>Klarheit schafft präzise Späne.</span>
  </div>
</div>

<style>
:global(.tools-workspace){grid-template-columns:1fr!important}:global(.tools-workspace .inspector){display:none!important}:global(.tools-workspace .viewport){overflow:auto!important;align-items:stretch!important;justify-content:stretch!important;background:#fafaf8!important}
.tool-shell{box-sizing:border-box;width:100%;min-height:100%;padding:30px 34px 34px;background:#fbfbf9;color:#222b26;font-size:13px}.tool-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}.tool-title{display:flex;align-items:center;gap:15px}.tool-title h1{margin:0;font-size:26px;letter-spacing:-.03em}.tool-title p{margin:5px 0 0;color:#666f69}.endmill-icon{width:42px;height:42px;display:grid;place-items:center;font-size:35px;transform:rotate(90deg)}.profile-toggle{display:flex;align-items:center;gap:10px;padding:8px 11px;border:1px solid #dfe3dd;border-radius:10px;background:#f3f7f2;font-weight:600}.profile-toggle input{position:absolute;opacity:0}.profile-toggle i{width:34px;height:19px;border-radius:999px;background:#c8cec9;position:relative;transition:.15s}.profile-toggle i:after{content:'';position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 3px #0002}.profile-toggle input:checked+i{background:#2f6b4d}.profile-toggle input:checked+i:after{transform:translateX(15px)}.tool-columns{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:26px}.left-column,.right-column{display:grid;align-content:start;gap:14px}.input-card,.card,.hero-result,.info-note,.formula{border:1px solid #e0e3de;border-radius:12px;background:#fff}.input-card{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px}.input-card label{display:grid;gap:7px;font-weight:600}.field,.compact-field{display:flex;align-items:center;border:1px solid #d9ddd7;border-radius:8px;background:#fff;overflow:hidden}.field input,.compact-field input{min-width:0;width:100%;border:0;outline:none;padding:9px 10px;background:transparent;color:#263029;font-weight:700}.field b,.compact-field b{padding-right:9px;white-space:nowrap;color:#69706b;font-size:11px}.validation{margin:0;padding:9px 11px;border-radius:8px;background:#fff0ee;color:#8d3029}.hero-result{display:grid;grid-template-columns:1fr auto 1fr auto;gap:22px;align-items:center;padding:20px 24px;background:#f0f7eb;border-color:#d8e8ce}.hero-result>div:not(.divider):not(.profile-state){display:grid;gap:6px}.hero-result span{font-weight:600}.hero-result strong{font-size:28px;letter-spacing:-.03em}.hero-result small,.metric small,.compare small{font-size:11px;font-weight:500}.divider{width:1px;height:54px;background:#a9c69b}.profile-state{padding:8px 10px;border-radius:8px;background:#dfeeda;color:#2f6b4d;font-weight:700;white-space:nowrap}.profile-state.limited{background:#f7edcf;color:#76591f}.advice-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.card{padding:16px}.card h3{margin:0 0 12px;font-size:15px}.tips p{margin:8px 0;color:#49514c}.materials p{margin:11px 0 0;color:#717771;font-size:11px;line-height:1.4}.material-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}.material-buttons button,.presets button,.card-head button,.formula-toggle{border:1px solid #d8ddd7;background:#fff;border-radius:8px;color:#3f4842;cursor:pointer}.material-buttons button{padding:9px}.info-note{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:13px 15px;background:#f2f8ef;border-color:#d5e6cc;line-height:1.45}.formula-toggle{display:flex;justify-content:space-between;padding:12px 14px;text-align:left}.formula{display:grid;gap:7px;padding:12px}.formula code{padding:7px;background:#f7f7f4;border-radius:6px}.formula p{margin:3px 0;color:#666e69;line-height:1.45}.metric,.compare{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}.metric strong,.compare strong{font-size:16px}.machine-card label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:9px 0}.compact-field{width:155px}.card-head{display:flex;justify-content:space-between;align-items:center}.card-head h3{margin:0}.card-head button{padding:5px 7px;font-size:10px}.machine-message{margin-top:12px;padding:9px;border-radius:8px;background:#e6f2e2;color:#2f6b4d;font-weight:600;font-size:11px}.machine-message.warning{background:#fbf2d9;color:#76591f}.recommended-card p{margin:12px 0 0;padding:9px;border-radius:8px;background:#eef5fb;color:#536575;font-size:11px;line-height:1.4}.presets{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.presets button{padding:8px 5px;font-size:11px}.presets button.active{background:#2f6b4d;color:#fff;border-color:#2f6b4d}.preset-card>small{display:block;margin-top:8px;color:#777}.quick-ref p{display:flex;justify-content:space-between;gap:10px;margin:8px 0;font-size:11px}.quick-ref b{text-align:right;font-weight:500;color:#636b66}.flea-signoff{display:flex;align-items:center;gap:8px;margin-top:18px;color:#59635d;font-size:11px}.flea-signoff svg{width:74px;height:48px;color:#2f3a34}.flea-signoff span{max-width:120px;font-weight:600}@media(max-width:1100px){.tool-columns{grid-template-columns:1fr}.input-card{grid-template-columns:1fr 1fr}.right-column{grid-template-columns:1fr 1fr}.quick-ref{grid-column:1/-1}}@media(max-width:760px){.tool-shell{padding:20px}.input-card,.right-column,.advice-grid{grid-template-columns:1fr}.hero-result{grid-template-columns:1fr}.divider{display:none}.tool-head{align-items:flex-start;flex-direction:column}}
</style>
