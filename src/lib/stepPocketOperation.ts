import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import { offsetPolygon, polygonArea, type P2 } from './contourMath';
import { buildStepManufacturingFeatureSource, type StepManufacturingEdgeSource, type StepManufacturingWireSource } from './stepManufacturingFeatures';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, PocketStrategy, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type StepPocketCandidate={faceId:number;zMm:number;outer:P2[];islands:P2[][];areaMm2:number};
export type StepPocketOperationState={ok:boolean;toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];candidates:StepPocketCandidate[];selected:StepPocketCandidate|null;targetDepthMm:number|null};

type P3={x:number;y:number;z:number};
const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a:P2,b:P2)=>dist(a,b)<=1e-4;
const rotateZ=(p:P3,deg:number):P3=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};
const bounds3=(points:P3[])=>({minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.z)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});
const areaAbs=(p:P2[])=>Math.abs(polygonArea(p));

function sampleEdge(edge:StepManufacturingEdgeSource):P2[]|null{
  const start={x:edge.start[0],y:edge.start[1]},end={x:edge.end[0],y:edge.end[1]};
  if(edge.kind==='line')return[start,end];
  if(edge.kind!=='circle'||!edge.center||!edge.radiusMm||!edge.axisDirection)return null;
  const center={x:edge.center[0],y:edge.center[1]},r=edge.radiusMm;
  if(edge.closed||same(start,end))return Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};});
  let a0=Math.atan2(start.y-center.y,start.x-center.x),a1=Math.atan2(end.y-center.y,end.x-center.x);let ccw=edge.axisDirection[2]>=0;if(edge.orientation==='reversed')ccw=!ccw;let d=a1-a0;if(ccw){while(d<=0)d+=Math.PI*2}else{while(d>=0)d-=Math.PI*2}
  const steps=Math.max(8,Math.ceil(Math.abs(d)/(Math.PI/18)));
  return Array.from({length:steps+1},(_,i)=>{const a=a0+d*i/steps;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};});
}
function chainWire(wire:StepManufacturingWireSource,edges:StepManufacturingEdgeSource[]):P2[]|null{
  const remaining=wire.edgeIds.map(id=>edges[id]).filter(Boolean).map(sampleEdge).filter((p):p is P2[]=>!!p&&p.length>=2);if(remaining.length!==wire.edgeIds.length||!remaining.length)return null;
  const out=[...remaining.shift()!];while(remaining.length){const end=out[out.length-1];let index=-1,reverse=false;for(let i=0;i<remaining.length;i++){const p=remaining[i];if(same(end,p[0])){index=i;break;}if(same(end,p[p.length-1])){index=i;reverse=true;break;}}if(index<0)return null;const next=remaining.splice(index,1)[0];const ordered=reverse?[...next].reverse():next;out.push(...ordered.slice(1));}
  if(!same(out[0],out[out.length-1]))out.push({...out[0]});return out;
}
function pointInPolygon(p:P2,poly:P2[]):boolean{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const hit=(a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-30)+a.x;if(hit)inside=!inside;}return inside;}
function inRegion(p:P2,outer:P2[],islands:P2[][]){return pointInPolygon(p,outer)&&!islands.some(poly=>pointInPolygon(p,poly));}
function chooseOffset(poly:P2[],distanceMm:number,wantLarger:boolean):P2[]{const a=offsetPolygon(poly,distanceMm),b=offsetPolygon(poly,-distanceMm);const aa=areaAbs(a),bb=areaAbs(b);return wantLarger?(aa>=bb?a:b):(aa<=bb?a:b);}
function scanlineSegments(outer:P2[],islands:P2[][],stepover:number):ToolpathPoint2[][]{
  const ys=outer.map(p=>p.y),minY=Math.min(...ys),maxY=Math.max(...ys),all=[outer,...islands],runs:ToolpathPoint2[][]=[];let reverse=false;
  for(let y=minY;y<=maxY+EPS;y+=stepover){const xs:number[]=[];for(const poly of all){for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a.y>y)===(b.y>y))continue;const x=a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y);if(Number.isFinite(x))xs.push(x);}}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const x0=xs[i],x1=xs[i+1],mid={x:(x0+x1)/2,y};if(!inRegion(mid,outer,islands))continue;const seg=reverse?[{x:x1,y},{x:x0,y}]:[{x:x0,y},{x:x1,y}];runs.push(seg);reverse=!reverse;}}
  return runs;
}
function closedLoop(poly:P2[]):ToolpathPoint2[]{const p=poly.map(q=>({x:q.x,y:q.y}));if(p.length&&!same(p[0],p[p.length-1]))p.push({...p[0]});return p;}
function loopIsSafe(loop:P2[],outer:P2[],islands:P2[][]){return loop.length>=4&&loop.slice(0,-1).every(p=>inRegion(p,outer,islands));}
function contourParallelSegments(outer:P2[],islands:P2[][],stepover:number):ToolpathPoint2[][]{
  const runs:ToolpathPoint2[][]=[];let shell=outer,guard=0;
  while(areaAbs(shell)>EPS&&guard++<512){const loop=closedLoop(shell);if(!loopIsSafe(loop,outer,islands))break;runs.push(loop);const next=chooseOffset(shell,stepover,false);if(areaAbs(next)>=areaAbs(shell)-EPS)break;shell=next;}
  for(const island of islands){let ring=island,prevArea=areaAbs(ring),i=0;while(i++<256){const next=chooseOffset(ring,stepover,true),a=areaAbs(next);if(a<=prevArea+EPS)break;const loop=closedLoop(next);if(!loopIsSafe(loop,outer,islands.filter(x=>x!==island)))break;runs.push(loop);ring=next;prevArea=a;}}
  return runs;
}
function candidates(summary:ImportSummary):StepPocketCandidate[]{const source=buildStepManufacturingFeatureSource(summary);if(!source.ok)return[];const result:StepPocketCandidate[]=[];for(const face of source.source.planarFaces){if(face.normal[2]<0.9)continue;const loops=(source.source.wiresByFace.get(face.faceId)??[]).filter(w=>w.closed).map(w=>chainWire(w,source.source.edges)).filter((p):p is P2[]=>!!p&&p.length>=4).sort((a,b)=>areaAbs(b)-areaAbs(a));if(!loops.length)continue;const outer=loops[0],islands=loops.slice(1).filter(loop=>pointInPolygon(loop[0],outer));const area=areaAbs(outer)-islands.reduce((s,p)=>s+areaAbs(p),0);if(area>EPS)result.push({faceId:face.faceId,zMm:face.origin[2],outer,islands,areaMm2:area});}return result.sort((a,b)=>b.zMm-a.zMm||b.areaMm2-a.areaMm2);}
function resolveStrategy(operation:PocketOperation,islands:P2[][]):Exclude<PocketStrategy,'auto'>{if(operation.strategy!=='auto')return operation.strategy;return islands.length?'parallel':'concentric';}
function lineSegments(points:ToolpathPoint2[]):CanonicalToolpathSegment[]{const out:CanonicalToolpathSegment[]=[];for(let i=1;i<points.length;i++)out.push({kind:'line',start:points[i-1],end:points[i]});return out;}
function rampEntry(points:ToolpathPoint2[],zStart:number,zEnd:number,feed:number):CanonicalSpatialSegment[]|undefined{if(points.length<2)return undefined;return[{kind:'line3',start:{x:points[0].x,y:points[0].y,z:zStart},end:{x:points[1].x,y:points[1].y,z:zEnd},feedMmMin:feed}];}
function safeCircle(center:P2,r:number,outer:P2[],islands:P2[][]){return Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};}).every(p=>inRegion(p,outer,islands));}
function helixEntry(points:ToolpathPoint2[],zStart:number,zEnd:number,feed:number,outer:P2[],islands:P2[][],r:number):CanonicalSpatialSegment[]|undefined{
  if(!points.length||!(r>EPS))return undefined;const start=points[0],candidates=[{x:start.x-r,y:start.y},{x:start.x+r,y:start.y},{x:start.x,y:start.y-r},{x:start.x,y:start.y+r}];
  const center=candidates.find(c=>safeCircle(c,r,outer,islands));if(!center)return undefined;return[{kind:'arc3',start:{x:start.x,y:start.y,z:zStart},end:{x:start.x,y:start.y,z:zEnd},center,ccw:true,feedMmMin:feed}];
}

