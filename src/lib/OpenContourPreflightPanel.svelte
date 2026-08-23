<script lang="ts">
  import type { ContourOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
  import { generateOpenContourGcode } from './openContourGcode';
  import { validateOperationGrammar } from './validationGrammar';
  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let placement:PartPlacement;export let orientation:PartOrientation;export let wcs:WorkCoordinateSystem;export let operation:ContourOperation;
  $: path=generateOpenContourGcode({summary,stock,stockMode,placement,orientation,wcs,operation});
  $: grammar=validateOperationGrammar(operation,stock,stockMode,wcs);
  $: errors=[...path.errors,...grammar.filter(c=>c.level==='fail').map(c=>`${c.title}: ${c.detail}`)];
  $: warnings=[...path.warnings,...grammar.filter(c=>c.level==='warn').map(c=>`${c.title}: ${c.detail}`)];
  $: overall=errors.length?'fail':warnings.length?'warn':'pass';
  $: side=operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie';
</script>
<p class="eyebrow">05 · Prüfen</p><h2>Offene Kontur</h2>
<div class="overall" class:pass={overall==='pass'} class:warn={overall==='warn'} class:fail={overall==='fail'}><strong>{overall.toUpperCase()}</strong><span>{overall==='pass'?'Offene Kontur ist freigegeben.':overall==='warn'?'Offene Kontur ist freigabefähig, enthält aber Hinweise.':'Offene Kontur ist nicht freigegeben.'}</span></div>
<div class="facts"><span>Kontur {operation.contourId===null?'—':operation.contourId+1}</span><span>Werkzeugseite {side}</span><span>Ø {operation.tool.diameterMm.toFixed(3)} mm</span><span>{operation.totalDepthMm.toFixed(3)} mm tief</span></div>
{#if path.ok&&path.validation}<div class="check pass"><strong>PASS · Offene Werkzeugbahn</strong><p>{path.pointCount} Punkte · {path.passes} Z-Stufe{path.passes===1?'':'n'} · Sollabstand {path.validation.expectedMm.toFixed(3)} mm · max. Abweichung {path.validation.maxDeviationMm.toFixed(4)} mm. Anfang und Ende bleiben bewusst offen.</p></div>{/if}
<div class="check pass"><strong>PASS · Topologie</strong><p>Die DXF-Kette wird nicht künstlich zwischen ihren Endpunkten geschlossen. Damit kann z. B. der Übergang einer Kopfplatte zum Hals als geschützte offene Seite bestehen bleiben.</p></div>
{#each warnings as message}<div class="check warn"><strong>WARN</strong><p>{message}</p></div>{/each}
{#each errors as message}<div class="check fail"><strong>FAIL</strong><p>{message}</p></div>{/each}
<p class="note"><strong>Grundregel:</strong> Links/Rechts bezieht sich auf die feste Richtung der ausgewählten DXF-Kette. Gleichlauf/Gegenlauf ändert nur die Fahrtrichtung, nicht die gewählte Materialseite.</p>
<style>.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.overall{border-left:2px solid #aaa;background:#f3f3f0;padding:12px 14px;margin:12px 0;display:grid;gap:4px}.overall strong{font-size:.72rem;letter-spacing:.08em}.overall.pass strong,.check.pass strong{color:#2f6b4d}.overall.warn strong,.check.warn strong{color:#9a6a19}.overall.fail strong,.check.fail strong{color:#a13f38}.facts{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.check{padding:10px 12px;margin:7px 0;border-radius:6px;background:#f3f3f0}.check.warn{background:#fbf5e8}.check.fail{background:#fff0ee}.check strong{font-size:.75rem}.check p,.note{margin:4px 0 0;font-size:.8rem;line-height:1.4;color:#626862}.note{margin-top:14px;padding:11px 12px;background:#f3f3f0}</style>
