import type { P2, SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import { measureSemanticGuide, stationAtLength } from './trochoidalSemanticMath';
import { buildSemanticTrochoid } from './trochoidalSemanticMath';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import { maximumLoopCentreAdvanceMm } from './trochoidalMaterialStep';

export type LocalRadiusTrochoidResult =
 | {ok:true;segments:SemanticSegment[];loopCount:number;errors:[]}
 | {ok:false;segments:[];loopCount:0;errors:string[]};

const EPS=1e-6,MAX_LOOPS=10000;
const fail=(e:string):LocalRadiusTrochoidResult=>({ok:false,segments:[],loopCount:0,errors:[e]});
const localRadius=(segment:SemanticSegment,requested:number,freeSide:'left'|'right')=>{
 if(segment.kind==='line')return requested;
 const bendsTowardFreeSide=segment.ccw?freeSide==='left':freeSide==='right';
 return bendsTowardFreeSide?Math.min(requested,segment.radius):requested;
};

/** E7 rectangle production geometry. forwardStepMm bounds the actual advance
 * of consecutive loop centres. Curved guide segments are subdivided so their
 * offset centre locus cannot advance farther than the requested step. */
export function buildLocalRadiusTrochoid(
 guide:TrochoidalContourGuide,
 options:Omit<StraightTrochoidOptions,'freeSide'> & {freeSide:'left'|'right'},
 minimumRadiusMm=.25,
 cutterRadiusMm?:number,
 allowedExposedAngleDeg?:number
):LocalRadiusTrochoidResult{
 const measured=measureSemanticGuide(guide.segments);
 if(!measured.ok||!measured.metric.closed)return fail(measured.ok?'Lokale Trochoide benötigt eine geschlossene Führung.':measured.errors[0]);
 if(!Number.isFinite(options.radiusMm)||options.radiusMm<=0||!Number.isFinite(options.forwardStepMm)||options.forwardStepMm<=0)
   return fail('Radius und Fortschritt müssen endlich und positiv sein.');
 const metric=measured.metric;
 const materialStep=cutterRadiusMm!==undefined&&allowedExposedAngleDeg!==undefined
   ?maximumLoopCentreAdvanceMm(options.radiusMm,cutterRadiusMm,allowedExposedAngleDeg):null;
 const effectiveStep=materialStep===null?options.forwardStepMm:Math.min(options.forwardStepMm,materialStep);
 const distances:number[]=[0]; let traversed=0;
 for(let i=0;i<metric.segments.length;i++){
   const segment=metric.segments[i],length=metric.lengthsMm[i];
   const radius=localRadius(segment,options.radiusMm,options.freeSide);
   if(radius<minimumRadiusMm)return fail('Lokaler Trochoidenradius unterschreitet den Mindestradius.');
   let intervals:number;
   if(segment.kind==='line') intervals=Math.max(1,Math.ceil(length/effectiveStep));
   else {
     const bendsTowardFreeSide=segment.ccw?options.freeSide==='left':options.freeSide==='right';
     const locusRadius=bendsTowardFreeSide?Math.abs(segment.radius-radius):segment.radius+radius;
     if(locusRadius<=EPS) return fail('Schleifenmittelpunkt kollabiert auf dem Führungsbogen.');
     const maxAngle=2*Math.asin(Math.min(1,effectiveStep/(2*locusRadius)));
     if(!Number.isFinite(maxAngle)||maxAngle<=0)return fail('Lokale Bogenunterteilung ist nicht bestimmbar.');
     const sweep=length/segment.radius;
     intervals=Math.max(1,Math.ceil(sweep/maxAngle));
   }
   for(let j=1;j<=intervals;j++){
     const d=traversed+length*j/intervals;
     if(d<metric.totalLengthMm-EPS)distances.push(d);
   }
   traversed+=length;
 }
 if(distances.length<2||distances.length>MAX_LOOPS)return fail('Ungültige Anzahl lokaler Trochoidenschleifen.');
 const segments:SemanticSegment[]=[];let firstApex:P2|null=null,previousApex:P2|null=null,previousCenter:P2|null=null;
 for(const d of distances){
   const station=stationAtLength(metric,d);if(!station)return fail('Lokale Führungsstation fehlt.');
   const radius=localRadius(metric.segments[station.segmentIndex],options.radiusMm,options.freeSide);
   if(options.forwardStepMm>2*radius)return fail('Fortschritt überschreitet den lokalen Schleifendurchmesser.');
   const sign=options.freeSide==='left'?1:-1,normal={x:-station.tangent.y*sign,y:station.tangent.x*sign};
   const shifted=(amount:number):P2=>({x:station.point.x+normal.x*amount,y:station.point.y+normal.y*amount});
   const touch=station.point,center=shifted(radius),apex=shifted(2*radius),ccw=options.loopDirection==='ccw';
   if(previousCenter&&Math.hypot(center.x-previousCenter.x,center.y-previousCenter.y)>effectiveStep+EPS)
     return fail('Lokale Stationsfolge überschreitet den realen Schleifenmittelpunkt-Fortschritt.');
   if(previousApex)segments.push({kind:'line',start:previousApex,end:apex});
   segments.push({kind:'arc',start:apex,end:touch,center,radius,ccw},{kind:'arc',start:touch,end:apex,center,radius,ccw});
   firstApex??=apex;previousApex=apex;previousCenter=center;
 }
 if(firstApex&&previousApex)segments.push({kind:'line',start:previousApex,end:firstApex});
 return{ok:true,segments,loopCount:distances.length,errors:[]};
}

export function buildProtectedTrochoidReference(
 guide:TrochoidalContourGuide,
 options:Omit<StraightTrochoidOptions,'freeSide'>,
 freeSide:'left'|'right',
 uniformRadiusMm:number,
 cutterRadiusMm?:number,
 allowedExposedAngleDeg?:number
):LocalRadiusTrochoidResult{
 const rectangle=guide.source.length===4&&guide.segments.length===8&&guide.side==='outside';
 if(rectangle)return buildLocalRadiusTrochoid(guide,{...options,freeSide},.25,cutterRadiusMm,allowedExposedAngleDeg);
 const reference=buildSemanticTrochoid(guide.segments,{...options,radiusMm:uniformRadiusMm,freeSide});
 return reference.ok?{ok:true,segments:reference.segments,loopCount:reference.loopCount,errors:[]}:fail(reference.errors.join(' '));
}