export function buildStepPocketOperationState(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation;}):StepPocketOperationState{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args,errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='step')errors.push('STEP-Tasche benötigt einen STEP/BRep-Import.');if(stockMode==='none')errors.push('STEP-Tasche benötigt einen definierten Rohling.');if(wcs.z!=='top')errors.push('STEP-Tasche ist aktuell nur mit Z-Null oben freigegeben.');if(Math.abs(orientation.rotationXDeg)>EPS||Math.abs(orientation.rotationYDeg)>EPS)errors.push('STEP-Tasche unterstützt aktuell keine X/Y-Kippung.');if(operation.tool.diameterMm<=0||operation.stepDownMm<=0||operation.stepoverPercent<=0||operation.stepoverPercent>100)errors.push('Werkzeug, Zustellung und Stepover müssen gültig sein.');if(operation.entry==='ramp'&&(operation.rampAngleDeg<=0||operation.rampAngleDeg>15))errors.push('Rampenwinkel muss größer als 0 und höchstens 15° sein.');
  const all=candidates(summary);if(!all.length)errors.push('Keine horizontale planare STEP-Face-Region als Tasche erkannt.');const values=summary.brep?.displayVertices??[],raw:P3[]=[];for(let i=0;i+2<values.length;i+=3)raw.push(rotateZ({x:values[i],y:values[i+1],z:values[i+2]},orientation.rotationZDeg));if(!raw.length)errors.push('STEP-Bauteil besitzt keine transformierbare Geometrie.');const b=raw.length?bounds3(raw):null;
  const belowTop=all.filter(c=>b&&c.zMm<b.maxZ-EPS),selectedPool=belowTop.length?belowTop:all;if(operation.stepFaceId==null)errors.push('Keine STEP-Taschenfläche explizit gewählt. Wähle eine planare Face im Viewport.');const chosen=operation.stepFaceId==null?null:selectedPool.find(c=>c.faceId===operation.stepFaceId)??null;if(operation.stepFaceId!=null&&!chosen)errors.push('Gewählte STEP-Face ist nicht mehr als Taschenregion verfügbar.');if(errors.length||!chosen||!b)return{ok:false,toolpath:null,errors,warnings,candidates:all,selected:chosen,targetDepthMm:null};
  const w=b.maxX-b.minX,h=b.maxY-b.minY,tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-w:(stock.width-w)/2,ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-h:(stock.height-h)/2,dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY,dz=-b.minZ+placement.offsetZ;const origin={x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2};const transform=(p:P2)=>{const q=rotateZ({x:p.x,y:p.y,z:0},orientation.rotationZDeg);return{x:q.x+dx-origin.x,y:q.y+dy-origin.y};};
  const faceMachineZ=chosen.zMm+dz-stock.thickness,targetDepth=Math.max(0,-faceMachineZ);if(targetDepth<=EPS)return{ok:false,toolpath:null,errors:['Gewählte STEP-Face liegt nicht unter der Rohlingoberseite und definiert keine Tasche.'],warnings,candidates:all,selected:chosen,targetDepthMm:targetDepth};
  const radius=operation.tool.diameterMm/2,outer=chooseOffset(chosen.outer.map(transform),radius,false),islands=chosen.islands.map(loop=>chooseOffset(loop.map(transform),radius,true));if(areaAbs(outer)<=EPS)return{ok:false,toolpath:null,errors:['Werkzeug ist für die STEP-Taschenregion zu groß.'],warnings,candidates:all,selected:chosen,targetDepthMm:targetDepth};
  const strategy=resolveStrategy(operation,islands);if(strategy==='concentric'&&islands.length)errors.push('Konzentrische STEP-Tasche ist in 004M nur für Regionen ohne Inseln freigegeben. Verwende Konturparallel oder Raster.');
  const stepover=operation.tool.diameterMm*operation.stepoverPercent/100;let paths:ToolpathPoint2[][]=[];if(strategy==='raster')paths=scanlineSegments(outer,islands,stepover);else paths=contourParallelSegments(outer,islands,stepover);if(!paths.length)errors.push('Für die STEP-Tasche konnte mit der gewählten Strategie keine sichere Bahn erzeugt werden.');if(errors.length)return{ok:false,toolpath:null,errors,warnings,candidates:all,selected:chosen,targetDepthMm:targetDepth};
  const passes=Math.max(1,Math.ceil(targetDepth/operation.stepDownMm)),runs:CanonicalToolpath['runs']=[];for(let pass=1;pass<=passes;pass++){const z=-Math.min(targetDepth,pass*operation.stepDownMm),zStart=pass===1?0:-Math.min(targetDepth,(pass-1)*operation.stepDownMm);for(const path of paths){const points=path.map(p=>({x:p.x,y:p.y}));let entrySegments:CanonicalSpatialSegment[]|undefined;if(operation.entry==='ramp')entrySegments=rampEntry(points,zStart,z,operation.plungeMmMin);else if(operation.entry==='helix'){const helixRadius=Math.max(.25,Math.min(operation.tool.diameterMm*.35,stepover*.45));entrySegments=helixEntry(points,zStart,z,operation.plungeMmMin,outer,islands,helixRadius);if(!entrySegments){errors.push('Für mindestens eine STEP-Taschenbahn passt am Startpunkt kein kollisionsfreier Helixkreis. Verwende Rampe oder Senkrecht.');break;}}runs.push({kind:'cut',z,points,segments:lineSegments(points),entrySegments});}if(errors.length)break;}
  if(errors.length)return{ok:false,toolpath:null,errors,warnings,candidates:all,selected:chosen,targetDepthMm:targetDepth};
  if(strategy==='parallel')warnings.push('STEP-Tasche verwendet konturparallele Offset-Lagen auf der explizit gewählten BRep-Region.');if(operation.entry==='ramp')warnings.push(`STEP-Tasche verwendet linearen Rampeneinstieg (${operation.rampAngleDeg.toFixed(1)}° UI-Sollwert; Geometrie wird durch sichere erste Bahn begrenzt).`);if(operation.entry==='helix')warnings.push('STEP-Tasche verwendet validierten kanonischen Helix-Einstieg pro Teilbahn.');
  return{ok:true,toolpath:{version:1,operationKind:'pocket',strategy:strategy==='parallel'?'parallel-pocket':strategy,tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:operation.stepoverPercent,runs},errors:[],warnings,candidates:all,selected:chosen,targetDepthMm:targetDepth};
}
