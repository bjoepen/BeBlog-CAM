import type { CanonicalToolpath, ToolpathPoint2 } from './canonicalToolpath';
import type { ToolAssemblyGeometry } from './toolAssemblyCollision';

export type FixtureVolume={
  id:string;
  name:string;
  enabled:boolean;
  minX:number;
  maxX:number;
  minY:number;
  maxY:number;
  bottomZ:number;
  topZ:number;
};

export type FixtureCollisionKind='cutter'|'shank'|'holder';
export type FixtureCollisionHit={fixtureId:string;fixtureName:string;kind:FixtureCollisionKind;runIndex:number;segmentIndex:number;z:number};
export type FixtureCollisionResult={ok:boolean;errors:string[];warnings:string[];checkedFixtures:number;checkedSegments:number;hits:FixtureCollisionHit[]};

const intersectsZ=(a0:number,a1:number,b0:number,b1:number)=>Math.max(Math.min(a0,a1),Math.min(b0,b1))<=Math.min(Math.max(a0,a1),Math.max(b0,b1))+1e-9;

function segmentIntersectsInflatedRect(a:ToolpathPoint2,b:ToolpathPoint2,fixture:FixtureVolume,radius:number):boolean{
  const minX=fixture.minX-radius,maxX=fixture.maxX+radius,minY=fixture.minY-radius,maxY=fixture.maxY+radius;
  const dx=b.x-a.x,dy=b.y-a.y;
  let t0=0,t1=1;
  const clip=(p:number,q:number)=>{if(Math.abs(p)<1e-12)return q>=0;const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}return true;};
  return clip(-dx,a.x-minX)&&clip(dx,maxX-a.x)&&clip(-dy,a.y-minY)&&clip(dy,maxY-a.y)&&t0<=t1;
}

export function validateToolAssemblyAgainstFixtures(args:{toolpath:CanonicalToolpath;assembly:ToolAssemblyGeometry;fixtures:FixtureVolume[]}):FixtureCollisionResult{
  const {toolpath,assembly}=args,errors:string[]=[],warnings:string[]=[],hits:FixtureCollisionHit[]=[];
  const fixtures=args.fixtures.filter(f=>f.enabled!==false),toolRadius=toolpath.tool.diameterMm/2,shankRadius=assembly.shankDiameterMm/2,holderRadius=assembly.holderDiameterMm/2;
  for(const fixture of fixtures){
    if(!(Number.isFinite(fixture.minX)&&Number.isFinite(fixture.maxX)&&Number.isFinite(fixture.minY)&&Number.isFinite(fixture.maxY)&&Number.isFinite(fixture.bottomZ)&&Number.isFinite(fixture.topZ))){errors.push(`Spannmittel ${fixture.name} enthält ungültige Geometriewerte.`);continue;}
    if(!(fixture.maxX>fixture.minX&&fixture.maxY>fixture.minY&&fixture.topZ>fixture.bottomZ)){errors.push(`Spannmittel ${fixture.name} benötigt positive X/Y/Z-Ausdehnung.`);}
  }
  if(errors.length)return{ok:false,errors,warnings,checkedFixtures:fixtures.length,checkedSegments:0,hits};
  let checkedSegments=0;
  toolpath.runs.forEach((run,runIndex)=>{
    if(!run.points.length)return;
    const pairs=run.points.length===1?[[run.points[0],run.points[0]] as const]:run.points.slice(1).map((p,i)=>[run.points[i],p] as const);
    pairs.forEach(([a,b],segmentIndex)=>{
      checkedSegments++;
      const tipZ=run.z,holderNoseZ=tipZ+assembly.stickoutMm,cuttingTopZ=Math.min(holderNoseZ,tipZ+assembly.cuttingLengthMm),shankBottomZ=cuttingTopZ;
      for(const fixture of fixtures){
        if(intersectsZ(tipZ,cuttingTopZ,fixture.bottomZ,fixture.topZ)&&segmentIntersectsInflatedRect(a,b,fixture,toolRadius))hits.push({fixtureId:fixture.id,fixtureName:fixture.name,kind:'cutter',runIndex,segmentIndex,z:tipZ});
        else if(holderNoseZ>shankBottomZ&&intersectsZ(shankBottomZ,holderNoseZ,fixture.bottomZ,fixture.topZ)&&segmentIntersectsInflatedRect(a,b,fixture,shankRadius))hits.push({fixtureId:fixture.id,fixtureName:fixture.name,kind:'shank',runIndex,segmentIndex,z:tipZ});
        else if(fixture.topZ>=holderNoseZ-1e-9&&segmentIntersectsInflatedRect(a,b,fixture,holderRadius))hits.push({fixtureId:fixture.id,fixtureName:fixture.name,kind:'holder',runIndex,segmentIndex,z:tipZ});
      }
    });
  });
  const uniqueKinds=[...new Set(hits.map(h=>`${h.fixtureId}:${h.kind}`))];
  for(const key of uniqueKinds){const [fixtureId,kind]=key.split(':') as [string,FixtureCollisionKind],fixture=fixtures.find(f=>f.id===fixtureId);if(fixture)errors.push(`Spannmittelkollision: ${fixture.name} wird von ${kind==='cutter'?'Fräser':kind==='shank'?'Schaft':'Halter'} geschnitten.`);}
  if(!fixtures.length)warnings.push('Keine aktiven Spannmittel für 004R definiert.');
  return{ok:errors.length===0,errors,warnings,checkedFixtures:fixtures.length,checkedSegments,hits};
}
