<script lang="ts">
  import type { ImportSummary, StockDefinition, StockMode, ContourOperation } from './types';
  import { buildClosedChains, offsetPolygon, validateOffsetSegments } from './contourMath';
  export let summary: ImportSummary;
  export let stock: StockDefinition;
  export let stockMode: StockMode;
  export let operation: ContourOperation;

  type Level='pass'|'warn'|'fail';
  type Check={level:Level;title:string;detail:string};

  $: radius=operation.tool.diameterMm/2;
  $: passes=operation.stepDownMm>0?Math.ceil(operation.totalDepthMm/operation.stepDownMm):0;
  $: correction=operation.side==='outside'?radius:operation.side==='inside'?-radius:0;
  $: correctionLabel=operation.side==='outside'?`+${radius.toFixed(3)} mm außen`:operation.side==='inside'?`${(-radius).toFixed(3)} mm innen`:'0,000 mm · auf Linie';
  $: pathValidation=(() => {
    if(summary.kind!=='dxf'||operation.contourId===null)return null;
    const chains=buildClosedChains(summary.planarGeometry?.curves??[]);
    const selected=chains.find(c=>c.id===operation.contourId);if(!selected)return null;
    const actualToolpath=offsetPolygon(selected.points,correction);
    return validateOffsetSegments(selected.points,actualToolpath,correction,.002);
  })();

  $: checks=(():Check[]=>{
    const out:Check[]=[];
    out.push(operation.contourId===null
      ?{level:'fail',title:'Sollkontur',detail:'Keine geschlossene Kontur gewählt. Ohne Sollkontur darf kein Werkzeugweg freigegeben werden.'}
      :{level:'pass',title:'Sollkontur',detail:`Kontur ${operation.contourId+1} ist die maßgebliche CAD-Geometrie. Ihre Koordinaten bleiben das Fertigmaß.`});
    out.push(operation.tool.diameterMm>0
      ?{level:'pass',title:'Werkzeug',detail:`Ø ${operation.tool.diameterMm.toFixed(3)} mm · Radius ${radius.toFixed(3)} mm.`}
      :{level:'fail',title:'Werkzeug',detail:'Werkzeugdurchmesser muss größer als 0 sein.'});
    out.push({level:'pass',title:'Bahnkorrektur',detail:operation.side==='outside'?`Fräsermittelbahn = Sollkontur + ${radius.toFixed(3)} mm nach außen.`:operation.side==='inside'?`Fräsermittelbahn = Sollkontur − ${radius.toFixed(3)} mm nach innen.`:'Fräsermittelbahn = Sollkontur. Keine Radiuskorrektur.'});

    if(summary.kind==='dxf'&&operation.contourId!==null){
      if(!pathValidation){
        out.push({level:'fail',title:'Bahnvermessung',detail:'Die tatsächlich erzeugte Werkzeugbahn konnte nicht gegen die Sollkontur vermessen werden.'});
      }else if(pathValidation.ok){
        out.push({level:'pass',title:'Bahnvermessung',detail:`Soll ${pathValidation.expectedMm.toFixed(3)} mm · Ist ${pathValidation.measuredMinMm.toFixed(3)}–${pathValidation.measuredMaxMm.toFixed(3)} mm · max. Abweichung ${pathValidation.maxDeviationMm.toFixed(4)} mm · ${pathValidation.segmentCount} Segmente geprüft.`});
      }else{
        const side=pathValidation.sideOk?'Seite korrekt':'FALSCHE SEITE';
        out.push({level:'fail',title:'Bahnvermessung',detail:`Soll ${pathValidation.expectedMm.toFixed(3)} mm · Ist ${Number.isFinite(pathValidation.measuredMinMm)?pathValidation.measuredMinMm.toFixed(3):'—'}–${Number.isFinite(pathValidation.measuredMaxMm)?pathValidation.measuredMaxMm.toFixed(3):'—'} mm · max. Abweichung ${Number.isFinite(pathValidation.maxDeviationMm)?pathValidation.maxDeviationMm.toFixed(4):'—'} mm · ${side}.`});
      }
    }

    out.push({level:'pass',title:'Erwartetes Fertigmaß',detail:'Unverändert: maßgeblich bleiben die Koordinaten der Sollkontur. Die Werkzeugbahn ist ausschließlich eine daraus abgeleitete Maschinenbahn.'});
    if(operation.totalDepthMm<=0) out.push({level:'fail',title:'Tiefe',detail:'Gesamttiefe muss größer als 0 sein.'});
    else if(stockMode!=='none'&&operation.totalDepthMm>stock.thickness) out.push({level:'warn',title:'Tiefe',detail:`${operation.totalDepthMm.toFixed(3)} mm überschreiten die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`});
    else if(operation.stepDownMm<=0) out.push({level:'fail',title:'Zustellung',detail:'Zustellung muss größer als 0 sein.'});
    else out.push({level:'pass',title:'Tiefe',detail:`${operation.totalDepthMm.toFixed(3)} mm in ${passes} Zustellung${passes===1?'':'en'} à max. ${operation.stepDownMm.toFixed(3)} mm.`});
    out.push(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0
      ?{level:'pass',title:'Schnittdaten',detail:`${operation.feedMmMin} mm/min · Eintauchen ${operation.plungeMmMin} mm/min · ${operation.spindleRpm} 1/min.`}
      :{level:'fail',title:'Schnittdaten',detail:'Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.'});
    out.push(operation.safeZMm>0?{level:'pass',title:'Sicherheits-Z',detail:`${operation.safeZMm.toFixed(3)} mm über Werkstücknull.`}:{level:'fail',title:'Sicherheits-Z',detail:'Sicherheits-Z muss größer als 0 sein.'});
    if(summary.kind==='dxf'&&stockMode==='none')out.push({level:'warn',title:'Rohling',detail:'DXF wird ohne definierten Rohling bearbeitet. Material- und Kollisionsgrenzen können dadurch nur eingeschränkt geprüft werden.'});
    return out;
  })();
  $: overall=checks.some(c=>c.level==='fail')?'fail':checks.some(c=>c.level==='warn')?'warn':'pass';
