export interface FeedsSpeedsInput {
  toolDiameterMm:number;
  cuttingSpeedMMin:number;
  flutes:number;
  chipLoadMm:number;
}

export interface FeedsSpeedsResult {
  spindleRpm:number;
  feedMmMin:number;
}

/**
 * Derselbe mathematische Kern wie im BeBlog Maker Tools Rechner:
 * n = (vc × 1000) / (π × d)
 * vf = n × z × fz
 *
 * Bewusst ohne Materialdatenbank oder versteckte Korrekturfaktoren.
 */
export function calculateFeedsSpeeds(input:FeedsSpeedsInput):FeedsSpeedsResult {
  const {toolDiameterMm:d,cuttingSpeedMMin:vc,flutes:z,chipLoadMm:fz}=input;
  if(![d,vc,z,fz].every(Number.isFinite)||d<=0||vc<=0||z<=0||fz<=0){
    throw new RangeError('Alle Eingaben müssen größer als 0 sein.');
  }
  const spindleRpm=(vc*1000)/(Math.PI*d);
  const feedMmMin=spindleRpm*z*fz;
  return{spindleRpm,feedMmMin};
}
