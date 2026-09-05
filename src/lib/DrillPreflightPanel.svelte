<script lang="ts">
  import type { DrillOperation, ImportSummary, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
  import { validateDrillOperation } from './drillGcode';
  import { buildStepManufacturingFeatureSource } from './stepManufacturingFeatures';
  import { recognizeStepHoles } from './stepHoleRecognition';

  export let summary:ImportSummary;export let operation:DrillOperation;export let stock:StockDefinition;export let stockMode:StockMode;export let wcs:WorkCoordinateSystem;

  $: dxfValidation=summary.kind==='dxf'?validateDrillOperation(summary,operation):null;
  $: stepSource=summary.kind==='step'?buildStepManufacturingFeatureSource(summary):null;
  $: stepRecognition=stepSource?.ok?recognizeStepHoles(stepSource.source):null;
  $: selectedStepIds=operation.stepHoleFeatureIds??[];
  $: stepHoleCount=selectedStepIds.length?selectedStepIds.length:(stepRecognition?.holes.length??0);
  $: warnings=summary.kind==='dxf'
    ?[...(dxfValidation?.warnings??[]),...(stockMode==='none'?['Kein Rohling definiert: Materialgrenzen können nur eingeschränkt geprüft werden.']:[]),...(stockMode!=='none'&&operation.totalDepthMm>stock.thickness?[`Bohrtiefe ${operation.totalDepthMm.toFixed(3)} mm überschreitet die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`]:[])]
    :[
      ...(!selectedStepIds.length&&stepHoleCount?[`Keine Teilmenge gewählt: alle ${stepHoleCount} sicher erkannten STEP-Bohrungen werden bearbeitet.`]:[]),
      ...((stepRecognition?.rejectedCylinderFaceIds.length??0)>0?[`${stepRecognition?.rejectedCylinderFaceIds.length} zylindrische Fläche(n) wurden konservativ nicht als Bohrung klassifiziert.`]:[]),
    ];
  $: errors=summary.kind==='dxf'
    ?[...(dxfValidation?.errors??[]),...(wcs.z!=='top'?['WCS Unterseite ist für Bohren und Helixfräsen nicht freigegeben.']:[])]
    :[
      ...(stepSource&&!stepSource.ok?stepSource.errors:[]),
      ...(operation.method!=='drill'?['STEP-Helixfräsen folgt in 004E; 004D gibt nur axiales Bohren frei.']:[]),
      ...(stockMode==='none'?['STEP-Bohren benötigt einen definierten Rohling.']:[]),
      ...(wcs.z!=='top'?['STEP-Bohren ist aktuell nur mit Z-Null auf der Rohlingoberseite freigegeben.']:[]),
      ...(stepSource?.ok&&!stepHoleCount?['Im STEP/BRep wurden keine sicher erkannten Bohrungen gefunden.']:[]),
    ];
  $: holeCount=summary.kind==='dxf'?(dxfValidation?.holeCount??0):stepHoleCount;
  $: passes=summary.kind==='dxf'?(dxfValidation?.passes??0):Math.max(1,Math.ceil(Math.max(0,operation.totalDepthMm)/Math.max(operation.stepDownMm,1e-9)));
  $: overall=errors.length?'fail':warnings.length?'warn':'pass';
  $: layerText=summary.kind==='step'?(selectedStepIds.length?'STEP-Teilauswahl':'alle erkannten STEP-Bohrungen'):(operation.selectionMode==='layer'?(operation.layerName??'keine Ebene'):'Einzelauswahl');
  $: methodLabel=operation.method==='helical-mill'?'Helixfräsen':'Bohren';
</script>
<p class="eyebrow">05 · Prüfen</p><h2>{methodLabel}</h2>
<div class="release" class:pass={overall==='pass'} class:warn={overall==='warn'} class:fail={overall==='fail'}><strong>{overall.toUpperCase()}</strong><span>{overall==='pass'?`${methodLabel} ist freigegeben.`:overall==='warn'?`${methodLabel} ist freigabefähig, enthält aber Hinweise.`:`${methodLabel} ist noch nicht freigegeben.`}</span></div>
<div class="facts"><span>{holeCount} Bohrposition{holeCount===1?'':'en'}</span><span>{layerText}</span><span>Werkzeug Ø {operation.tool.diameterMm.toFixed(3)} mm</span><span>{operation.method==='helical-mill'?`${operation.stepDownMm.toFixed(3)} mm/U Helix`: `${passes} Zustellung${passes===1?'':'en'} je Bohrung`}</span></div>
<div class="checks"><div><strong>Geometrie</strong><p>{summary.kind==='step'?'Sicher erkannte zylindrische STEP/BRep-Hole-Features liefern Mittelpunkt, Achse, Durchmesser und Tiefe.':'Jeder ausgewählte native DXF-Kreis definiert Bohrungsmittelpunkt und Soll-Durchmesser.'}</p></div><div><strong>Herstellungsverfahren</strong><p>{operation.method==='helical-mill'?'Schaftfräser auf Fräsermittelbahnradius; native G3-Helix mit simultaner Z-Zustellung.':'Explizite G0/G1-Bewegungen: Safe-Z → XY → axial bohren → Rückzug. Keine controllerabhängigen Canned Cycles.'}</p></div><div><strong>Tiefe</strong><p>{summary.kind==='step'?'Die tatsächliche STEP-Bohrtiefe kommt aus den erkannten Zylindergrenzen; stepDown begrenzt die axiale Zustellung.':`${operation.totalDepthMm.toFixed(3)} mm Gesamttiefe · max. ${operation.stepDownMm.toFixed(3)} mm je Zustellung.`}</p></div></div>
{#each errors as message}<p class="error"><strong>FAIL</strong> {message}</p>{/each}{#each warnings as message}<p class="warning"><strong>Hinweis</strong> {message}</p>{/each}
<p class="note"><strong>Prüfregel:</strong> DXF und STEP teilen sich dieselbe Operation, aber nicht dieselbe Geometriequelle. STEP bleibt BRep-first und wird ohne Pseudo-DXF gebohrt.</p>
<style>.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}.release strong{font-size:.72rem;letter-spacing:.08em}.release.pass strong{color:#2f6b4d}.release.warn strong{color:#9a6a19}.release.fail strong{color:#a13f38}.facts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}.facts span{padding:6px 8px;border-radius:6px;background:#eeefeb;font-size:.75rem;color:#555d58}.checks{display:grid;gap:8px}.checks div,.note,.error,.warning{padding:10px 12px;font-size:.8rem;line-height:1.4}.checks div,.note{background:#f3f3f0;color:#666b66}.checks p{margin:4px 0 0}.error{background:#fff0ee;color:#8d3029}.warning{background:#fbf5e8;color:#76591f}</style>
