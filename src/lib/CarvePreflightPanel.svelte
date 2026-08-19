<script lang="ts">
  import type { ImportSummary, StockDefinition, StockMode, CarveOperation } from './types';
  import { validateCarveOperation } from './carveMath';

  export let summary:ImportSummary;
  export let stock:StockDefinition;
  export let stockMode:StockMode;
  export let operation:CarveOperation;

  type Level='pass'|'warn'|'fail';
  type Check={level:Level;title:string;detail:string};

  $: result=validateCarveOperation(summary,operation);
  $: checks=(():Check[]=>{
    const out:Check[]=[];
    if(operation.curveIds.length===0)out.push({level:'fail',title:'Geometrieauswahl',detail:'Keine offene Geometrie ausgewählt.'});
    else out.push({level:'pass',title:'Geometrieauswahl',detail:`${operation.curveIds.length} konkrete Geometrie${operation.curveIds.length===1?'':'n'} ausgewählt${operation.layerName?` · Vorauswahl aus Ebene ${operation.layerName}`:''}. Maßgeblich sind die gespeicherten Geometrie-IDs.`});

    const unsupported=result.errors.filter(e=>e.includes('noch nicht freigegeben'));
    if(unsupported.length)out.push({level:'fail',title:'Carve-Geometrie',detail:unsupported.join(' ')});
    else if(result.segments.length)out.push({level:'pass',title:'Carve-Geometrie',detail:`${result.segments.length} offene DXF-Linie${result.segments.length===1?'':'n'} · gesamte Centerline-Länge ${result.totalLengthMm.toFixed(3)} mm.`});

    if(operation.tool.diameterMm>0)out.push({level:'pass',title:'Werkzeug',detail:`Ø ${operation.tool.diameterMm.toFixed(3)} mm. Beim Carve gibt es keinen seitlichen Werkzeugradius-Offset.`});
    else out.push({level:'fail',title:'Werkzeug',detail:'Werkzeugdurchmesser muss größer als 0 sein.'});

    out.push({level:'pass',title:'Bahnvermessung',detail:'Soll = Ist: Die ausgewählten DXF-Linien selbst sind die Fräsermittellinien. Seitlicher Offset 0.000 mm.'});

    if(operation.totalDepthMm<=0)out.push({level:'fail',title:'Tiefe',detail:'Gesamttiefe muss größer als 0 sein.'});
    else if(operation.stepDownMm<=0)out.push({level:'fail',title:'Zustellung',detail:'Zustellung muss größer als 0 sein.'});
    else if(stockMode!=='none'&&operation.totalDepthMm>stock.thickness)out.push({level:'warn',title:'Tiefe',detail:`${operation.totalDepthMm.toFixed(3)} mm überschreiten die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`});
    else out.push({level:'pass',title:'Tiefe',detail:`${operation.totalDepthMm.toFixed(3)} mm in ${result.passes} Zustellung${result.passes===1?'':'en'} à max. ${operation.stepDownMm.toFixed(3)} mm.`});

    if(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0)out.push({level:'pass',title:'Schnittdaten',detail:`${operation.feedMmMin} mm/min · Eintauchen ${operation.plungeMmMin} mm/min · ${operation.spindleRpm} 1/min.`});
    else out.push({level:'fail',title:'Schnittdaten',detail:'Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.'});

    out.push(operation.safeZMm>0?{level:'pass',title:'Sicherheits-Z',detail:`${operation.safeZMm.toFixed(3)} mm über Werkstücknull.`}:{level:'fail',title:'Sicherheits-Z',detail:'Sicherheits-Z muss größer als 0 sein.'});
    if(stockMode==='none')out.push({level:'warn',title:'Rohling',detail:'Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.'});
    for(const warning of result.warnings)out.push({level:'warn',title:'Auswahlhinweis',detail:warning});
    for(const error of result.errors.filter(e=>!e.includes('noch nicht freigegeben')&&!e.includes('Werkzeugdurchmesser')&&!e.includes('Gesamttiefe')&&!e.includes('Zustellung')&&!e.includes('Schnittdaten')&&!e.includes('Sicherheits-Z')&&!e.includes('Keine Carve-Geometrie')))out.push({level:'fail',title:'Carve-Prüfung',detail:error});
    return out;
  })();
  $: overall=checks.some(c=>c.level==='fail')?'fail':checks.some(c=>c.level==='warn')?'warn':'pass';
</script>

<p class="eyebrow">05 · Prüfen</p><h2>Preflight</h2>
<div class="truth"><strong>Geometrische Wahrheit</strong><span>Carve = DXF-Centerline</span><span>Seitlicher Offset 0.000 mm</span><span>{operation.curveIds.length} konkrete Geometrie{operation.curveIds.length===1?'':'n'} ausgewählt</span><span>Werkzeug Ø {operation.tool.diameterMm.toFixed(3)} mm</span></div>
<div class="overall" class:pass={overall==='pass'} class:warn={overall==='warn'} class:fail={overall==='fail'}><strong>{overall.toUpperCase()}</strong><span>{overall==='pass'?'Carve ist für die aktuellen Gate-6C-Prüfregeln freigegeben.':overall==='warn'?'Carve ist geometrisch plausibel, enthält aber Hinweise.':'Carve ist noch nicht freigegeben.'}</span></div>
<div class="checks">{#each checks as check}<div class="check"><span class="status" class:pass={check.level==='pass'} class:warn={check.level==='warn'} class:fail={check.level==='fail'}>{check.level.toUpperCase()}</span><div><strong>{check.title}</strong><p>{check.detail}</p></div></div>{/each}</div>
<p class="note"><strong>Grundregel:</strong> Beim Carve ist die ausgewählte CAD-Geometrie bereits die Fräsermittellinie. Gate 6C verändert keine XY-Koordinate und gibt zunächst ausschließlich exakte offene DXF-Linien frei.</p>

<style>
  .eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.truth{display:grid;gap:5px;padding:12px 14px;margin:12px 0 16px;background:#f3f3f0;border-left:2px solid #727b75;font-size:.8rem;color:#656a66}.truth strong{color:#333b37}.overall{border-left:2px solid #aaa;background:#f3f3f0;padding:12px 14px;margin:16px 0;display:grid;gap:4px}.overall strong,.status{font-size:.72rem;letter-spacing:.08em}.overall.pass strong,.status.pass{color:#2f6b4d}.overall.warn strong,.status.warn{color:#9a6a19}.overall.fail strong,.status.fail{color:#a13f38}.checks{border-top:1px solid #deded8}.check{display:grid;grid-template-columns:52px 1fr;gap:10px;padding:12px 0;border-bottom:1px solid #deded8}.check strong{font-size:.86rem}.check p{margin:3px 0 0;color:#666b66;font-size:.82rem;line-height:1.35}.status{padding-top:2px}.note{margin-top:16px;padding:11px 12px;background:#f3f3f0;color:#666b66;font-size:.8rem;line-height:1.4}
</style>
