<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import GeometryView from './lib/GeometryView.svelte';
  import ContourOverlay from './lib/ContourOverlay.svelte';
  import PreflightPanel from './lib/PreflightPanel.svelte';
  import FacingPreflightPanel from './lib/FacingPreflightPanel.svelte';
  import CarvePreflightPanel from './lib/CarvePreflightPanel.svelte';
  import DrillPreflightPanel from './lib/DrillPreflightPanel.svelte';
  import ZLevelRoughingPreflightPanel from './lib/ZLevelRoughingPreflightPanel.svelte';
  import JobPreflightPanel from './lib/JobPreflightPanel.svelte';
  import JobGCodePanel from './lib/JobGCodePanel.svelte';
  import type { CanonicalToolpath } from './lib/canonicalToolpath';
  import FeedsSpeedsCalculator from './lib/FeedsSpeedsCalculator.svelte';
  import type { MillingToolKind } from './lib/toolTypes';
  import type { Curve2, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, CamOperation, FacingOperation, ContourOperation, PocketOperation, CarveOperation, DrillOperation, ZLevelRoughingOperation, SurfaceFinishingOperation, OperationKind, CarveSelectionMode, DrillSelectionMode, OperationsProject } from './lib/types';
  import { defaultStock, defaultPartPlacement, defaultPartOrientation, defaultWcs, defaultFacingOperation, defaultContourOperation, defaultPocketOperation, defaultCarveOperation, defaultDrillOperation, defaultZLevelRoughingOperation, defaultSurfaceFinishingOperation, defaultOperationsProject } from './lib/types';
  import { activeOperation, addOperation, cloneOperation, operationSummary, removeOperation, replaceOperation, selectOperation } from './lib/operationsProject';
  import { buildActiveCanonicalToolpath } from './lib/activeCanonicalToolpath';
  import { buildZLevelOperationState, zLevelMode } from './lib/zLevelOperationState';
  import { resolveContourDepth } from './lib/contourDepth';

  const steps = ['Bauteil', 'Rohling', 'Werkzeuge', 'Bearbeiten', 'Prüfen', 'Fräsen'];
  let activeStep = 'Bauteil';
  let importSummary: ImportSummary | null = null;
  let stock: StockDefinition = { ...defaultStock };
  let stockMode: StockMode = 'manual';
  let placement: PartPlacement = { ...defaultPartPlacement };
  let orientation: PartOrientation = { ...defaultPartOrientation };
  let wcs: WorkCoordinateSystem = { ...defaultWcs };
  let operationsProject:OperationsProject={operations:defaultOperationsProject.operations.map(cloneOperation),activeOperationId:defaultOperationsProject.activeOperationId};
  let operation: CamOperation = cloneOperation(activeOperation(operationsProject)??defaultContourOperation);
  let toolTargetOperationId:string|null=operationsProject.activeOperationId;
  let drillNativeViewMode:'top'|'25d'='top';
  let error = '';
  let faceTargetState:{toolpath:CanonicalToolpath;targetZ:number;roughBottomZ:number}|null=null;
  function receiveFaceTargetState(state:{toolpath:CanonicalToolpath;targetZ:number;roughBottomZ:number}|null){faceTargetState=state;}
  $: activeCanonicalToolpath = importSummary
    ? buildActiveCanonicalToolpath({summary:importSummary,stock,stockMode,placement,orientation,wcs,operation})
    : null;
  $: activeFaceTargetOperationState=importSummary&&operation.kind==='z-level-roughing'?buildZLevelOperationState({summary:importSummary,stock,placement,orientation,wcs,operation}):null;
  $: preflightFaceTargetStates=importSummary?operationsProject.operations.filter((op):op is ZLevelRoughingOperation=>op.enabled!==false&&op.kind==='z-level-roughing').map(op=>({operationId:op.id,state:buildZLevelOperationState({summary:importSummary!,stock,placement,orientation,wcs,operation:op})})).filter(entry=>entry.state.toolpath!==null&&entry.state.errors.length===0):[];
  $: preflightStepToolpaths=importSummary?.kind==='step'
    ?operationsProject.operations
      .filter(op=>op.enabled!==false&&op.kind==='surface-finishing')
      .map(op=>buildActiveCanonicalToolpath({summary:importSummary!,stock,stockMode,placement,orientation,wcs,operation:op}))
      .filter((toolpath):toolpath is CanonicalToolpath=>toolpath!==null)
    :[];
  $: preflightDxfToolpaths=importSummary?.kind==='dxf'
    ?operationsProject.operations
      .filter(op=>op.enabled!==false&&op.kind!=='z-level-roughing')
      .map(op=>buildActiveCanonicalToolpath({summary:importSummary!,stock,stockMode,placement,orientation,wcs,operation:op}))
      .filter((toolpath):toolpath is CanonicalToolpath=>toolpath!==null)
    :[];
  $: contourDepthState=operation.kind==='contour'?resolveContourDepth({operation,stock,stockMode,wcs}):null;

  const operationLabel=(kind:OperationKind)=>kind==='facing'?'Planen':kind==='contour'?'Kontur':kind==='pocket'?'Tasche':kind==='carve'?'Carve':kind==='drill'?'Bohren':kind==='surface-finishing'?'3D Schlichten':'Z-Level Schruppen';
  function setOperation(next:CamOperation){operation=cloneOperation(next);operationsProject=replaceOperation(operationsProject,operation);}
  function updateFacing(patch:Partial<FacingOperation>){if(operation.kind!=='facing')return;setOperation({...operation,...patch});}
  function updateContour(patch:Partial<ContourOperation>){if(operation.kind!=='contour')return;setOperation({...operation,...patch});}
  function updateContourOvercut(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=0)updateContour({overcutMm:value});}
  function updateContourTabCount(event:Event){if(operation.kind!=='contour')return;const value=Math.floor(Number((event.currentTarget as HTMLInputElement).value));if(Number.isFinite(value)&&value>=1)updateContour({tabCount:value});}
  function updateContourTabWidth(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({tabWidthMm:value});}
  function updateContourTabHeight(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({tabHeightMm:value});}
  function updateContourLeadInLength(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({leadInLengthMm:value});}
  function updateContourLeadOutLength(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({leadOutLengthMm:value});}
  function updateContourRadialAllowance(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=0)updateContour({radialAllowanceMm:value});}
  function updateContourAxialAllowance(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=0)updateContour({axialAllowanceMm:value});}
  function updateContourFinishPassCount(event:Event){if(operation.kind!=='contour')return;const value=Math.floor(Number((event.currentTarget as HTMLInputElement).value));if(Number.isFinite(value)&&value>=1)updateContour({finishPassCount:value});}
  function updatePocket(patch:Partial<PocketOperation>){if(operation.kind!=='pocket')return;setOperation({...operation,...patch});}
  function restSourcePocketOperations(){if(operation.kind!=='pocket')return[];const pocket=operation;const currentIndex=operationsProject.operations.findIndex(op=>op.id===pocket.id);return operationsProject.operations.slice(0,currentIndex).filter((op):op is PocketOperation=>op.kind==='pocket'&&op.enabled!==false&&op.tool.diameterMm>pocket.tool.diameterMm&&(importSummary?.kind==='step'?op.stepFaceId===pocket.stepFaceId:op.contourId===pocket.contourId));}
  function setPocketRestMachining(enabled:boolean){if(operation.kind!=='pocket')return;const pocket=operation;if(!enabled){updatePocket({restMachiningEnabled:false,restFromOperationId:null});return;}const candidates=restSourcePocketOperations();const currentValid=candidates.some(op=>op.id===pocket.restFromOperationId);updatePocket({restMachiningEnabled:true,restFromOperationId:currentValid?pocket.restFromOperationId:candidates.at(-1)?.id??null});}
  function choosePocketRestSource(event:Event){if(operation.kind!=='pocket')return;const id=(event.currentTarget as HTMLSelectElement).value||null;updatePocket({restFromOperationId:id});}
  function setPocketStockAwareRoughing(enabled:boolean){if(operation.kind!=='pocket')return;updatePocket({stockAwareRoughingEnabled:enabled,...(enabled?{restMachiningEnabled:false,restFromOperationId:null}:{})});}
  function updatePocketMaxRadialEngagement(event:Event){if(operation.kind!=='pocket')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0&&value<=100)updatePocket({maxRadialEngagementPercent:value});}
  function updateCarve(patch:Partial<CarveOperation>){if(operation.kind!=='carve')return;setOperation({...operation,...patch});}
  function updateDrill(patch:Partial<DrillOperation>){if(operation.kind!=='drill')return;setOperation({...operation,...patch});}
  function updateZLevelRoughing(patch:Partial<ZLevelRoughingOperation>){if(operation.kind!=='z-level-roughing')return;setOperation({...operation,...patch});}
  function setZLevelRoughingMode(mode:'face-target'|'model'){if(operation.kind!=='z-level-roughing')return;updateZLevelRoughing({roughingMode:mode});}
  function updateSurfaceFinishing(patch:Partial<SurfaceFinishingOperation>){if(operation.kind!=='surface-finishing')return;setOperation({...operation,...patch});}
  function updateSurfaceFinishingFaceIds(faceIds:number[]){if(operation.kind!=='surface-finishing')return;updateSurfaceFinishing({faceIds:[...faceIds]});}
  function updateSurfaceFinishingStepover(event:Event){if(operation.kind!=='surface-finishing')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=1&&value<=100)updateSurfaceFinishing({stepoverPercent:value});}
  function updateZLevelFaceIds(faceIds:number[]){if(operation.kind!=='z-level-roughing')return;updateZLevelRoughing({faceIds:[...faceIds]});}
  function activateOperation(id:string){operationsProject=selectOperation(operationsProject,id);const next=activeOperation(operationsProject);if(next)operation=cloneOperation(next);}
  function appendOperation(kind:OperationKind){operationsProject=addOperation(operationsProject,kind);const next=activeOperation(operationsProject);if(next)operation=cloneOperation(next);}
  function deleteOperation(id:string){if(operationsProject.operations.length<=1)return;operationsProject=removeOperation(operationsProject,id);const next=activeOperation(operationsProject);if(next)operation=cloneOperation(next);}
  function resetOperations(){operationsProject={operations:[cloneOperation(defaultContourOperation)],activeOperationId:defaultContourOperation.id};operation=cloneOperation(defaultContourOperation);}
  function applyToolOperationTransfer(transfer:{operationId:string;toolId:string;toolName:string;toolKind:MillingToolKind;diameterMm:number;feedMmMin:number;spindleRpm:number}){
    if(!(transfer.diameterMm>0&&transfer.feedMmMin>0&&transfer.spindleRpm>0))return;
    const target=operationsProject.operations.find(op=>op.id===transfer.operationId);
    if(!target)return;
    if(target.kind==='surface-finishing'&&transfer.toolKind!=='ball-nose'){
      error='3D Schlichten erlaubt ausschließlich Vollradiusfräser.';
      return;
    }
    const updated={...target,tool:{id:transfer.toolId,name:transfer.toolName,diameterMm:transfer.diameterMm,kind:transfer.toolKind},feedMmMin:transfer.feedMmMin,spindleRpm:transfer.spindleRpm} as CamOperation;
    operationsProject=replaceOperation(operationsProject,updated);
    if(operation.id===updated.id)operation=cloneOperation(updated);
  }
  function setToolTargetOperation(id:string){if(operationsProject.operations.some(op=>op.id===id))toolTargetOperationId=id;}
  function goToStep(step:string){if(step==='Werkzeuge')toolTargetOperationId=operationsProject.activeOperationId;activeStep=step;}
  $: if(!toolTargetOperationId||!operationsProject.operations.some(op=>op.id===toolTargetOperationId))toolTargetOperationId=operationsProject.activeOperationId;
  $: toolTargetOperation=toolTargetOperationId?operationsProject.operations.find(op=>op.id===toolTargetOperationId)??null:null;

  function updateStock(field: 'width' | 'height' | 'thickness', event: Event) { if (stockMode !== 'manual' && !(importSummary?.kind === 'dxf' && stockMode === 'part-bounds' && field === 'thickness')) return; const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)stock={...stock,[field]:value}; }
  function updatePlacementOffset(field:'offsetX'|'offsetY'|'offsetZ',event:Event){const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))placement={...placement,[field]:value};}
  function updateNumber(field:'totalDepthMm'|'stepDownMm'|'feedMmMin'|'plungeMmMin'|'spindleRpm'|'safeZMm',event:Event){const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))setOperation({...operation,[field]:value} as CamOperation);}
  function updateToolDiameter(event:Event){const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)setOperation({...operation,tool:{...operation.tool,diameterMm:value}} as CamOperation);}
  function updateFacingStepover(event:Event){if(operation.kind!=='facing')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))setOperation({...operation,stepoverPercent:value});}
  function updatePocketStepover(event:Event){if(operation.kind!=='pocket')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))setOperation({...operation,stepoverPercent:value});}
  function updateZLevelStepover(event:Event){if(operation.kind!=='z-level-roughing')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=1&&value<=100)updateZLevelRoughing({stepoverPercent:value});}
  function updateFinishAllowance(event:Event){if(operation.kind!=='z-level-roughing')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>=0)updateZLevelRoughing({finishAllowanceMm:value});}
  function updateRampAngle(event:Event){if(operation.kind!=='pocket')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))setOperation({...operation,rampAngleDeg:value});}
  function selectContour(id:number){if(operation.kind==='facing'||operation.kind==='carve'||operation.kind==='drill'||operation.kind==='z-level-roughing'||operation.kind==='surface-finishing')return;setOperation({...operation,contourId:id});}
  function eligibleCarveCurve(curve:Curve2){return curve.kind==='line'||curve.kind==='arc'||(curve.kind==='polyline'&&!curve.closed);}
  function carveLayerNames(){if(importSummary?.kind!=='dxf')return[];const curves=importSummary.planarGeometry?.curves??[],layers=importSummary.planarGeometry?.curveLayers??[];return [...new Set(curves.map((curve,i)=>eligibleCarveCurve(curve)?layers[i]:null).filter((v):v is string=>!!v))].sort((a,b)=>a.localeCompare(b));}
  function carveLayerEligibleCount(name:string|null){if(!name||importSummary?.kind!=='dxf')return 0;const curves=importSummary.planarGeometry?.curves??[],layers=importSummary.planarGeometry?.curveLayers??[];return curves.reduce((n,curve,i)=>n+(layers[i]===name&&eligibleCarveCurve(curve)?1:0),0);}
  function setCarveSelectionMode(mode:CarveSelectionMode){if(operation.kind!=='carve')return;updateCarve({selectionMode:mode});}
  function toggleCarveCurve(id:number){if(operation.kind!=='carve')return;const ids=operation.curveIds??[];updateCarve({curveIds:ids.includes(id)?ids.filter(v=>v!==id):[...ids,id]});}
  function setDrillSelectionMode(mode:DrillSelectionMode){if(operation.kind!=='drill')return;updateDrill({selectionMode:mode});}
  function toggleDrillCurve(id:number){if(operation.kind!=='drill')return;const ids=operation.curveIds??[];updateDrill({curveIds:ids.includes(id)?ids.filter(v=>v!==id):[...ids,id]});}
  function setOperationKind(kind:OperationKind){const common={id:operation.id,name:operation.name,enabled:operation.enabled,tool:{...operation.tool},feedMmMin:operation.feedMmMin,plungeMmMin:operation.plungeMmMin,spindleRpm:operation.spindleRpm,safeZMm:operation.safeZMm};const contourId='contourId' in operation?operation.contourId:null;
    if(kind==='facing')setOperation({...defaultFacingOperation,...common,tool:{...defaultFacingOperation.tool}});
    else if(kind==='contour')setOperation({...defaultContourOperation,...common,contourId});
    else if(kind==='pocket')setOperation({...defaultPocketOperation,...common,contourId});
    else if(kind==='drill')setOperation({...defaultDrillOperation,...common,tool:{...defaultDrillOperation.tool},curveIds:[]});
    else if(kind==='z-level-roughing')setOperation({...defaultZLevelRoughingOperation,...common,faceIds:[],tool:{...operation.tool},totalDepthMm:0});
    else if(kind==='surface-finishing')setOperation({...defaultSurfaceFinishingOperation,...common,faceIds:[],tool:{...defaultSurfaceFinishingOperation.tool},totalDepthMm:0});
    else setOperation({...defaultCarveOperation,...common,tool:{...defaultCarveOperation.tool},curveIds:[]});
  }

  function curvePoints(curve:Curve2){if(curve.kind==='line')return[curve.start,curve.end];if(curve.kind==='polyline')return curve.points;if(curve.kind==='circle')return Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return{x:curve.center.x+Math.cos(a)*curve.radius,y:curve.center.y+Math.sin(a)*curve.radius}});if(curve.kind==='arc'){let a=curve.startAngleDeg,b=curve.endAngleDeg;while(b<a)b+=360;return Array.from({length:65},(_,i)=>{const r=(a+(b-a)*i/64)*Math.PI/180;return{x:curve.center.x+Math.cos(r)*curve.radius,y:curve.center.y+Math.sin(r)*curve.radius}})}return[];}
  function orientedPartSize(angleDeg=orientation.rotationZDeg){if(!importSummary)return null;const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let points:{x:number;y:number;z:number}[]=[];if(importSummary.kind==='step'){const v=importSummary.brep?.displayVertices??[];for(let i=0;i+2<v.length;i+=3)points.push({x:v[i],y:v[i+1],z:v[i+2]})}else points=(importSummary.planarGeometry?.curves??[]).flatMap(curvePoints).map(p=>({...p,z:0}));if(!points.length)return null;const rotated=points.map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z})),xs=rotated.map(p=>p.x),ys=rotated.map(p=>p.y),zs=rotated.map(p=>p.z);return{width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),thickness:importSummary.kind==='step'?Math.max(...zs)-Math.min(...zs):stock.thickness}}
  function applyPartBounds(angleDeg=orientation.rotationZDeg){const size=orientedPartSize(angleDeg);if(!size)return;stock={...stock,width:size.width,height:size.height,thickness:size.thickness};placement={...defaultPartPlacement};}
  function setStockMode(mode:StockMode){if(mode==='none'&&importSummary?.kind!=='dxf')return;stockMode=mode;if(mode==='part-bounds')applyPartBounds();if(mode==='none')placement={...defaultPartPlacement};}
  function setRotationZ(value:number){orientation={...orientation,rotationZDeg:value};if(stockMode==='part-bounds')applyPartBounds(value);}
  function updateRotationZ(event:Event){const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))setRotationZ(value);}
  async function importPart(){error='';const path=await open({multiple:false,directory:false,filters:[{name:'CAD',extensions:['step','stp','dxf']}]});if(!path||Array.isArray(path))return;try{importSummary=await invoke<ImportSummary>('inspect_import',{path});stockMode='manual';placement={...defaultPartPlacement};orientation={...defaultPartOrientation};wcs={...defaultWcs};resetOperations()}catch(e){error=String(e)}}
