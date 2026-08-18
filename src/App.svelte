<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import GeometryView from './lib/GeometryView.svelte';
  import type { Curve2, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './lib/types';
  import { defaultStock, defaultPartPlacement, defaultPartOrientation, defaultWcs } from './lib/types';

  const steps = ['Bauteil', 'Rohling', 'Werkzeuge', 'Bearbeiten', 'Prüfen', 'Fräsen'];
  let activeStep = 'Bauteil';
  let importSummary: ImportSummary | null = null;
  let stock: StockDefinition = { ...defaultStock };
  let stockMode: StockMode = 'manual';
  let placement: PartPlacement = { ...defaultPartPlacement };
  let orientation: PartOrientation = { ...defaultPartOrientation };
  let wcs: WorkCoordinateSystem = { ...defaultWcs };
  let error = '';

  function updateStock(field: 'width' | 'height' | 'thickness', event: Event) {
    if (stockMode !== 'manual' && !(importSummary?.kind === 'dxf' && stockMode === 'part-bounds' && field === 'thickness')) return;
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    stock = { ...stock, [field]: value };
  }
  function updatePlacementOffset(field: 'offsetX' | 'offsetY' | 'offsetZ', event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    placement = { ...placement, [field]: value };
  }

  function curvePoints(curve: Curve2) {
    if (curve.kind === 'line') return [curve.start, curve.end];
    if (curve.kind === 'polyline') return curve.points;
    if (curve.kind === 'circle') return Array.from({ length: 65 }, (_, i) => { const a=i/64*Math.PI*2; return {x:curve.center.x+Math.cos(a)*curve.radius,y:curve.center.y+Math.sin(a)*curve.radius}; });
    if (curve.kind === 'arc') { let a=curve.startAngleDeg,b=curve.endAngleDeg; while(b<a)b+=360; return Array.from({length:65},(_,i)=>{const r=(a+(b-a)*i/64)*Math.PI/180;return{x:curve.center.x+Math.cos(r)*curve.radius,y:curve.center.y+Math.sin(r)*curve.radius};}); }
    return [];
  }

  function orientedPartSize(angleDeg = orientation.rotationZDeg) {
    if (!importSummary) return null;
    const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a); let points:{x:number;y:number;z:number}[]=[];
    if(importSummary.kind==='step'){const v=importSummary.brep?.displayVertices??[];for(let i=0;i+2<v.length;i+=3)points.push({x:v[i],y:v[i+1],z:v[i+2]});}
    else points=(importSummary.planarGeometry?.curves??[]).flatMap(curvePoints).map(p=>({...p,z:0}));
    if(!points.length)return null;const rotated=points.map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z})),xs=rotated.map(p=>p.x),ys=rotated.map(p=>p.y),zs=rotated.map(p=>p.z);
    return{width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),thickness:importSummary.kind==='step'?Math.max(...zs)-Math.min(...zs):stock.thickness};
  }
  function applyPartBounds(angleDeg=orientation.rotationZDeg){const size=orientedPartSize(angleDeg);if(!size)return;stock={...stock,width:size.width,height:size.height,thickness:size.thickness};placement={...defaultPartPlacement};}
  function setStockMode(mode:StockMode){if(mode==='none'&&importSummary?.kind!=='dxf')return;stockMode=mode;if(mode==='part-bounds')applyPartBounds();if(mode==='none')placement={...defaultPartPlacement};}
  function setRotationZ(value:number){orientation={...orientation,rotationZDeg:value};if(stockMode==='part-bounds')applyPartBounds(value);}
  function updateRotationZ(event:Event){const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))setRotationZ(value);}

  async function importPart(){error='';const path=await open({multiple:false,directory:false,filters:[{name:'CAD',extensions:['step','stp','dxf']} ]});if(!path||Array.isArray(path))return;try{importSummary=await invoke<ImportSummary>('inspect_import',{path});stockMode='manual';placement={...defaultPartPlacement};orientation={...defaultPartOrientation};wcs={...defaultWcs};}catch(e){error=String(e);}}
