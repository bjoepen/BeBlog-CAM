const EPS=1e-9;

/** Maximum translation of equal-radius cleared loop disks that keeps the
 * cutter circumference exposure at or below the requested angular limit.
 * S = loopRadius + cutterRadius is the disk credited after a completed loop.
 * The next cutter centre can reach loopRadius beyond the next loop centre. */
export function maximumLoopCentreAdvanceMm(
  loopRadiusMm:number,cutterRadiusMm:number,allowedExposedAngleDeg:number
):number|null{
  if(![loopRadiusMm,cutterRadiusMm,allowedExposedAngleDeg].every(Number.isFinite)
    ||loopRadiusMm<=0||cutterRadiusMm<=0||allowedExposedAngleDeg<=0||allowedExposedAngleDeg>=180)return null;
  const clearedRadius=loopRadiusMm+cutterRadiusMm;
  const theta=allowedExposedAngleDeg*Math.PI/360;
  // From d² + r² + 2dr cos(theta) = S², solve the positive root for d,
  // then reserve loopRadius for the farthest cutter centre on the next loop.
  const c=Math.cos(theta),r=cutterRadiusMm,S=clearedRadius;
  const d=-r*c+Math.sqrt(Math.max(0,S*S-r*r*(1-c*c)));
  const advance=d-loopRadiusMm;
  return Number.isFinite(advance)&&advance>EPS?advance:null;
}
