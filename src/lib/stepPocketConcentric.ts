import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';
import { offsetPolygon, polygonArea, type P2 } from './contourMath';
import type { StepPocketCandidate } from './stepPocketOperation';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, WorkCoordinateSystem } from './types';

export type StepPocketConcentricResult={toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];ringCount:number;cleanupCount:number};

type P3={x:number;y:number;z:number};
const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const areaAbs=(points:P2[])=>Math.abs(polygonArea(points));
const rotateZ=(p:P3,deg:number):P3=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};

function bounds3(points:P3[]){return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}
function chooseOffset(poly:P2[],distanceMm:number,wantLarger:boolean):P2[]{const a=offsetPolygon(poly,distanceMm),b=offsetPolygon(poly,-distanceMm);const aa=areaAbs(a),bb=areaAbs(b);return wantLarger?(aa>=bb?a:b):(aa<=bb?a:b);}
function closedLoop(poly:P2[]):ToolpathPoint2[]{const points=poly.map(p=>({x:p.x,y:p.y}));if(points.length&&dist(points[0],points[points.length-1])>1e-5)points.push({...points[0]});return points;}
function lineSegments(points:ToolpathPoint2[]){return points.slice(1).map((end,index)=>({kind:'line' as const,start:points[index],end}));}
function pointInPolygon(p:P2,poly:P2[]):boolean{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a.y>p.y)===(b.y>p.y))continue;const x=(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-30)+a.x;if(p.x<x)inside=!inside;}return inside;}
function pointSegmentDistance(p:P2,a:P2,b:P2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=EPS)return dist(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function minDistanceToLoop(p:P2,poly:P2[]){let best=Infinity;for(let i=1;i<poly.length;i++)best=Math.min(best,pointSegmentDistance(p,poly[i-1],poly[i]));if(poly.length>2)best=Math.min(best,pointSegmentDistance(p,poly[poly.length-1],poly[0]));return best;}
function polygonCentroid(poly:P2[]):P2{let twiceArea=0,cx=0,cy=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],cross=a.x*b.y-b.x*a.y;twiceArea+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;}if(Math.abs(twiceArea)<=EPS){const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y);return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};}return{x:cx/(3*twiceArea),y:cy/(3*twiceArea)};}
function circlePoints(center:P2,radius:number,count=96):ToolpathPoint2[]{return Array.from({length:count+1},(_,i)=>{const a=i/count*Math.PI*2;return{x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius};});}

function transformCandidate(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;candidate:StepPocketCandidate;toolRadiusMm:number}){
  const {summary,stock,placement,orientation,wcs,candidate,toolRadiusMm}=args;
  const values=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(rotateZ({x:values[i],y:values[i+1],z:values[i+2]},orientation.rotationZDeg));
  if(!raw.length)return null;
  const b=bounds3(raw),width=b.maxX-b.minX,height=b.maxY-b.minY;
  const targetX=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-width:(stock.width-width)/2;
  const targetY=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-height:(stock.height-height)/2;
  const dx=targetX-b.minX+placement.offsetX,dy=targetY-b.minY+placement.offsetY;
  const origin={x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2};
  const transform=(p:P2)=>{const q=rotateZ({x:p.x,y:p.y,z:0},orientation.rotationZDeg);return{x:q.x+dx-origin.x,y:q.y+dy-origin.y};};
  const outer=chooseOffset(candidate.outer.map(transform),toolRadiusMm,false);
  const islands=candidate.islands.map(loop=>chooseOffset(loop.map(transform),toolRadiusMm,true));
  return{outer,islands};
}

function entryForDepth(args:{operation:PocketOperation;center:P2;maxRadius:number;zStart:number;zEnd:number}):{start:P2;segments?:CanonicalSpatialSegment[];error?:string}{
  const {operation,center,maxRadius,zStart,zEnd}=args;
  if(operation.entry==='plunge')return{start:center};
  if(operation.entry==='helix'){
    const radius=Math.max(.25,Math.min(operation.tool.diameterMm*.35,maxRadius*.5));
    if(!(radius>EPS&&radius<maxRadius-EPS))return{start:center,error:'Für das konzentrische STEP-Räumen passt kein sicherer Helix-Einstieg in die Taschenregion.'};
    const start={x:center.x+radius,y:center.y};
    return{start,segments:[{kind:'arc3',start:{...start,z:zStart},end:{...start,z:zEnd},center,ccw:true,feedMmMin:operation.plungeMmMin}]};
  }
  const required=Math.abs(zEnd-zStart)/Math.tan(operation.rampAngleDeg*Math.PI/180);
  if(!(required>EPS&&required<=2*maxRadius-EPS))return{start:center,error:`Rampenwinkel ${operation.rampAngleDeg.toFixed(1)}° benötigt ${required.toFixed(3)} mm Rampenlänge; in der konzentrischen STEP-Tasche stehen maximal ${(2*maxRadius).toFixed(3)} mm zur Verfügung.`};
  const start={x:center.x-required/2,y:center.y},end={x:center.x+required/2,y:center.y};
  return{start:end,segments:[{kind:'line3',start:{...start,z:zStart},end:{...end,z:zEnd},feedMmMin:operation.plungeMmMin}]};
}