</script>
<div class="app-shell">
<header class="topbar"><div><strong>BeBlog CAM</strong><span class="build">001E</span></div><div class="project-name">{importSummary?.fileName??'Neues Projekt'}</div></header>
<aside class="rail" aria-label="Arbeitsablauf">{#each steps as step,i}<button class:active={activeStep===step} onclick={()=>activeStep=step}><span>{String(i+1).padStart(2,'0')}</span>{step}</button>{/each}</aside>
<main class="workspace"><section class="viewport">{#if importSummary}{#key `${importSummary.kind}:${stockMode}:${stock.width}:${stock.height}:${stock.thickness}:${placement.horizontal}:${placement.vertical}:${placement.offsetX}:${placement.offsetY}:${placement.offsetZ}:${orientation.rotationZDeg}:${wcs.x}:${wcs.y}:${wcs.z}`}<GeometryView summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs}/>{/key}<div class="view-label">Aufspannebene → {stockMode==='none'?'Bauteil':'Rohling → Bauteil'} → WCS</div>{:else}<div class="empty-state"><div class="mark">B</div><h1>Ein Bauteil öffnen</h1><p>STEP für exakte 3D-BRep-Geometrie oder DXF für planare Konturen.</p><button class="primary" onclick={importPart}>STEP oder DXF öffnen</button></div>{/if}</section>
<aside class="inspector">
{#if activeStep==='Bauteil'}<p class="eyebrow">01 · Bauteil</p><h2>Geometrie</h2>{#if importSummary}<dl><div><dt>Datei</dt><dd>{importSummary.fileName}</dd></div><div><dt>Format</dt><dd>{importSummary.kind.toUpperCase()}</dd></div><div><dt>Backend</dt><dd>{importSummary.backend}</dd></div><div><dt>Status</dt><dd>{importSummary.status==='ready'?'Bereit':'Native STEP-Anbindung fehlt in diesem Build'}</dd></div></dl><div class="placement-section"><p class="placement-title">Modellorientierung</p><div class="placement-grid"><button class:active={orientation.rotationZDeg===0} onclick={()=>setRotationZ(0)}>0°</button><button class:active={orientation.rotationZDeg===90} onclick={()=>setRotationZ(90)}>90°</button><button class:active={orientation.rotationZDeg===180} onclick={()=>setRotationZ(180)}>180°</button></div><div class="placement-grid two"><button class:active={orientation.rotationZDeg===270} onclick={()=>setRotationZ(270)}>270°</button><button onclick={()=>setRotationZ(0)}>Zurücksetzen</button></div><label>Rotation Z <input type="number" step="1" value={orientation.rotationZDeg} oninput={updateRotationZ}/> °</label><p class="note">Das dreht das Bauteil wirklich relativ zur Aufspannung. Die freie Mausrotation verändert nur die Kamera.</p></div>{#if Object.keys(importSummary.entities).length}<div class="entity-list">{#each Object.entries(importSummary.entities) as [name,count]}<span>{name} <b>{count}</b></span>{/each}</div>{/if}{#if importSummary.brep?.cylinderRadiiMm.length}<p class="note">Erkannte Zylinderradien: {importSummary.brep.cylinderRadiiMm.map(r=>`${r.toFixed(3)} mm`).join(' · ')}</p>{/if}{#if importSummary.note}<p class="note">{importSummary.note}</p>{/if}<button class="secondary" onclick={importPart}>Anderes Bauteil öffnen</button>{:else}<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><button class="primary" onclick={importPart}>Bauteil öffnen</button>{/if}
{:else if activeStep==='Rohling'}<p class="eyebrow">02 · Rohling</p><h2>Rohling</h2><div class="placement-section"><p class="placement-title">Rohling entsteht aus</p><div class="placement-grid"><button class:active={stockMode==='manual'} onclick={()=>setStockMode('manual')}>Maßen</button><button class:active={stockMode==='part-bounds'} onclick={()=>setStockMode('part-bounds')}>Bauteil</button>{#if importSummary?.kind==='dxf'}<button class:active={stockMode==='none'} onclick={()=>setStockMode('none')}>Kein Rohling</button>{/if}</div></div>
{#if stockMode!=='none'}<label>Breite <input type="number" min="0.1" step="0.1" value={stock.width} disabled={stockMode==='part-bounds'} oninput={e=>updateStock('width',e)}/> mm</label><label>Länge <input type="number" min="0.1" step="0.1" value={stock.height} disabled={stockMode==='part-bounds'} oninput={e=>updateStock('height',e)}/> mm</label><label>Dicke <input type="number" min="0.1" step="0.1" value={stock.thickness} disabled={stockMode==='part-bounds'&&importSummary?.kind==='step'} oninput={e=>updateStock('thickness',e)}/> mm</label>{#if stockMode==='part-bounds'}<p class="note"><strong>Bauteil = Rohling.</strong> Breite und Länge folgen der orientierten Geometrie.{#if importSummary?.kind==='step'} Die Dicke kommt ebenfalls aus dem STEP-Modell.{:else} Die DXF enthält keine Materialdicke; diese bleibt separat einstellbar.{/if}</p>{:else}<p class="note">Rohlingabmessungen und Bauteillage aktualisieren die Geometrie live.</p>{/if}
<div class="placement-section"><p class="placement-title">Bauteil im Rohling</p><div class="placement-grid"><button class:active={placement.horizontal==='left'} onclick={()=>placement={...placement,horizontal:'left'}}>Links</button><button class:active={placement.horizontal==='center'} onclick={()=>placement={...placement,horizontal:'center'}}>Zentriert</button><button class:active={placement.horizontal==='right'} onclick={()=>placement={...placement,horizontal:'right'}}>Rechts</button></div><div class="placement-grid"><button class:active={placement.vertical==='front'} onclick={()=>placement={...placement,vertical:'front'}}>Vorne</button><button class:active={placement.vertical==='center'} onclick={()=>placement={...placement,vertical:'center'}}>Mitte</button><button class:active={placement.vertical==='back'} onclick={()=>placement={...placement,vertical:'back'}}>Hinten</button></div><details><summary>Feinkorrektur</summary><label>X <input type="number" step="0.1" value={placement.offsetX} oninput={e=>updatePlacementOffset('offsetX',e)}/> mm</label><label>Y <input type="number" step="0.1" value={placement.offsetY} oninput={e=>updatePlacementOffset('offsetY',e)}/> mm</label><label>Z <input type="number" step="0.1" value={placement.offsetZ} oninput={e=>updatePlacementOffset('offsetZ',e)}/> mm</label></details></div>
{:else}<p class="note"><strong>Kein Rohling.</strong> Die DXF wird direkt als planare Bauteilgeometrie verwendet. Materialabmessungen werden erst verlangt, wenn eine spätere Bearbeitungsstrategie sie wirklich benötigt.</p>{/if}
<div class="placement-section"><p class="placement-title">Werkstücknullpunkt / WCS</p><div class="placement-grid"><button class:active={wcs.x==='left'} onclick={()=>wcs={...wcs,x:'left'}}>Links</button><button class:active={wcs.x==='center'} onclick={()=>wcs={...wcs,x:'center'}}>Mitte</button><button class:active={wcs.x==='right'} onclick={()=>wcs={...wcs,x:'right'}}>Rechts</button></div><div class="placement-grid"><button class:active={wcs.y==='front'} onclick={()=>wcs={...wcs,y:'front'}}>Vorne</button><button class:active={wcs.y==='center'} onclick={()=>wcs={...wcs,y:'center'}}>Mitte</button><button class:active={wcs.y==='back'} onclick={()=>wcs={...wcs,y:'back'}}>Hinten</button></div><div class="placement-grid two"><button class:active={wcs.z==='top'} onclick={()=>wcs={...wcs,z:'top'}}>Oberseite</button><button class:active={wcs.z==='bottom'} onclick={()=>wcs={...wcs,z:'bottom'}}>Unterseite</button></div><p class="note"><strong>Aktiver WCS:</strong> {wcs.x==='left'?'links':wcs.x==='center'?'mittig':'rechts'} · {wcs.y==='front'?'vorne':wcs.y==='center'?'mittig':'hinten'} · {wcs.z==='top'?'Oberseite':'Unterseite'}.</p></div>
{:else}<p class="eyebrow">{String(steps.indexOf(activeStep)+1).padStart(2,'0')} · {activeStep}</p><h2>Noch ruhig.</h2><p>Dieser Bereich wird in einem späteren Build aktiviert.</p>{/if}{#if error}<p class="error">{error}</p>{/if}</aside></main></div>