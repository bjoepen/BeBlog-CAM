import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import { offsetPolygon, polygonArea, type P2 } from './contourMath';
import type { PocketOperation } from './types';

export type RegionPocketStrategy='raster'|'concentric'|'parallel';
export type RegionPocketResult={toolpath:CanonicalToolpath|null;errors:string[];warnings:string[]};
const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const areaAbs=(p:P2[])=>Math.abs(polygonArea(p));
const chooseOffset=(poly:P2[],d:number,wantLarger:boolean)=>{const a=offsetPolygon(poly,d),b=offsetPolygon(poly,-d),aa=areaAbs(a),bb=areaAbs(b);return wantLarger?(aa>=bb?a:b):(aa<=bb?a:b);};
const closedLoop=(poly:P2[]):ToolpathPoint2[]=>{const out=poly.map(p=>({x:p.x,y:p.y}));if(out.length&&dist(out[0],out[out.length-1])>1e-5)out.push({...out[0]});return out;};
const lineSegments=(points:ToolpathPoint2[]):CanonicalToolpathSegment[]=>points.slice(1).map((end,i)=>({kind:'line',start:points[i],end}));

function pointSegmentDistance(p:P2,a:P2,b:P2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=EPS)return dist(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function distanceToBoundary(p:P2,poly:P2[]){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];best=Math.min(best,pointSegmentDistance(p,a,b));}return best;}
function pointInPolygon(p:P2,poly:P2[]){if(distanceToBoundary(p,poly)<=1e-5)return true;let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a.y>p.y)===(b.y>p.y))continue;const x=(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-30)+a.x;if(p.x<x)inside=!inside;}return inside;}
function inRegion(p:P2,outer:P2[],islands:P2[][]){return pointInPolygon(p,outer)&&!islands.some(poly=>pointInPolygon(p,poly)&&distanceToBoundary(p,poly)>1e-5);}
function loopSafe(loop:P2[],outer:P2[],islands:P2[][]){return loop.length>=4&&loop.every(p=>inRegion(p,outer,islands));}
function centroid(poly:P2[]):P2{let twice=0,cx=0,cy=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],cross=a.x*b.y-b.x*a.y;twice+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;}if(Math.abs(twice)<=EPS){const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y);return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};}return{x:cx/(3*twice),y:cy/(3*twice)};}
const circle=(c:P2,r:number)=>Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return{x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r};});

function rasterPaths(outer:P2[],islands:P2[][],stepover:number){
  const ys=outer.map(p=>p.y),minY=Math.min(...ys),maxY=Math.max(...ys),all=[outer,...islands],paths:ToolpathPoint2[][]=[];let reverse=false;
  for(let y=minY;y<=maxY+EPS;y+=stepover){
    const xs:number[]=[];
    for(const poly of all)for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[j],b=poly[i];if((a.y>y)===(b.y>y))continue;
      const x=a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y);if(Number.isFinite(x))xs.push(x);
    }
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2){const x0=xs[i],x1=xs[i+1],mid={x:(x0+x1)/2,y};if(!inRegion(mid,outer,islands))continue;paths.push(reverse?[{x:x1,y},{x:x0,y}]:[{x:x0,y},{x:x1,y}]);reverse=!reverse;}
  }
  return paths;
}

function parallelPaths(outer:P2[],islands:P2[][],stepover:number){const paths:ToolpathPoint2[][]=[];let shell=outer,guard=0;while(areaAbs(shell)>EPS&&guard++<512){const loop=closedLoop(shell);if(!loopSafe(loop,outer,islands))break;paths.push(loop);const next=chooseOffset(shell,stepover,false);if(areaAbs(next)>=areaAbs(shell)-EPS||areaAbs(next)<=EPS)break;shell=next;}for(const island of islands){let ring=island,prev=areaAbs(ring),i=0;while(i++<256){const next=chooseOffset(ring,stepover,true),a=areaAbs(next);if(a<=prev+EPS)break;const loop=closedLoop(next);if(!loopSafe(loop,outer,islands.filter(x=>x!==island)))break;paths.push(loop);ring=next;prev=a;}}return paths;}

