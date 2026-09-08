import type { CanonicalToolpath, CanonicalToolpathSegment } from './canonicalToolpath';
import { offsetPolygon, validateOffsetSegments, type P2 } from './contourMath';
import { offsetOpenPolyline, openContourCorrection } from './openContourMath';
import { buildStepContourTargets, stepContourTargetAfterExclusions, type StepContourTarget } from './stepContourTargets';
import { buildStepSideFaceContour, stepSideFaceContourAfterExclusions } from './stepSideFaceContour';
import { resolveContourDepth } from './contourDepth';
import { applyContourFinishing } from './contourFinishing';
import { applyContourTabs } from './contourTabs';
import { applyContourLeads } from './contourLeads';
import type { ContourOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type StepContourCandidate=StepContourTarget;
export type StepContourOperationState={ok:boolean;toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];candidates:StepContourCandidate[];selected:StepContourCandidate|null;eligibleSideFaceIds:number[];selectedEdgeIds:number[]};
type P3={x:number;y:number;z:number};
type EffectiveTarget={targetKey:string;points:P2[];edgeIds:number[];topology:'closed'|'open'};
const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a:P2,b:P2)=>dist(a,b)<=1e-4;
const rotateZ=(p:P3,deg:number):P3=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};
const bounds3=(points:P3[])=>({minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});

function placementTransform(summary:ImportSummary,stock:StockDefinition,stockMode:StockMode,placement:PartPlacement,orientation:PartOrientation){
  const values=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(rotateZ({x:values[i],y:values[i+1],z:values[i+2]},orientation.rotationZDeg));
  if(!raw.length)return null;
  const b=bounds3(raw),w=b.maxX-b.minX,h=b.maxY-b.minY;
  const tx=stockMode==='none'?0:placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-w:(stock.width-w)/2;
  const ty=stockMode==='none'?0:placement.vertical==='front'?0:placement.vertical==='back'?stock.height-h:(stock.height-h)/2;
  return{dx:tx-b.minX+placement.offsetX,dy:ty-b.minY+placement.offsetY,partBounds:{minX:tx+placement.offsetX,maxX:tx+w+placement.offsetX,minY:ty+placement.offsetY,maxY:ty+h+placement.offsetY}};
}

function wcsOrigin(stock:StockDefinition,stockMode:StockMode,wcs:WorkCoordinateSystem,b:{minX:number;maxX:number;minY:number;maxY:number}){
  const r=stockMode==='none'?b:{minX:0,maxX:stock.width,minY:0,maxY:stock.height};
  return{x:wcs.x==='left'?r.minX:wcs.x==='right'?r.maxX:(r.minX+r.maxX)/2,y:wcs.y==='front'?r.minY:wcs.y==='back'?r.maxY:(r.minY+r.maxY)/2};
}

const fail=(errors:string[],warnings:string[],candidates:StepContourCandidate[],selected:StepContourCandidate|null,eligibleSideFaceIds:number[],selectedEdgeIds:number[]=[]):StepContourOperationState=>({ok:false,toolpath:null,errors,warnings,candidates,selected,eligibleSideFaceIds,selectedEdgeIds});

