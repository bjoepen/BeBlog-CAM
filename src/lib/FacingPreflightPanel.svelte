<script lang="ts">
  import type { FacingOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
  import { generateFacingGcode, validateFacing } from './facingGcode';
  export let stock:StockDefinition;export let stockMode:StockMode;export let wcs:WorkCoordinateSystem;export let operation:FacingOperation;
  $: validation=validateFacing({stock,stockMode,wcs,operation});
  $: path=generateFacingGcode({stock,stockMode,wcs,operation});
  $: level=validation.errors.length?'fail':validation.warnings.length?'warn':'pass';
  const n=(v:number,d=3)=>v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
</script>

<p class="eyebrow">05 · Prüfen</p><h2>Planen</h2>
<div class="overall" class:pass={level==='pass'} class:warn={level==='warn'} class:fail={level==='fail'}><strong>{level.toUpperCase()}</strong><span>{level==='pass'?'Planoperation ist mit den aktuellen 001U-Regeln freigegeben.':level==='warn'?'Planoperation ist freigabefähig, enthält aber Hinweise.':'Planoperation ist nicht freigegeben.'}</span></div>
<div class="facts"><span>Rohling {n(stock.width)} × {n(stock.height)} mm</span><span>{operation.direction==='x'?'X-Raster':'Y-Raster'}</span><span>{operation.stepoverPercent}% Stepover</span><span>{n(operation.totalDepthMm)} mm Abtrag</span></div>
{#if path.ok}<div class="check pass"><strong>PASS · Werkzeugweg</strong><p>{path.lanes} Bahnen je Planstufe · {path.levels} Z-Stufe{path.levels===1?'':'n'} · tatsächlicher Bahnabstand {n(path.stepoverMm)} mm. Die Fräsermitte überfährt die Stirnkanten um einen Werkzeugradius, damit die gesamte Rohlingfläche abgedeckt wird.</p></div>{/if}
<div class="check pass"><strong>PASS · Werkzeug</strong><p>{operation.tool.name} · Ø {n(operation.tool.diameterMm)} mm{operation.tool.kind==='face-mill'?' · Planfräser':''}.</p></div>
<div class="check pass"><strong>PASS · Schnittdaten</strong><p>{operation.feedMmMin} mm/min · Eintauchen {operation.plungeMmMin} mm/min · {operation.spindleRpm} 1/min · Sicherheits-Z {n(operation.safeZMm)} mm.</p></div>
{#each validation.warnings as message}<div class="check warn"><strong>WARN</strong><p>{message}</p></div>{/each}
{#each validation.errors as message}<div class="check fail"><strong>FAIL</strong><p>{message}</p></div>{/each}
<p class="note"><strong>001U-Regel:</strong> Planen bearbeitet die komplette rechteckige Rohlingoberseite. Es benötigt keine Konturauswahl. Planfräser sind bevorzugt; Schaftfräser bleiben als praktische Alternative zulässig.</p>

<style>
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.overall{border-left:2px solid #aaa;background:#f3f3f0;padding:12px 14px;margin:12px 0;display:grid;gap:4px}.overall strong{font-size:.72rem;letter-spacing:.08em}.overall.pass strong,.check.pass strong{color:#2f6b4d}.overall.warn strong,.check.warn strong{color:#9a6a19}.overall.fail strong,.check.fail strong{color:#a13f38}.facts{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.check{padding:10px 12px;margin:7px 0;border-radius:6px;background:#f3f3f0}.check.warn{background:#fbf5e8}.check.fail{background:#fff0ee}.check strong{font-size:.75rem}.check p,.note{margin:4px 0 0;font-size:.8rem;line-height:1.4;color:#626862}.note{margin-top:14px;padding:11px 12px;background:#f3f3f0}
</style>
