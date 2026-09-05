import type { CanonicalSpatialSegment } from './canonicalToolpath';

export type HelicalDescentResult={ok:boolean;error?:string;lines:string[];turns:number;};
export type CanonicalHelixResult={ok:boolean;error?:string;segments:CanonicalSpatialSegment[];turns:number;};

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

export function pocketHelixRadiusMm(maxCenterRadiusMm:number,toolDiameterMm:number):number{
  if(!(maxCenterRadiusMm>0)||!(toolDiameterMm>0))return 0;
  return Math.min(maxCenterRadiusMm,toolDiameterMm/4);
}

export function buildCanonicalHelicalDescent(args:{centerX:number;centerY:number;radiusMm:number;startZ:number;targetZ:number;pitchMm:number;feedMmMin:number}):CanonicalHelixResult{
  const {centerX,centerY,radiusMm,startZ,targetZ,pitchMm,feedMmMin}=args;
  if(!(radiusMm>0))return{ok:false,error:'Helixradius muss größer als 0 sein.',segments:[],turns:0};
  if(!(pitchMm>0))return{ok:false,error:'Helix-Zustellung pro Umdrehung muss größer als 0 sein.',segments:[],turns:0};
  if(!(targetZ<startZ))return{ok:false,error:'Helix-Zieltiefe muss unterhalb der Starttiefe liegen.',segments:[],turns:0};
  if(!(feedMmMin>0))return{ok:false,error:'Helixvorschub muss größer als 0 sein.',segments:[],turns:0};

  const rightX=centerX+radiusMm,leftX=centerX-radiusMm;
  const segments:CanonicalSpatialSegment[]=[];
  let z=startZ,turns=0;
  while(z>targetZ+1e-9){
    turns++;
    const nextZ=Math.max(targetZ,z-pitchMm);
    const halfZ=z-(z-nextZ)/2;
    segments.push({kind:'arc3',start:{x:rightX,y:centerY,z},end:{x:leftX,y:centerY,z:halfZ},center:{x:centerX,y:centerY},ccw:true,feedMmMin});
    segments.push({kind:'arc3',start:{x:leftX,y:centerY,z:halfZ},end:{x:rightX,y:centerY,z:nextZ},center:{x:centerX,y:centerY},ccw:true,feedMmMin});
    z=nextZ;
  }
  return{ok:true,segments,turns};
}

export function buildHelicalDescent(args:{centerX:number;centerY:number;radiusMm:number;startDepthMm:number;targetDepthMm:number;pitchMm:number;feedMmMin:number}):HelicalDescentResult{
  const {centerX,centerY,radiusMm,startDepthMm,targetDepthMm,pitchMm,feedMmMin}=args;
  const canonical=buildCanonicalHelicalDescent({centerX,centerY,radiusMm,startZ:-startDepthMm,targetZ:-targetDepthMm,pitchMm,feedMmMin});
  if(!canonical.ok)return{ok:false,error:canonical.error,lines:[],turns:0};
  const lines=canonical.segments.map(segment=>{
    if(segment.kind!=='arc3')throw new Error('Helixprimitive enthält unerwartetes Segment.');
    const i=segment.center.x-segment.start.x,j=segment.center.y-segment.start.y;
    return `G3 X${f3(segment.end.x)} Y${f3(segment.end.y)} Z${f3(segment.end.z)} I${f3(i)} J${f3(j)} F${Math.round(segment.feedMmMin??feedMmMin)}`;
  });
  return{ok:true,lines,turns:canonical.turns};
}
