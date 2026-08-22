<script lang="ts">
  import { materialKinds, materialProfiles, setStockMaterial, stockMaterial } from './materialContext';

  $: profile = materialProfiles[$stockMaterial];
</script>

<section class="stock-material-card" aria-label="Werkstoff des Rohlings">
  <p class="section-title">Werkstoff</p>
  <div class="material-grid">
    {#each materialKinds as material}
      <button
        type="button"
        class:active={$stockMaterial===material}
        aria-pressed={$stockMaterial===material}
        onclick={()=>setStockMaterial(material)}
      >{materialProfiles[material].shortLabel}</button>
    {/each}
  </div>
  <div class="material-status">
    <strong>{profile.label}</strong>
    <span>Startprofil: vc {profile.cuttingSpeedMMin} m/min · fz-Faktor {profile.chipLoadFactor.toLocaleString('de-DE',{maximumFractionDigits:2})}</span>
  </div>
  <p class="note">{profile.note} 001S verwendet diese Werte als nachvollziehbaren Rechenstart. Eine Bearbeitung wird erst durch „Werkzeug &amp; Schnittdaten übernehmen“ geändert.</p>
</section>

<style>
.stock-material-card{margin:0 0 18px;padding:16px;border:1px solid #dfe1dc;border-radius:10px;background:#fff;color:#28302c}.section-title{margin:0 0 10px;font-size:13px;font-weight:650;color:#4f5753}.material-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.material-grid button{min-width:0;padding:9px 8px;border:1px solid #d5d7d2;border-radius:7px;background:#fff;color:#5f6662;cursor:pointer;font-size:12px}.material-grid button.active{border-color:#59675f;background:#e9ece8;color:#27322c;box-shadow:inset 0 0 0 1px rgba(39,50,44,.08)}.material-status{display:grid;gap:3px;margin-top:12px;padding:10px 11px;border-radius:7px;background:#f1f5ef}.material-status strong{font-size:12px}.material-status span{font-size:11px;color:#5f6762}.note{margin:10px 0 0;color:#696f6b;font-size:11px;line-height:1.45}
</style>