export function buildStepConcentricCleanupToolpath(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation;candidate:StepPocketCandidate;targetDepthMm:number}):StepPocketConcentricResult{
  const {summary,stock,placement,orientation,wcs,operation,candidate,targetDepthMm}=args,errors:string[]=[],warnings:string[]=[];
  if(candidate.islands.length)errors.push('Kreisräumen ist für STEP-Taschen mit Inseln noch nicht freigegeben; verwende Raster oder Konturparallel.');
  if(!(operation.tool.diameterMm>0&&operation.stepDownMm>0&&operation.stepoverPercent>0&&operation.stepoverPercent<=100))errors.push('Kreisräumen benötigt gültigen Werkzeugdurchmesser, Z-Zustellung und Stepover.');
  if(!(targetDepthMm>EPS))errors.push('Kreisräumen benötigt eine positive STEP-Taschentiefe.');
  if(errors.length)return{toolpath:null,errors,warnings,ringCount:0,cleanupCount:0};

  const transformed=transformCandidate({summary,stock,placement,orientation,wcs,candidate,toolRadiusMm:operation.tool.diameterMm/2});
  if(!transformed||areaAbs(transformed.outer)<=EPS)return{toolpath:null,errors:['Kreisräumen konnte die transformierte STEP-Taschenregion nicht aufbauen.'],warnings,ringCount:0,cleanupCount:0};
  const outer=transformed.outer,center=polygonCentroid(outer);
  if(!pointInPolygon(center,outer))return{toolpath:null,errors:['Kreisräumen benötigt einen sicheren Mittelpunkt innerhalb der STEP-Taschenregion. Verwende für diese Geometrie Raster oder Konturparallel.'],warnings,ringCount:0,cleanupCount:0};
  const maxRadius=minDistanceToLoop(center,outer);
  if(!(maxRadius>operation.tool.diameterMm*.15))return{toolpath:null,errors:['STEP-Taschenregion ist für konzentrische Kreisbahnen zu schmal.'],warnings,ringCount:0,cleanupCount:0};

  const stepover=Math.max(.05,operation.tool.diameterMm*operation.stepoverPercent/100),radii:number[]=[];
  for(let radius=Math.min(stepover,maxRadius);radius<maxRadius-EPS;radius+=stepover)radii.push(radius);
  if(!radii.length||Math.abs(radii[radii.length-1]-maxRadius)>EPS)radii.push(maxRadius);
  const cleanup=closedLoop(outer),passes=Math.max(1,Math.ceil(targetDepthMm/operation.stepDownMm)),runs:CanonicalToolpathRun[]=[];
  let ringCount=0,cleanupCount=0;
  for(let pass=1;pass<=passes;pass++){
    const z=-Math.min(targetDepthMm,pass*operation.stepDownMm),zStart=pass===1?0:-Math.min(targetDepthMm,(pass-1)*operation.stepDownMm);
    const entry=entryForDepth({operation,center,maxRadius,zStart,zEnd:z});
    if(entry.error){errors.push(entry.error);break;}
    const firstRadius=radii[0],firstCircle=circlePoints(center,firstRadius),firstStart=entry.start;
    const firstPoints:ToolpathPoint2[]=[firstStart];
    if(dist(firstStart,center)>EPS)firstPoints.push(center);
    if(dist(firstPoints[firstPoints.length-1],firstCircle[0])>EPS)firstPoints.push(firstCircle[0]);
    firstPoints.push(...firstCircle.slice(1));
    runs.push({kind:'cut',z,points:firstPoints,segments:lineSegments(firstPoints),entrySegments:entry.segments,retractAfter:radii.length===1});ringCount++;
    for(let i=1;i<radii.length;i++){
      const points=circlePoints(center,radii[i]);
      runs.push({kind:'cut',z,points,segments:lineSegments(points),retractAfter:i===radii.length-1});ringCount++;
    }
    runs.push({kind:'cut',z,points:cleanup,segments:lineSegments(cleanup),retractAfter:true});cleanupCount++;
  }
  if(errors.length)return{toolpath:null,errors,warnings,ringCount,cleanupCount};
  warnings.push(`STEP-Kreisräumen aktiv: ${radii.length} konzentrische Ring${radii.length===1?'bahn':'bahnen'} je Z-Ebene plus konturtreuer Cleanup-Umlauf für Ecken und Wand.`);
  return{toolpath:{version:1,operationKind:'pocket',strategy:'concentric',tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:operation.stepoverPercent,runs},errors:[],warnings,ringCount,cleanupCount};
}