</script>

<p class="eyebrow">05 · Prüfen</p><h2>Preflight</h2>
<div class="truth"><strong>Geometrische Wahrheit</strong><span>Sollkontur aus CAD-Koordinaten</span><span>Werkzeugradius {radius.toFixed(3)} mm</span><span>Bahnkorrektur {correctionLabel}</span><span>Fertigmaß unverändert</span></div>
<div class="overall" class:pass={overall==='pass'} class:warn={overall==='warn'} class:fail={overall==='fail'}><strong>{overall.toUpperCase()}</strong><span>{overall==='pass'?'Bearbeitung ist für die aktuellen Prüfregeln freigegeben.':overall==='warn'?'Bearbeitung ist plausibel, enthält aber Hinweise.':'Bearbeitung ist noch nicht freigegeben.'}</span></div>
<div class="checks">{#each checks as check}<div class="check"><span class="status" class:pass={check.level==='pass'} class:warn={check.level==='warn'} class:fail={check.level==='fail'}>{check.level.toUpperCase()}</span><div><strong>{check.title}</strong><p>{check.detail}</p></div></div>{/each}</div>
<p class="note"><strong>Grundregel:</strong> Werkzeugwege dürfen die Sollkontur niemals neu definieren. Die Bahnvermessung prüft die tatsächlich von derselben CAM-Geometrie erzeugte Werkzeugmittelbahn segmentweise gegen die CAD-Kontur.</p>

<style>
  .eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.truth{display:grid;gap:5px;padding:12px 14px;margin:12px 0 16px;background:#f3f3f0;border-left:2px solid #727b75;font-size:.8rem;color:#656a66}.truth strong{color:#333b37}.overall{border-left:2px solid #aaa;background:#f3f3f0;padding:12px 14px;margin:16px 0;display:grid;gap:4px}.overall strong,.status{font-size:.72rem;letter-spacing:.08em}.overall.pass strong,.status.pass{color:#2f6b4d}.overall.warn strong,.status.warn{color:#9a6a19}.overall.fail strong,.status.fail{color:#a13f38}.checks{border-top:1px solid #deded8}.check{display:grid;grid-template-columns:52px 1fr;gap:10px;padding:12px 0;border-bottom:1px solid #deded8}.check strong{font-size:.86rem}.check p{margin:3px 0 0;color:#666b66;font-size:.82rem;line-height:1.35}.status{padding-top:2px}.note{margin-top:16px;padding:11px 12px;background:#f3f3f0;color:#666b66;font-size:.8rem;line-height:1.4}
</style>
