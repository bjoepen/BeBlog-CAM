export type DxfPreviewMode='edit-top'|'drill-25d'|'job-top';

export type DxfPreviewPoint={x:number;y:number;z?:number};
export type DxfPreviewPivot={x:number;y:number};

export type DxfPreviewCamera={
  yawDeg:number;
  tiltDeg:number;
};

/**
 * Canonical DXF preview projection.
 *
 * Invariants:
 * - edit-top and job-top are strict XY orthographic projections.
 * - z never affects screen position in top views.
 * - only drill-25d is allowed to map z into the screen plane.
 */
export function projectDxfPreviewPoint(
  point:DxfPreviewPoint,
  mode:DxfPreviewMode,
  pivot:DxfPreviewPivot,
  camera:DxfPreviewCamera,
){
  if(mode!=='drill-25d')return{x:point.x,y:point.y};

  const yaw=camera.yawDeg*Math.PI/180;
  const tilt=camera.tiltDeg*Math.PI/180;
  const dx=point.x-pivot.x;
  const dy=point.y-pivot.y;
  const z=point.z??0;

  const xr=dx*Math.cos(yaw)-dy*Math.sin(yaw);
  const yr=dx*Math.sin(yaw)+dy*Math.cos(yaw);

  return{
    x:pivot.x+xr,
    y:pivot.y+yr*Math.cos(tilt)+z*Math.sin(tilt),
  };
}
