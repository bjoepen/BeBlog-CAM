<script lang="ts">
  import type { ContourOperation, ImportSummary, StockDefinition, StockMode } from './types';
  import { buildOpenChains, offsetOpenChain } from './openContour';
  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let operation:ContourOperation;
  $: chains=buildOpenChains(summary.planarGeometry?.curves??[]);
  $: selected=operation.contourId===null?null:chains.find(c=>c.id===operation.contourId)??null;
  $: path=selected?offsetOpenChain(selected.points,operation.tool.diameterMm/2,operation.openSide,.003):null;
  $: errors=[
    ...(summary.kind!=='dxf'?['Offene Konturen sind zunächst nur aus DXF freigegeben.']:[]),
    ...(operation.contourId===null?['Keine offene Kontur gewählt.']:[]),
    ...(operation.contourId!==null&&!selected?['Gewählte offene Kontur wurde nicht gefunden.']:[]),
    ...(operation.tool.diameterMm<=0?['Werkzeugdurchmesser muss größer als 0 sein.']:[]),
    ...(operation.totalDepthMm<=0?['Gesamttiefe muss größer als 0 sein.']:[]),
    ...(operation.stepDownMm<=0?['Zustellung muss größer als 0 sein.']:[]),
    ...(!(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0)?['Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.']:[]),
    ...(operation.safeZMm<=0?['Sicherheits-Z muss größer als 0 sein.']:[]),
    ...(path&&!path.validation.ok?[path.validation.selfIntersects?'Die radiuskorrigierte offene Werkzeugbahn schneidet sich selbst.':'Die Werkzeugbahn hält den Werkzeugradius nicht geometrisch sauber ein.']:[])
  ];
  $: warnings=[...(stockMode==='none'?['Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.']:[]),...(stockMode!=='none'&&operation.totalDepthMm>stock.thickness?[`${operation.totalDepthMm.toFixed(3)} mm überschreiten die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`]:[])];
  $: overall=errors.length?'fail':warnings.length?'warn':'pass';
  $: side=operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie';
  $: passes=operation.stepDownMm>0?Math.ceil(operation.totalDepthMm/operation.stepDownMm):0;
</script>
<p class="eyebrow">05 · Prüfen</p><h2>Offene Kontur</h2>
<div class="overall" class:pass={overall==='pass'} class:warn={overall==='warn'} class:fail={overall==='fail'}><strong>{overall.toUpperCase()}</strong><span>{overall==='pass'?'Offene Kontur ist freigegeben.':overall==='warn'?'Offene Kontur ist freigabefähig, enthält aber Hinweise.':'Offene Kontur ist nicht freigegeben.'}</span></div>
<div class="facts"><span>Kontur {operation.contourId===null?'—':operation.contourId+1}</span><span>Werkzeugseite {side}</span><span>Ø {operation.tool.diameterMm.toFixed(3)} mm</span><span>{operation.totalDepthMm.toFixed(3)} mm tief</span></div>
{#if path?.validation.ok}<div class="check pass"><strong>PASS · Offene Werkzeugbahn</strong><p>{path.points.length} Punkte · {passes} Z-Stufe{passes===1?'':'n'} · Sollabstand {path.validation.expectedMm.toFixed(3)} mm · max. Abweichung {path.validation.maxDeviationMm.toFixed(4)} mm. Anfang und Ende bleiben bewusst offen.</p></div>{/if}
<div class="check pass"><strong>PASS · Topologie</strong><p>Die DXF-Kette wird nicht künstlich zwischen ihren Endpunkten geschlossen. Damit bleibt eine bewusst offene Bauteilseite erhalten.</p></div>
{#each warnings as message}<div class="check warn"><strong>WARN</strong><p>{message}</p></div>{/each}
{#each errors as message}<div class="check fail"><strong>FAIL</strong><p>{message}</p></div>{/each}
<p class="note"><strong>Grundregel:</strong> Links/Rechts bezieht sich auf die feste Richtung der ausgewählten DXF-Kette. Die Fahrtrichtung darf diese Materialseite nicht verändern.</p>
<style>.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.overall{border-left:2px solid #aaa;background:#f3f3f0;padding:12px 14px;margin:12px 0;display:grid;gap:4px}.overall strong{font-size:.72rem;letter-spacing:.08em}.overall.pass strong,.check.pass strong{color:#2f6b4d}.overall.warn strong,.check.warn strong{color:#9a6a19}.overall.fail strong,.check.fail strong{color:#a13f38}.facts{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.check{padding:10px 12px;margin:7px 0;border-radius:6px;background:#f3f3f0}.check.warn{background:#fbf5e8}.check.fail{background:#fff0ee}.check strong{font-size:.75rem}.check p,.note{margin:4px 0 0;font-size:.8rem;line-height:1.4;color:#626862}.note{margin-top:14px;padding:11px 12px;background:#f3f3f0}</style>