export function buildStepContourOperationState(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation;}):StepContourOperationState{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args,errors:string[]=[],warnings:string[]=[];
  const depth=resolveContourDepth({operation,stock,stockMode,wcs});errors.push(...depth.errors);warnings.push(...depth.warnings);
  if(summary.kind!=='step')errors.push('STEP-Kontur benötigt einen STEP/BRep-Import.');
  if(wcs.z!=='top')errors.push('STEP-Kontur ist aktuell nur mit Z-Null oben freigegeben.');
  if(Math.abs(orientation.rotationXDeg)>EPS||Math.abs(orientation.rotationYDeg)>EPS)errors.push('STEP-Kontur unterstützt aktuell keine X/Y-Kippung.');
  if(operation.stepDownMm<=0)errors.push('Zustellung muss größer als 0 sein.');
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');

  const targetResult=buildStepContourTargets(summary),all=targetResult.targets;errors.push(...targetResult.errors);
  const chosen=operation.stepWireId==null?null:all.find(candidate=>candidate.wireId===operation.stepWireId)??null;
  const sideResult=buildStepSideFaceContour(summary,operation.stepContourFaceIds??[]);
  const eligibleSideFaceIds=sideResult.eligibleFaceIds;
  const excluded=operation.excludedSegmentIds??[];
  let effective:EffectiveTarget|null=null;

  if(operation.topology==='closed'){
    if(!all.length)errors.push('Keine horizontale geschlossene STEP-Kontur als Fertigungsziel erkannt.');
    if(operation.stepWireId==null)errors.push('Keine geschlossene STEP-Kontur explizit gewählt. Wähle eine Kontur im Viewport.');
    if(operation.stepWireId!=null&&!chosen)errors.push('Gewähltes STEP-Konturziel ist nicht mehr verfügbar.');
    if(chosen&&chosen.topology!=='closed')errors.push('Geschlossene STEP-Bearbeitung benötigt ein geschlossenes Konturziel.');
    if(excluded.length)errors.push('Bei geschlossener STEP-Kontur dürfen keine Kanten ausgeschlossen sein.');
    if(chosen)effective=chosen;
  }else if((operation.stepContourFaceIds?.length??0)>0){
    errors.push(...sideResult.errors);
    if(sideResult.target){
      const refined=stepSideFaceContourAfterExclusions(sideResult.target,excluded);
      if(!refined)errors.push('Die ausgeschlossenen STEP-Kanten trennen die Seitenflächen-Kontur in mehrere Teilstücke.');
      else effective=refined;
    }
  }else{
    if(operation.stepWireId==null)errors.push('Offene STEP-Kontur: Wähle bevorzugt eine oder mehrere Seitenflächen im Viewport.');
    if(operation.stepWireId!=null&&!chosen)errors.push('Gewähltes STEP-Konturziel ist nicht mehr verfügbar.');
    if(chosen){
      if(chosen.topology==='closed'&&!excluded.length)errors.push('Offene STEP-Bearbeitung aus einer geschlossenen Wire benötigt mindestens eine ausgeschlossene Kante.');
      const opened=stepContourTargetAfterExclusions(chosen,excluded);
      if(!opened||opened.topology!=='open')errors.push('Die gewählten STEP-Kanten ergeben keine einzelne zusammenhängende offene Kontur.');else effective=opened;
    }
  }
  if(errors.length||!effective)return fail(errors,warnings,all,chosen,eligibleSideFaceIds,effective?.edgeIds??[]);

  const t=placementTransform(summary,stock,stockMode,placement,orientation);
  if(!t)return fail(['STEP-Bauteil konnte nicht transformiert werden.'],warnings,all,chosen,eligibleSideFaceIds,effective.edgeIds);
  const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  const source=effective.points.map(p=>{const q=rotateZ({x:p.x,y:p.y,z:0},orientation.rotationZDeg);return{x:q.x+t.dx-origin.x,y:q.y+t.dy-origin.y};});
  const radius=operation.tool.diameterMm/2;
  let path:P2[];
  if(operation.topology==='closed'){
    const correction=operation.side==='outside'?radius:operation.side==='inside'?-radius:0;
    path=offsetPolygon(source,correction);
    const validation=validateOffsetSegments(source,path,correction,.01);
    if(!validation.ok)return fail([`STEP-Kontur-Radiuskorrektur ist geometrisch nicht freigegeben (max. Abweichung ${validation.maxDeviationMm.toFixed(4)} mm).`],warnings,all,chosen,eligibleSideFaceIds,effective.edgeIds);
  }else{
    const correction=openContourCorrection(operation.openSide,operation.tool.diameterMm);
    path=offsetOpenPolyline(source,correction);
    if(path.length<2)return fail(['Offene STEP-Kontur konnte nicht radiuskorrigiert werden.'],warnings,all,chosen,eligibleSideFaceIds,effective.edgeIds);
  }
  if(operation.direction==='conventional')path=[...path].reverse();

  const passes=Math.max(1,Math.ceil(depth.depthMm/operation.stepDownMm)),runs:CanonicalToolpath['runs']=[];
  for(let pass=1;pass<=passes;pass++){
    const z=-Math.min(depth.depthMm,pass*operation.stepDownMm),points=path.map(p=>({x:p.x,y:p.y}));
    if(operation.topology==='closed'&&points.length&&!same(points[0],points[points.length-1]))points.push({...points[0]});
    const segments:CanonicalToolpathSegment[]=[];for(let i=1;i<points.length;i++)segments.push({kind:'line',start:points[i-1],end:points[i]});
    runs.push({kind:'cut',z,points,segments});
  }
  const baseToolpath:CanonicalToolpath={version:1,operationKind:'contour',strategy:'contour',tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:0,runs,sourceOperationId:operation.id,targetKey:effective.targetKey};
  const finished=applyContourFinishing(baseToolpath,operation,depth.depthMm);errors.push(...finished.errors);warnings.push(...finished.warnings);if(errors.length)return fail(errors,warnings,all,chosen,eligibleSideFaceIds,effective.edgeIds);
  const tabbed=applyContourTabs(finished.toolpath,operation,depth.depthMm);errors.push(...tabbed.errors);warnings.push(...tabbed.warnings);if(errors.length)return fail(errors,warnings,all,chosen,eligibleSideFaceIds,effective.edgeIds);
  const led=applyContourLeads(tabbed.toolpath,operation);errors.push(...led.errors);warnings.push(...led.warnings);if(errors.length)return fail(errors,warnings,all,chosen,eligibleSideFaceIds,effective.edgeIds);
  if(operation.topology==='open')warnings.push(`Offene STEP-Kontur aktiv · ${effective.edgeIds.length} BRep-Kanten · ${operation.openSide==='left'?'links':operation.openSide==='right'?'rechts':'auf Linie'}.`);
  return{ok:true,toolpath:led.toolpath,errors:[],warnings,candidates:all,selected:chosen,eligibleSideFaceIds,selectedEdgeIds:effective.edgeIds};
}
