import type { Point2 } from './types';
import { offsetSemanticContour, type SemanticContour, type SemanticSegment } from './contourMath';

export type ParallelPocketLoop={correctionMm:number;segments:SemanticSegment[]};
export type ParallelPocketPath={
  ok:boolean;
  error?:string;
  toolRadiusMm:number;
  requestedStepoverMm:number;
  actualMaxStepoverMm:number;
  loops:ParallelPocketLoop[];
  finalArcRadiusMm:number;
};

const EPS=1e-6;
const dist=(a:Point2,b:Point2)=>Math.hypot(a.x-b.x,a.y-b.y);

function sampleSegment(s:SemanticSegment,steps=24):Point2[]{
  if(s.kind==='line')return[s.start,s.end];
  const a0=Math.atan2(s.start.y-s.center.y,s.start.x-s.center.x),a1=Math.atan2(s.end.y-s.center.y,s.end.x-s.center.x);
  let d=a1-a0;
  if(s.ccw){while(d<=0)d+=Math.PI*2}else{while(d>=0)d-=Math.PI*2}
  return Array.from({length:steps+1},(_,i)=>{const a=a0+d*i/steps;return{x:s.center.x+Math.cos(a)*s.radius,y:s.center.y+Math.sin(a)*s.radius}});
}
function sampleLoop(segs:SemanticSegment[]):Point2[]{const out:Point2[]=[];for(const s of segs){const p=sampleSegment(s);out.push(...(out.length?p.slice(1):p))}return out;}
function orient(a:Point2,b:Point2,c:Point2){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function segmentsIntersect(a:Point2,b:Point2,c:Point2,d:Point2){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return o1*o2<-EPS&&o3*o4<-EPS;}
function selfIntersects(segs:SemanticSegment[]):boolean{
  const pts=sampleLoop(segs);if(pts.length<5)return false;
  const ring=dist(pts[0],pts[pts.length-1])<1e-4?pts.slice(0,-1):pts;
  for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){
    if(j===i||j===(i+1)%ring.length||i===(j+1)%ring.length)continue;
    if(i===0&&j===ring.length-1)continue;
    if(segmentsIntersect(ring[i],ring[(i+1)%ring.length],ring[j],ring[(j+1)%ring.length]))return true;
  }
  return false;
}

function axisAlignedRectangle(contour:SemanticContour):{width:number;height:number}|null{
  if(!contour.supported||contour.segments.length!==4||contour.segments.some(s=>s.kind!=='line'))return null;
  const points=contour.segments.flatMap(s=>[s.start,s.end]);
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=maxX-minX,height=maxY-minY;if(width<=EPS||height<=EPS)return null;
  for(const s of contour.segments){if(s.kind!=='line')return null;const horizontal=Math.abs(s.start.y-s.end.y)<=1e-5,vertical=Math.abs(s.start.x-s.end.x)<=1e-5;if(!horizontal&&!vertical)return null;}
  const corners=[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}];
  if(!corners.every(c=>points.some(p=>dist(c,p)<=1e-4)))return null;
  return{width,height};
}

/**
 * Conservative native LINE/ARC pocketing. Mixed LINE/ARC contours retain the
 * proven analytical offset gate. Axis-aligned four-line rectangles are also
 * admitted: their final inward offset is chosen so the cutter sweep closes the
 * remaining core while every radial step stays at or below the requested stepover.
 */
export function buildParallelPocketPath(contour:SemanticContour,toolDiameterMm:number,stepoverPercent:number):ParallelPocketPath{
  const toolRadiusMm=toolDiameterMm/2,requestedStepoverMm=toolDiameterMm*stepoverPercent/100;
  const empty={ok:false,toolRadiusMm,requestedStepoverMm,actualMaxStepoverMm:0,loops:[],finalArcRadiusMm:0};
  if(!(toolDiameterMm>0))return{...empty,error:'Werkzeugdurchmesser muss größer als 0 sein.'};
  if(!(stepoverPercent>0&&stepoverPercent<=100))return{...empty,error:'Seitliche Zustellung muss zwischen 0 und 100 % liegen.'};
  if(!contour.supported||contour.segments.length<2)return{...empty,error:'Konturparallel benötigt eine geschlossene native DXF-Kontur aus unterstützten Segmenten.'};

  const rectangle=axisAlignedRectangle(contour);
  if(rectangle){
    const minDimension=Math.min(rectangle.width,rectangle.height);
    if(minDimension<toolDiameterMm-EPS)return{...empty,error:'Das Werkzeug passt nicht vollständig in die gewählte Rechtecktasche.'};
    const targetCorrection=Math.max(toolRadiusMm,minDimension/2-toolRadiusMm);
    const span=Math.max(0,targetCorrection-toolRadiusMm);
    const intervals=span<=EPS?0:Math.ceil(span/requestedStepoverMm);
    const actualStep=intervals?span/intervals:0;
    const corrections=intervals?Array.from({length:intervals+1},(_,i)=>toolRadiusMm+actualStep*i):[toolRadiusMm];
    const loops:ParallelPocketLoop[]=[];
    for(const correction of corrections){
      const offset=offsetSemanticContour(contour,-correction,.002);
      if(!offset||!offset.validation.ok||selfIntersects(offset.segments))return{...empty,error:'Die Rechtecktasche konnte nicht als sichere konturparallele Offsetfolge aufgebaut werden.'};
      loops.push({correctionMm:correction,segments:offset.segments});
    }
    return{ok:true,toolRadiusMm,requestedStepoverMm,actualMaxStepoverMm:actualStep||span||0,loops,finalArcRadiusMm:0};
  }

  if(!contour.segments.some(s=>s.kind==='arc'))return{...empty,error:'Konturparallel unterstützt derzeit gemischte LINE/ARC-Konturen sowie achsparallele Rechtecke.'};

  const loops:ParallelPocketLoop[]=[];let correction=toolRadiusMm;let previous=0;
  for(let guard=0;guard<500;guard++){
    const offset=offsetSemanticContour(contour,-correction,.002);
    if(!offset||!offset.validation.ok||selfIntersects(offset.segments))break;
    loops.push({correctionMm:correction,segments:offset.segments});
    previous=correction;correction+=requestedStepoverMm;
  }
  if(!loops.length)return{...empty,error:'Das Werkzeug passt nicht als sichere konturparallele Bahn in die gewählte Tasche.'};
  const finalArcs=loops[loops.length-1].segments.filter((s):s is Extract<SemanticSegment,{kind:'arc'}>=>s.kind==='arc');
  const finalArcRadiusMm=finalArcs.length?Math.min(...finalArcs.map(a=>a.radius)):Infinity;
  if(!Number.isFinite(finalArcRadiusMm)||finalArcRadiusMm>toolRadiusMm+requestedStepoverMm+1e-3){
    return{...empty,error:'Die konturparallelen Offsets decken den Taschenkern noch nicht sicher ab; Gate 8B verweigert die Freigabe.'};
  }
  const actualMaxStepoverMm=loops.length>1?Math.max(...loops.slice(1).map((l,i)=>l.correctionMm-loops[i].correctionMm)):previous;
  return{ok:true,toolRadiusMm,requestedStepoverMm,actualMaxStepoverMm,loops,finalArcRadiusMm};
}
