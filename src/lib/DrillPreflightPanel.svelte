<script lang="ts">
  import type { ImportSummary, DrillOperation } from './types';
  export let summary:ImportSummary;export let operation:DrillOperation;
  $: curves=summary.planarGeometry?.curves??[];
  $: selected=operation.curveIds.map(id=>({id,curve:curves[id]}));
  $: circles=selected.filter(item=>item.curve?.kind==='circle');
  $: invalid=selected.filter(item=>item.curve?.kind!=='circle');
  $: layerText=operation.selectionMode==='layer'?(operation.layerName??'keine Ebene'):'Einzelauswahl';
</script>
<p class="eyebrow">05 · Prüfen</p><h2>Bohren · Gate 9A</h2>
<div class="release" class:pass={circles.length>0&&!invalid.length} class:fail={!circles.length||invalid.length}><strong>{circles.length>0&&!invalid.length?'AUSWAHL PASS':'AUSWAHL FAIL'}</strong><span>Gate 9A prüft ausschließlich Operationsmodell und Bohrgeometrie. Maschinenbewegungen folgen erst in Gate 9B.</span></div>
<div class="facts"><span>{circles.length} Bohrposition{circles.length===1?'':'en'}</span><span>{layerText}</span><span>Werkzeug Ø {operation.tool.diameterMm.toFixed(3)} mm</span></div>
{#if !circles.length}<p class="error"><strong>FAIL</strong> Keine native DXF-Kreiskontur als Bohrposition ausgewählt.</p>{/if}
{#if invalid.length}<p class="error"><strong>FAIL</strong> Gate 9A akzeptiert ausschließlich native DXF-Kreise; {invalid.length} Auswahl{invalid.length===1?'':'en'} ist/sind nicht kompatibel.</p>{/if}
{#if circles.length}<div class="checks"><div><strong>Geometrie</strong><p>Jeder ausgewählte Kreis wird über seinen Mittelpunkt als Bohrposition definiert. Der CAD-Kreis bleibt Referenzgeometrie; in 9A wird noch kein Werkzeugweg erzeugt.</p></div><div><strong>Auswahl bleibt editierbar</strong><p>Einzelne Kreise können auch nach einer Ebenen-Vorauswahl wieder entfernt oder hinzugefügt werden.</p></div></div>{/if}
<p class="note"><strong>Sicherheitsgrenze:</strong> Bohren wird in 9A bewusst nicht in `.nc` exportiert und blockiert einen Gesamtjob. Erst Gate 9B fügt Preflight für Tiefe, Werkzeug, WCS und explizite G0/G1-Bohrbewegungen hinzu.</p>
<style>.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}.release strong{font-size:.72rem;letter-spacing:.08em}.release.pass strong{color:#2f6b4d}.release.fail strong{color:#a13f38}.facts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.checks{display:grid;gap:8px}.checks div,.note,.error{padding:10px 12px;font-size:.8rem;line-height:1.4}.checks div,.note{background:#f3f3f0;color:#666b66}.checks p{margin:4px 0 0}.error{background:#fff0ee;color:#8d3029}</style>