function concentricPaths(outer:P2[],islands:P2[][],stepover:number){if(islands.length)return{paths:[] as ToolpathPoint2[][],error:'Kreisräumen ist für Taschen mit Inseln noch nicht freigegeben; verwende Raster oder Konturparallel.'};const c=centroid(outer);if(!pointInPolygon(c,outer))return{paths:[] as ToolpathPoint2[][],error:'Kreisräumen benötigt einen sicheren Mittelpunkt innerhalb der Taschenregion.'};const maxR=distanceToBoundary(c,outer);if(!(maxR>EPS))return{paths:[] as ToolpathPoint2[][],error:'Taschenregion ist für Kreisräumen zu klein.'};const paths:ToolpathPoint2[][]=[];for(let r=Math.min(stepover,maxR);r<=maxR+EPS;r+=stepover){const rr=Math.min(r,maxR),loop=circle(c,rr);if(loopSafe(loop,outer,[]))paths.push(loop);if(rr>=maxR-EPS)break;}let shell=outer,guard=0;while(areaAbs(shell)>EPS&&guard++<512){const radialMax=Math.max(...shell.map(p=>dist(p,c)));if(radialMax<=maxR+stepover*.5)break;const loop=closedLoop(shell);if(loopSafe(loop,outer,[]))paths.push(loop);const next=chooseOffset(shell,stepover,false);if(areaAbs(next)>=areaAbs(shell)-EPS||areaAbs(next)<=EPS)break;shell=next;}return{paths,error:null as string|null};}

function connectorSafe(a:P2,b:P2,outer:P2[],islands:P2[][]){const length=dist(a,b),steps=Math.max(2,Math.ceil(length/Math.max(.25,length/24)));for(let i=0;i<=steps;i++){const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(!inRegion(p,outer,islands))return false;}return true;}
function reversePath(path:ToolpathPoint2[]){return [...path].reverse().map(p=>({...p}));}
function chainPaths(paths:ToolpathPoint2[][],outer:P2[],islands:P2[][]){
  const remaining=paths.filter(path=>path.length>=2).map(path=>path.map(p=>({...p}))),chains:ToolpathPoint2[][]=[];
  while(remaining.length){const chain=remaining.shift()!,end=()=>chain[chain.length-1];let progress=true;while(progress&&remaining.length){progress=false;let best=-1,bestReverse=false,bestDistance=Infinity;for(let i=0;i<remaining.length;i++){for(const reverse of [false,true]){const candidate=reverse?remaining[i][remaining[i].length-1]:remaining[i][0],d=dist(end(),candidate);if(d<bestDistance&&connectorSafe(end(),candidate,outer,islands)){best=i;bestReverse=reverse;bestDistance=d;}}}if(best>=0){const next=remaining.splice(best,1)[0],ordered=bestReverse?reversePath(next):next;if(dist(end(),ordered[0])>EPS)chain.push({...ordered[0]});chain.push(...ordered.slice(1).map(p=>({...p})));progress=true;}}chains.push(chain);}
  return chains;
}

function rampEntry(operation:PocketOperation,path:ToolpathPoint2[],zStart:number,zEnd:number):{segments?:CanonicalSpatialSegment[];runPoints?:ToolpathPoint2[];error?:string}{
  const angle=operation.rampAngleDeg;if(!(angle>0&&angle<=15))return{error:'Rampenwinkel muss größer als 0 und höchstens 15° sein.'};
  const required=Math.abs(zEnd-zStart)/Math.tan(angle*Math.PI/180),lengths=path.slice(1).map((point,index)=>dist(path[index],point)),available=lengths.reduce((sum,length)=>sum+length,0);if(!(available+EPS>=required))return{error:`Rampenwinkel ${angle.toFixed(1)}° benötigt ${required.toFixed(3)} mm Rampenlänge; die zusammenhängende Taschenbahn bietet ${available.toFixed(3)} mm.`};
  const segments:CanonicalSpatialSegment[]=[],rampPoints:ToolpathPoint2[]=[{...path[0]}];let travelled=0;
  for(let i=1;i<path.length&&travelled<required-EPS;i++){const start=path[i-1],fullEnd=path[i],length=dist(start,fullEnd);if(length<=EPS)continue;const use=Math.min(length,required-travelled),t=use/length,end={x:start.x+(fullEnd.x-start.x)*t,y:start.y+(fullEnd.y-start.y)*t},z0=zStart+(zEnd-zStart)*(travelled/required),z1=zStart+(zEnd-zStart)*((travelled+use)/required);segments.push({kind:'line3',start:{...start,z:z0},end:{...end,z:z1},feedMmMin:operation.plungeMmMin});rampPoints.push({...end});travelled+=use;}
  if(travelled<required-EPS)return{error:'Rampenbahn konnte trotz ausreichender Gesamtlänge nicht vollständig materialisiert werden.'};
  const entryEnd=rampPoints[rampPoints.length-1],runPoints=[{...entryEnd},...reversePath(rampPoints).slice(1),...path.slice(1).map(p=>({...p}))];
  return{segments,runPoints};
}

