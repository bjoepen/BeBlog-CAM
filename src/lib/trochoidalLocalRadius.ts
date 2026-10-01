import type { P2, SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import { measureSemanticGuide, stationAtLength } from './trochoidalSemanticMath';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';

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

/** E7 rectangle production geometry: requested radius on straights, reduced only
 * at stations whose native guide arc bends toward the free side. */
export function buildLocalRadiusTrochoid(
 guide:TrochoidalContourGuide,
 options:Omit<StraightTrochoidOptions,'freeSide'> & {freeSide:'left'|'right'},
 minimumRadiusMm=.25
):LocalRadiusTrochoidResult{
 const measured=measureSemanticGuide(guide.segments);
 if(!measured.ok||!measured.metric.closed)return fail(measured.ok?'Lokale Trochoide benötigt eine geschlossene Führung.':measured.errors[0]);
 if(!Number.isFinite(options.radiusMm)||options.radiusMm<=0||!Number.isFinite(options.forwardStepMm)||options.forwardStepMm<=0)
   return fail('Radius und Fortschritt müssen endlich und positiv sein.');
 const metric=measured.metric,intervals=Math.ceil(metric.totalLengthMm/options.forwardStepMm),loopCount=intervals;
 if(loopCount<2||loopCount>MAX_LOOPS)return fail('Ungültige Anzahl lokaler Trochoidenschleifen.');
 const segments:SemanticSegment[]=[];let firstApex:P2|null=null,previousApex:P2|null=null;
 for(let i=0;i<loopCount;i++){
   const station=stationAtLength(metric,i*options.forwardStepMm);if(!station)return fail('Lokale Führungsstation fehlt.');
   const radius=localRadius(metric.segments[station.segmentIndex],options.radiusMm,options.freeSide);
   if(radius<minimumRadiusMm)return fail('Lokaler Trochoidenradius unterschreitet den Mindestradius.');
   if(options.forwardStepMm>2*radius)return fail('Fortschritt überschreitet den lokalen Schleifendurchmesser.');
   const sign=options.freeSide==='left'?1:-1,normal={x:-station.tangent.y*sign,y:station.tangent.x*sign};
   const shifted=(amount:number):P2=>({x:station.point.x+normal.x*amount,y:station.point.y+normal.y*amount});
   const touch=station.point,center=shifted(radius),apex=shifted(2*radius),ccw=options.loopDirection==='ccw';
   if(previousApex)segments.push({kind:'line',start:previousApex,end:apex});
   segments.push({kind:'arc',start:apex,end:touch,center,radius,ccw},{kind:'arc',start:touch,end:apex,center,radius,ccw});
   firstApex??=apex;previousApex=apex;
 }
 if(firstApex&&previousApex)segments.push({kind:'line',start:previousApex,end:firstApex});
 return{ok:true,segments,loopCount,errors:[]};
}
