<script lang="ts">
  import type { ContourOperation, ImportSummary, StockDefinition, StockMode } from './types';
  import { buildClosedChains } from './contourMath';
  import { buildBrokenContourPath } from './brokenContour';
  import { validateToolCompatibility } from './validationGrammar';
  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let operation:ContourOperation;
  $: chains=buildClosedChains(summary.planarGeometry?.curves??[]);
  $: selected=operation.contourId===null?null:chains.find(c=>c.id===operation.contourId)??null;
  $: excluded=operation.excludedSegmentIds??[];
  $: broken=selected?buildBrokenContourPath(selected.points,excluded,operation.tool.diameterMm/2,operation.side,.003):null;
  $: compatibility=validateToolCompatibility(operation);
  $: errors=[
    ...(summary.kind!=='dxf'?['Aufgebrochene Konturen sind zunächst nur aus DXF freigegeben.']:[]),
    ...(operation.contourId===null?['Keine geschlossene Sollkontur gewählt.']:[]),
    ...(operation.contourId!==null&&!selected?['Gewählte Sollkontur wurde nicht gefunden.']:[]),
    ...(!excluded.length?['Keine Konturstrecke ist abgewählt.']:[]),
    ...(broken&&!broken.activeSegmentCount?['Alle Konturstrecken sind abgewählt.']:[]),
    ...(broken&&!broken.validation.ok?[broken.validation.selfIntersects?'Die radiuskorrigierte Teilkontur schneidet sich selbst.':'Die aktive Teilkontur hält die Werkzeugradiuskorrektur geometrisch nicht sauber ein.']:[]),
    ...(compatibility.level==='fail'?[`${compatibility.title}: ${compatibility.detail}`]:[]),
    ...(operation.totalDepthMm<=0?['Gesamttiefe muss größer als 0 sein.']:[]),
    ...(operation.stepDownMm<=0?['Zustellung muss größer als 0 sein.']:[]),
    ...(!(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0)?['Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.']:[]),
    ...(operation.safeZMm<=0?['Sicherheits-Z muss größer als 0 sein.']:[])
  ];
  $: warnings=[...(stockMode==='none'?['Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.']:[]),...(stockMode!=='none'&&operation.totalDepthMm>stock.thickness?[`${operation.totalDepthMm.toFixed(3)} mm überschreiten die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`]:[]),...(compatibility.level==='warn'?[`${compatibility.title}: ${compatibility.detail}`]:[])];
  $: overall=errors.length?'fail':warnings.length?'warn':'pass';
</script>
<p class="eyebrow">05 · Prüfen</p><h2>Aufgebrochene Kontur</h2>
<div class="overall" class:pass={overall==='pass'} class:warn={overall==='warn'} class:fail={overall==='fail'}><strong>{overall.toUpperCase()}</strong><span>{overall==='pass'?'Teilkontur ist freigegeben.':overall==='warn'?'Teilkontur ist freigabefähig, enthält aber Hinweise.':'Teilkontur ist nicht freigegeben.'}</span></div>
{#if broken}<div class="facts"><span>Aktiv {broken.activeSegmentCount}/{broken.segmentCount}</span><span>Aus {broken.excludedSegmentCount}</span><span>{broken.runs.length} zusammenhängende Teilkontur{broken.runs.length===1?'':'en'}</span><span>Ø {operation.tool.diameterMm.toFixed(3)} mm</span></div>{/if}
{#if broken?.validation.ok}<div class="check pass"><strong>PASS · Werkzeugbahn</strong><p>Sollabstand {broken.validation.expectedMm.toFixed(3)} mm · max. Abweichung {broken.validation.maxDeviationMm.toFixed(4)} mm. Ausgeschaltete Strecken werden nicht durch eine Ersatzverbindung geschlossen.</p></div>{/if}
<div class="check pass"><strong>PASS · Topologie</strong><p>Die CAD-Kontur bleibt geschlossen und damit maßhaltige Sollgeometrie. Nur die Bearbeitung wird an den abgewählten Strecken geöffnet.</p></div>
{#each warnings as message}<div class="check warn"><strong>WARN</strong><p>{message}</p></div>{/each}
{#each errors as message}<div class="check fail"><strong>FAIL</strong><p>{message}</p></div>{/each}
<p class="note"><strong>Sicherheitsregel:</strong> Keine aktive Teilkontur darf automatisch über eine abgewählte Strecke hinweg verbunden werden. Zwischen getrennten Teilkonturen wird vor jeder XY-Verfahrt auf Sicherheits-Z zurückgezogen.</p>
<style>.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.overall{border-left:2px solid #aaa;background:#f3f3f0;padding:12px 14px;margin:12px 0;display:grid;gap:4px}.overall strong{font-size:.72rem;letter-spacing:.08em}.overall.pass strong,.check.pass strong{color:#2f6b4d}.overall.warn strong,.check.warn strong{color:#9a6a19}.overall.fail strong,.check.fail strong{color:#a13f38}.facts{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.check{padding:10px 12px;margin:7px 0;border-radius:6px;background:#f3f3f0}.check.warn{background:#fbf5e8}.check.fail{background:#fff0ee}.check strong{font-size:.75rem}.check p,.note{margin:4px 0 0;font-size:.8rem;line-height:1.4;color:#626862}.note{margin-top:14px;padding:11px 12px;background:#f3f3f0}</style>