</script>

<div class="app-shell">
<header class="topbar"><div><strong>BeBlog CAM</strong><span class="build">001W</span></div><div class="project-name">{importSummary?.fileName??'Neues Projekt'}</div></header>
<aside class="rail" aria-label="Arbeitsablauf">{#each steps as step,i}<button class:active={activeStep===step} onclick={()=>goToStep(step)}><span>{String(i+1).padStart(2,'0')}</span>{step}</button>{/each}</aside>
<main class="workspace"><section class="viewport">
{#if importSummary}{#key `${importSummary.kind}:${stockMode}:${stock.width}:${stock.height}:${stock.thickness}:${placement.horizontal}:${placement.vertical}:${placement.offsetX}:${placement.offsetY}:${placement.offsetZ}:${orientation.rotationZDeg}:${wcs.x}:${wcs.y}:${wcs.z}`}<GeometryView summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} canonicalToolpath={activeStep==='Bearbeiten'?activeCanonicalToolpath:null} preflightCanonicalToolpaths={activeStep==='Prüfen'?preflightDxfToolpaths:[]} preflightStepToolpaths={activeStep==='Prüfen'?preflightStepToolpaths:[]} preflightFaceTargetToolpaths={activeStep==='Prüfen'?preflightFaceTargetStates.flatMap(entry=>entry.state.toolpath?[entry.state.toolpath]:[]):[]} selectedDrillCurveIds={operation.kind==='drill'?operation.curveIds:[]} onDrillViewModeChange={(mode)=>drillNativeViewMode=mode} roughingOperation={activeStep==='Bearbeiten'&&operation.kind==='z-level-roughing'?operation:null} surfaceFinishingOperation={activeStep==='Bearbeiten'&&operation.kind==='surface-finishing'?operation:null} stepSelectionOperation={activeStep==='Bearbeiten'&&importSummary.kind==='step'&&(operation.kind==='contour'||operation.kind==='pocket'||operation.kind==='drill')?operation:null} onStepWireIdChange={(wireId)=>operation.kind==='contour'&&updateContour({stepWireId:wireId})} onStepFaceIdChange={(faceId)=>operation.kind==='pocket'&&updatePocket({stepFaceId:faceId})} onStepHoleFeatureIdsChange={(featureIds)=>operation.kind==='drill'&&updateDrill({stepHoleFeatureIds:featureIds})} selectedFaceIds={activeStep==='Bearbeiten'&&((operation.kind==='z-level-roughing'&&zLevelMode(operation)==='face-target')||operation.kind==='surface-finishing')?operation.faceIds:[]} onSelectedFaceIdsChange={operation.kind==='surface-finishing'?updateSurfaceFinishingFaceIds:updateZLevelFaceIds} onFaceTargetChange={receiveFaceTargetState}/>{/key}{#if activeStep==='Bearbeiten'&&importSummary.kind==='dxf'&&operation.kind!=='facing'&&operation.kind!=='surface-finishing'&&!(operation.kind==='drill'&&drillNativeViewMode==='25d')}<ContourOverlay summary={importSummary} {stock} {stockMode} {placement} {orientation} {operation} onSelectContour={selectContour} onSelectCarveCurve={toggleCarveCurve} onSelectDrillCurve={toggleDrillCurve}/>{/if}<div class="view-label">Aufspannebene → {stockMode==='none'?'Bauteil':'Rohling → Bauteil'} → WCS</div>{:else}<div class="empty-state"><div class="mark">B</div><h1>Ein Bauteil öffnen</h1><p>STEP für exakte 3D-BRep-Geometrie oder DXF für planare Konturen.</p><button class="primary" onclick={importPart}>Bauteil öffnen</button></div>{/if}
</section><aside class="inspector">
{#if activeStep==='Bauteil'}<p class="eyebrow">01 · Bauteil</p><h2>Geometrie</h2>{#if importSummary}<dl><div><dt>Datei</dt><dd>{importSummary.fileName}</dd></div><div><dt>Format</dt><dd>{importSummary.kind.toUpperCase()}</dd></div><div><dt>Backend</dt><dd>{importSummary.backend}</dd></div><div><dt>Status</dt><dd>{importSummary.status==='ready'?'Bereit':'Native STEP-Anbindung fehlt in diesem Build'}</dd></div></dl><div class="placement-section"><p class="placement-title">Modellorientierung</p><div class="placement-grid"><button class:active={orientation.rotationZDeg===0} onclick={()=>setRotationZ(0)}>0°</button><button class:active={orientation.rotationZDeg===90} onclick={()=>setRotationZ(90)}>90°</button><button class:active={orientation.rotationZDeg===180} onclick={()=>setRotationZ(180)}>180°</button></div><div class="placement-grid two"><button class:active={orientation.rotationZDeg===270} onclick={()=>setRotationZ(270)}>270°</button><button onclick={()=>setRotationZ(0)}>Zurücksetzen</button></div><label>Rotation Z <input type="number" step="1" value={orientation.rotationZDeg} oninput={updateRotationZ}/> °</label><p class="note">Das dreht das Bauteil wirklich relativ zur Aufspannung. Die freie Mausrotation verändert nur die Kamera.</p></div>{#if Object.keys(importSummary.entities).length}<div class="entity-list">{#each Object.entries(importSummary.entities) as [name,count]}<span>{name} <b>{count}</b></span>{/each}</div>{/if}{#if importSummary.note}<p class="note">{importSummary.note}</p>{/if}<button class="secondary" onclick={importPart}>Anderes Bauteil öffnen</button>{:else}<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><button class="primary" onclick={importPart}>Bauteil öffnen</button>{/if}
{:else if activeStep==='Rohling'}<p class="eyebrow">02 · Rohling</p><h2>Rohling</h2><div class="placement-section"><p class="placement-title">Rohling entsteht aus</p><div class="placement-grid"><button class:active={stockMode==='manual'} onclick={()=>setStockMode('manual')}>Maßen</button><button class:active={stockMode==='part-bounds'} onclick={()=>setStockMode('part-bounds')}>Bauteil</button>{#if importSummary?.kind==='dxf'}<button class:active={stockMode==='none'} onclick={()=>setStockMode('none')}>Kein Rohling</button>{/if}</div></div>{#if stockMode!=='none'}<label>Breite <input type="number" min="0.1" step="0.1" value={stock.width} disabled={stockMode==='part-bounds'} oninput={e=>updateStock('width',e)}/> mm</label><label>Länge <input type="number" min="0.1" step="0.1" value={stock.height} disabled={stockMode==='part-bounds'} oninput={e=>updateStock('height',e)}/> mm</label><label>Dicke <input type="number" min="0.1" step="0.1" value={stock.thickness} disabled={stockMode==='part-bounds'&&importSummary?.kind==='step'} oninput={e=>updateStock('thickness',e)}/> mm</label><div class="placement-section"><p class="placement-title">Bauteil im Rohling</p><div class="placement-grid"><button class:active={placement.horizontal==='left'} onclick={()=>placement={...placement,horizontal:'left'}}>Links</button><button class:active={placement.horizontal==='center'} onclick={()=>placement={...placement,horizontal:'center'}}>Zentriert</button><button class:active={placement.horizontal==='right'} onclick={()=>placement={...placement,horizontal:'right'}}>Rechts</button></div><div class="placement-grid"><button class:active={placement.vertical==='front'} onclick={()=>placement={...placement,vertical:'front'}}>Vorne</button><button class:active={placement.vertical==='center'} onclick={()=>placement={...placement,vertical:'center'}}>Mitte</button><button class:active={placement.vertical==='back'} onclick={()=>placement={...placement,vertical:'back'}}>Hinten</button></div><details><summary>Feinkorrektur</summary><label>X <input type="number" step="0.1" value={placement.offsetX} oninput={e=>updatePlacementOffset('offsetX',e)}/> mm</label><label>Y <input type="number" step="0.1" value={placement.offsetY} oninput={e=>updatePlacementOffset('offsetY',e)}/> mm</label><label>Z <input type="number" step="0.1" value={placement.offsetZ} oninput={e=>updatePlacementOffset('offsetZ',e)}/> mm</label></details></div>{:else}<p class="note"><strong>Kein Rohling.</strong> Die DXF wird direkt als planare Bauteilgeometrie verwendet.</p>{/if}<div class="placement-section"><p class="placement-title">Werkstücknullpunkt / WCS</p><div class="placement-grid"><button class:active={wcs.x==='left'} onclick={()=>wcs={...wcs,x:'left'}}>Links</button><button class:active={wcs.x==='center'} onclick={()=>wcs={...wcs,x:'center'}}>Mitte</button><button class:active={wcs.x==='right'} onclick={()=>wcs={...wcs,x:'right'}}>Rechts</button></div><div class="placement-grid"><button class:active={wcs.y==='front'} onclick={()=>wcs={...wcs,y:'front'}}>Vorne</button><button class:active={wcs.y==='center'} onclick={()=>wcs={...wcs,y:'center'}}>Mitte</button><button class:active={wcs.y==='back'} onclick={()=>wcs={...wcs,y:'back'}}>Hinten</button></div><div class="placement-grid two"><button class:active={wcs.z==='top'} onclick={()=>wcs={...wcs,z:'top'}}>Oberseite</button><button class:active={wcs.z==='bottom'} onclick={()=>wcs={...wcs,z:'bottom'}}>Unterseite</button></div></div>
{:else if activeStep==='Werkzeuge'}<FeedsSpeedsCalculator
  activeOperationName={operation.name}
  operationChoices={operationsProject.operations.map((op,index)=>({id:op.id,label:`${String(index+1).padStart(2,'0')} · ${operationLabel(op.kind)}`,name:op.name,summary:operationSummary(op)}))}
  targetOperationId={toolTargetOperationId}
  targetOperation={toolTargetOperation}
  onTargetOperationChange={setToolTargetOperation}
  onApplyToOperation={applyToolOperationTransfer}
/>
{:else if activeStep==='Bearbeiten'}<p class="eyebrow">04 · Bearbeiten</p><h2>{operationLabel(operation.kind)}</h2>{#if importSummary}
<!-- existing Bearbeiten body unchanged -->
{:else}<p>Noch kein Bauteil geladen.</p>{/if}
{:else if activeStep==='Prüfen'}{#if importSummary}<p class="eyebrow">05 · Prüfen</p><h2>Job prüfen</h2><JobPreflightPanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} operations={operationsProject.operations}/>{#if stockMode==='none'}<p class="note">Stock-Simulation ist ohne definierten Rohling nicht verfügbar.</p>{:else if wcs.z!=='top'}<p class="note">Stock-Simulation 004P ist aktuell nur mit Z-Null auf Rohlingoberseite verfügbar.</p>{:else}<div class="placement-section"><p class="placement-title">Reststock-Simulation</p><p class="note">Die 2.5D-Heightfield-Simulation wird im Job-Preflight aus allen akzeptierten kanonischen Werkzeugwegen in Bearbeitungsreihenfolge aufgebaut.</p><dl><div><dt>Status</dt><dd>Im Preflight aktiv</dd></div><div><dt>Basis</dt><dd>Rohling {stock.width.toFixed(1)} × {stock.height.toFixed(1)} × {stock.thickness.toFixed(1)} mm</dd></div><div><dt>Operationen</dt><dd>{operationsProject.operations.filter(op=>op.enabled!==false).length} aktiv</dd></div><div><dt>Modell</dt><dd>2.5D Heightfield · Werkzeugradius-Sweep</dd></div></dl></div>{/if}{:else}<p class="eyebrow">05 · Prüfen</p><h2>Preflight</h2><p>Noch kein Bauteil geladen.</p>{/if}
{:else if activeStep==='Fräsen'}{#if importSummary}<JobGCodePanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} operations={operationsProject.operations}/>{:else}<p class="eyebrow">06 · Fräsen</p><h2>G-Code</h2><p>Noch kein Bauteil geladen.</p>{/if}
{:else}<p class="eyebrow">{String(steps.indexOf(activeStep)+1).padStart(2,'0')} · {activeStep}</p><h2>{activeStep}</h2><p>Dieser Schritt wird in den nächsten Builds freigeschaltet.</p>{/if}
</aside></main></div>

<style>
/* existing styles */
</style>
