<script lang="ts">
  import { calculateFeedsSpeeds } from './feedsSpeeds';
  let diameter=6;
  let cuttingSpeed=200;
  let flutes=2;
  let chipLoad=.05;
  $: valid=[diameter,cuttingSpeed,flutes,chipLoad].every(v=>Number.isFinite(v)&&v>0);
  $: result=valid?calculateFeedsSpeeds({toolDiameterMm:diameter,cuttingSpeedMMin:cuttingSpeed,flutes,chipLoadMm:chipLoad}):null;
  const n=(value:number|undefined,digits=0)=>value==null?'—':value.toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  function reset(){diameter=6;cuttingSpeed=200;flutes=2;chipLoad=.05;}
</script>

<p class="eyebrow">03 · Werkzeuge</p>
<h2>Drehzahl & Vorschub</h2>
<p class="intro">Grundberechnung aus Werkzeugdurchmesser, Schnittgeschwindigkeit, Schneidenzahl und Zahnvorschub. Der Rechenkern entspricht dem BeBlog Maker Tools Rechner.</p>

<div class="panel">
  <div class="panel-head"><strong>Eingaben</strong><button onclick={reset}>Zurücksetzen</button></div>
  <label>Werkzeugdurchmesser <span><input type="number" min="0.1" step="0.1" bind:value={diameter}/> mm</span></label>
  <label>Schnittgeschwindigkeit <span><input type="number" min="1" step="5" bind:value={cuttingSpeed}/> m/min</span></label>
  <label>Schneidenzahl <span><input type="number" min="1" step="1" bind:value={flutes}/> Z</span></label>
  <label>Zahnvorschub <span><input type="number" min="0.001" step="0.005" bind:value={chipLoad}/> mm</span></label>
  {#if !valid}<p class="error">Alle Eingaben müssen größer als 0 sein.</p>{/if}
</div>

<div class="panel result">
  <strong>Rechnerischer Ausgangspunkt</strong>
  <div class="result-row"><span>Spindeldrehzahl</span><b>{n(result?.spindleRpm)} 1/min</b></div>
  <div class="result-row"><span>Vorschub</span><b>{n(result?.feedMmMin)} mm/min</b></div>
</div>

<div class="formula">
  <strong>Formel</strong>
  <code>n = (vc × 1000) / (π × d)</code>
  <code>vf = n × z × fz</code>
</div>

<p class="note"><strong>Gate 11A:</strong> Noch keine automatische Materialempfehlung und keine versteckte „Hobby-CNC-Korrektur“. Die Werte bleiben nachvollziehbare mathematische Ausgangspunkte. Maschinen-, Werkzeug- und Materialgrenzen werden im nächsten Gate als eigener, sichtbarer Empfehlungs-Layer ergänzt.</p>

<style>
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}h2{margin:.2rem 0 .5rem}.intro,.note{font-size:.8rem;line-height:1.45;color:#666b66}.panel,.formula,.note{margin:12px 0;padding:12px 14px;background:#f3f3f0}.panel{display:grid;gap:9px}.panel-head{display:flex;align-items:center;justify-content:space-between}.panel-head button{border:1px solid #d5d7d2;border-radius:6px;background:#fff;padding:5px 7px;font-size:.72rem;color:#4e5651;cursor:pointer}.panel label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:.78rem}.panel label span{display:flex;align-items:center;gap:5px;color:#69706b}.panel input{width:84px;border:1px solid #d5d7d2;border-radius:6px;background:#fff;padding:6px 7px;color:#39413d}.result{border-left:2px solid #727b75}.result-row{display:flex;align-items:center;justify-content:space-between;padding-top:6px;font-size:.78rem}.result-row b{font-size:.9rem;color:#303a34}.formula{display:grid;gap:7px}.formula code{display:block;padding:7px 8px;background:#fff;border:1px solid #deded8;border-radius:6px;font-size:.75rem}.error{margin:0;padding:8px 9px;background:#fff0ee;color:#8d3029;font-size:.75rem}.note{border-left:2px solid #b3b6b1}
</style>
