import type { CanonicalMachineMotion, CanonicalToolpath, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { FixtureVolume } from './fixtureCollision';

export type SpindleHeadGeometry={
  spindleNoseDiameterMm:number;
  spindleNoseBottomOffsetMm:number;
  spindleNoseLengthMm:number;
  carriageEnabled:boolean;
  carriageWidthMm:number;
  carriageDepthMm:number;
  carriageBottomOffsetMm:number;
  carriageHeightMm:number;
};

export type SpindleHeadCollisionKind='spindle-nose'|'z-carriage';
export type SpindleHeadCollisionHit={fixtureId:string;fixtureName:string;kind:SpindleHeadCollisionKind;motionIndex:number};
export type SpindleHeadCollisionResult={ok:boolean;errors:string[];warnings:string[];checkedFixtures:number;checkedMotions:number;hits:SpindleHeadCollisionHit[]};

const finite=(n:number)=>Number.isFinite(n);
const intersectsZ=(a0:number,a1:number,b0:number,b1:number)=>Math.max(Math.min(a0,a1),Math.min(b0,b1))<=Math.min(Math.max(a0,a1),Math.max(b0,b1))+1e-9;

function segmentIntersectsInflatedRect(a:ToolpathPoint2,b:ToolpathPoint2,fixture:FixtureVolume,inflateX:number,inflateY:number):boolean{
  const minX=fixture.minX-inflateX,maxX=fixture.maxX+inflateX,minY=fixture.minY-inflateY,maxY=fixture.maxY+inflateY;
  const dx=b.x-a.x,dy=b.y-a.y;let t0=0,t1=1;
  const clip=(p:number,q:number)=>{if(Math.abs(p)<1e-12)return q>=0;const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}return true;};
  return clip(-dx,a.x-minX)&&clip(dx,maxX-a.x)&&clip(-dy,a.y-minY)&&clip(dy,maxY-a.y)&&t0<=t1;
}

function motionsFromToolpath(toolpath:CanonicalToolpath):CanonicalMachineMotion[]{
  if(toolpath.motions?.length)return toolpath.motions;
  const motions:CanonicalMachineMotion[]=[];
  for(const run of toolpath.runs){
    if(run.points.length<2)continue;
    for(let i=1;i<run.points.length;i++)motions.push({kind:'line3',start:{...run.points[i-1],z:run.z},end:{...run.points[i],z:run.z}});
  }
  return motions;
}

function tipZRange(motion:CanonicalMachineMotion):[number,number]{return[Math.min(motion.start.z,motion.end.z),Math.max(motion.start.z,motion.end.z)];}

export function validateSpindleHeadGeometry(head:SpindleHeadGeometry):string[]{
  const errors:string[]=[];
  if(!(finite(head.spindleNoseDiameterMm)&&head.spindleNoseDiameterMm>0))errors.push('Spindelnasen-Durchmesser muss positiv sein.');
  if(!(finite(head.spindleNoseBottomOffsetMm)&&head.spindleNoseBottomOffsetMm>=0))errors.push('Abstand Werkzeugspitze → Spindelnase muss endlich und nicht negativ sein.');
  if(!(finite(head.spindleNoseLengthMm)&&head.spindleNoseLengthMm>0))errors.push('Spindelnasen-Länge muss positiv sein.');
  if(head.carriageEnabled){
    if(!(finite(head.carriageWidthMm)&&head.carriageWidthMm>0&&finite(head.carriageDepthMm)&&head.carriageDepthMm>0))errors.push('Z-Schlitten benötigt positive Breite und Tiefe.');
    if(!(finite(head.carriageBottomOffsetMm)&&head.carriageBottomOffsetMm>=0&&finite(head.carriageHeightMm)&&head.carriageHeightMm>0))errors.push('Z-Schlitten benötigt einen gültigen unteren Abstand und positive Höhe.');
  }
  return errors;
}

export function validateSpindleHeadAgainstFixtures(args:{toolpath:CanonicalToolpath;head:SpindleHeadGeometry;fixtures:FixtureVolume[]}):SpindleHeadCollisionResult{
  const {toolpath,head}=args,fixtures=args.fixtures.filter(f=>f.enabled!==false),errors=validateSpindleHeadGeometry(head),warnings:string[]=[],hits:SpindleHeadCollisionHit[]=[];
  for(const fixture of fixtures){
    if(!(finite(fixture.minX)&&finite(fixture.maxX)&&finite(fixture.minY)&&finite(fixture.maxY)&&finite(fixture.bottomZ)&&finite(fixture.topZ))||!(fixture.maxX>fixture.minX&&fixture.maxY>fixture.minY&&fixture.topZ>fixture.bottomZ))errors.push(`Spannmittel ${fixture.name} besitzt keine gültige 2.5D-Geometrie.`);
  }
  if(errors.length)return{ok:false,errors:[...new Set(errors)],warnings,checkedFixtures:fixtures.length,checkedMotions:0,hits};
  const motions=motionsFromToolpath(toolpath),noseRadius=head.spindleNoseDiameterMm/2;
  motions.forEach((motion,motionIndex)=>{
    const [tipMinZ,tipMaxZ]=tipZRange(motion),a={x:motion.start.x,y:motion.start.y},b={x:motion.end.x,y:motion.end.y};
    const noseBottomMin=tipMinZ+head.spindleNoseBottomOffsetMm,noseTopMax=tipMaxZ+head.spindleNoseBottomOffsetMm+head.spindleNoseLengthMm;
    const carriageBottomMin=tipMinZ+head.carriageBottomOffsetMm,carriageTopMax=tipMaxZ+head.carriageBottomOffsetMm+head.carriageHeightMm;
    for(const fixture of fixtures){
      if(intersectsZ(noseBottomMin,noseTopMax,fixture.bottomZ,fixture.topZ)&&segmentIntersectsInflatedRect(a,b,fixture,noseRadius,noseRadius))hits.push({fixtureId:fixture.id,fixtureName:fixture.name,kind:'spindle-nose',motionIndex});
      if(head.carriageEnabled&&intersectsZ(carriageBottomMin,carriageTopMax,fixture.bottomZ,fixture.topZ)&&segmentIntersectsInflatedRect(a,b,fixture,head.carriageWidthMm/2,head.carriageDepthMm/2))hits.push({fixtureId:fixture.id,fixtureName:fixture.name,kind:'z-carriage',motionIndex});
    }
  });
  const unique=[...new Set(hits.map(hit=>`${hit.fixtureId}:${hit.kind}`))];
  for(const key of unique){const [fixtureId,kind]=key.split(':') as [string,SpindleHeadCollisionKind],fixture=fixtures.find(item=>item.id===fixtureId);if(fixture)errors.push(`004U Kollision: ${fixture.name} wird von ${kind==='spindle-nose'?'Spindelnase/Spannzange':'Z-Schlitten-Hüllkörper'} getroffen.`);}
  if(!fixtures.length)warnings.push('Keine aktiven Spannmittel für die 004U-Spindelkopfprüfung definiert.');
  if(!motions.length)warnings.push('004U konnte keine kanonischen Maschinenbewegungen prüfen.');
  return{ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],checkedFixtures:fixtures.length,checkedMotions:motions.length,hits};
}
