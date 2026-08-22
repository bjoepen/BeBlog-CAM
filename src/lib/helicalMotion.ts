export type HelicalDescentResult={ok:boolean;error?:string;lines:string[];turns:number;};

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

export function pocketHelixRadiusMm(maxCenterRadiusMm:number,toolDiameterMm:number):number{
  if(!(maxCenterRadiusMm>0)||!(toolDiameterMm>0))return 0;
  return Math.min(maxCenterRadiusMm,toolDiameterMm/4);
}

export function buildHelicalDescent(args:{centerX:number;centerY:number;radiusMm:number;startDepthMm:number;targetDepthMm:number;pitchMm:number;feedMmMin:number}):HelicalDescentResult{
  const {centerX,centerY,radiusMm,startDepthMm,targetDepthMm,pitchMm,feedMmMin}=args;
  if(!(radiusMm>0))return{ok:false,error:'Helixradius muss größer als 0 sein.',lines:[],turns:0};
  if(!(pitchMm>0))return{ok:false,error:'Helix-Zustellung pro Umdrehung muss größer als 0 sein.',lines:[],turns:0};
  if(!(targetDepthMm>startDepthMm))return{ok:false,error:'Helix-Zieltiefe muss unterhalb der Starttiefe liegen.',lines:[],turns:0};
  if(!(feedMmMin>0))return{ok:false,error:'Helixvorschub muss größer als 0 sein.',lines:[],turns:0};
  const rightX=centerX+radiusMm,leftX=centerX-radiusMm,lines:string[]=[];
  let depth=startDepthMm,turns=0;
  while(depth<targetDepthMm-1e-9){
    turns++;
    const nextDepth=Math.min(targetDepthMm,depth+pitchMm);
    const halfDepth=depth+(nextDepth-depth)/2;
    lines.push(`G3 X${f3(leftX)} Y${f3(centerY)} Z${f3(-halfDepth)} I${f3(-radiusMm)} J0.000 F${Math.round(feedMmMin)}`);
    lines.push(`G3 X${f3(rightX)} Y${f3(centerY)} Z${f3(-nextDepth)} I${f3(radiusMm)} J0.000 F${Math.round(feedMmMin)}`);
    depth=nextDepth;
  }
  return{ok:true,lines,turns};
}