function helixEntry(operation:PocketOperation,path:ToolpathPoint2[],zStart:number,zEnd:number,outer:P2[],islands:P2[][]):{segments?:CanonicalSpatialSegment[];runPoints?:ToolpathPoint2[];error?:string}{
  if(path.length<2)return{error:'Helix-Einstieg benötigt eine ausreichend lange Taschenbahn.'};
  const start=path[0],r=Math.max(.25,operation.tool.diameterMm*.35),centers=[{x:start.x-r,y:start.y},{x:start.x+r,y:start.y},{x:start.x,y-r},{x:start.x,y+r}];
  const center=centers.find(c=>circle(c,r).every(p=>inRegion(p,outer,islands)));if(!center)return{error:'Am Start der zusammenhängenden Taschenbahn passt kein sicherer Helix-Einstieg.'};
  return{segments:[{kind:'arc3',start:{...start,z:zStart},end:{...start,z:zEnd},center,ccw:true,feedMmMin:operation.plungeMmMin}],runPoints:path.map(p=>({...p}))};
}

function buildEntry(operation:PocketOperation,path:ToolpathPoint2[],zStart:number,zEnd:number,outer:P2[],islands:P2[][]):{segments?:CanonicalSpatialSegment[];runPoints:ToolpathPoint2[];error?:string}{if(operation.entry==='plunge')return{runPoints:path.map(p=>({...p}))};if(operation.entry==='ramp'){const result=rampEntry(operation,path,zStart,zEnd);return{segments:result.segments,runPoints:result.runPoints??path,error:result.error};}const result=helixEntry(operation,path,zStart,zEnd,outer,islands);return{segments:result.segments,runPoints:result.runPoints??path,error:result.error};}

export function buildRegionPocketToolpath(args:{outer:P2[];islands?:P2[][];operation:PocketOperation;targetDepthMm:number;strategy:RegionPocketStrategy}):RegionPocketResult{
  const {operation,targetDepthMm,strategy}=args,errors:string[]=[],warnings:string[]=[];if(!(operation.tool.diameterMm>0&&operation.stepoverPercent>0&&operation.stepoverPercent<=100&&operation.stepDownMm>0&&targetDepthMm>0))return{toolpath:null,errors:['Taschenstrategie benötigt gültiges Werkzeug, Stepover, Zustellung und Zieltiefe.'],warnings};
  const toolRadius=operation.tool.diameterMm/2,outer=chooseOffset(args.outer,toolRadius,false),islands=(args.islands??[]).map(loop=>chooseOffset(loop,toolRadius,true));if(areaAbs(outer)<=EPS)return{toolpath:null,errors:['Werkzeug ist für die Taschenregion zu groß.'],warnings};
  const stepover=Math.max(.05,operation.tool.diameterMm*operation.stepoverPercent/100);let planned:{paths:ToolpathPoint2[][];error:string|null};if(strategy==='raster')planned={paths:rasterPaths(outer,islands,stepover),error:null};else if(strategy==='parallel')planned={paths:parallelPaths(outer,islands,stepover),error:null};else planned=concentricPaths(outer,islands,stepover);if(planned.error)errors.push(planned.error);if(!planned.paths.length)errors.push(`Für ${strategy==='raster'?'Raster':strategy==='concentric'?'Kreis':'Konturparallel'} konnte keine sichere Taschenbahn erzeugt werden.`);if(errors.length)return{toolpath:null,errors,warnings};
  const chains=chainPaths(planned.paths,outer,islands);if(!chains.length)return{toolpath:null,errors:['Taschenbahnen konnten nicht zu sicheren zusammenhängenden Ebenenketten verbunden werden.'],warnings};
  const passes=Math.max(1,Math.ceil(targetDepthMm/operation.stepDownMm)),runs:CanonicalToolpath['runs']=[];for(let pass=1;pass<=passes;pass++){const z=-Math.min(targetDepthMm,pass*operation.stepDownMm),zStart=pass===1?0:-Math.min(targetDepthMm,(pass-1)*operation.stepDownMm);for(const chain of chains){const entry=buildEntry(operation,chain,zStart,z,outer,islands);if(entry.error){errors.push(entry.error);break;}runs.push({kind:'cut',z,points:entry.runPoints,segments:lineSegments(entry.runPoints),entrySegments:entry.segments,retractAfter:true});}if(errors.length)break;}
  if(errors.length)return{toolpath:null,errors,warnings};
  if(strategy==='raster')warnings.push('Raster verwendet zusammenhängende Zickzack-Ebenenketten; eine Einfahrt erfolgt nur am Anfang jeder sicher verbundenen Ebene.');else if(strategy==='concentric')warnings.push('Kreisräumen verwendet konzentrische Kernbahnen plus konturparallele Cleanup-Schalen für Ecken und Freiformbereiche.');else warnings.push('Konturparallel verwendet werkzeugradiuskorrigierte Offset-Schalen der Sollkontur und verbindet sichere Nachbarschalen stay-down.');
  return{toolpath:{version:1,operationKind:'pocket',strategy:strategy==='raster'?'raster':strategy==='parallel'?'parallel-pocket':'concentric',tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:operation.stepoverPercent,runs},errors:[],warnings};
}
