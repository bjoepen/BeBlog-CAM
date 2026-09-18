import type { PartOrientation } from './types';

export type OrientationPoint3={x:number;y:number;z:number};
export type OrientationTuple3=[number,number,number];

const radians=(degrees:number)=>degrees*Math.PI/180;

/**
 * 008D Orientation Truth.
 *
 * Applies intrinsic model rotations in the fixed order X -> Y -> Z.
 * This function performs rotation only: no placement, WCS translation,
 * stock alignment or CAM semantics belong here.
 */
export function orientPoint3<T extends OrientationPoint3>(point:T,orientation:PartOrientation):T{
  const ax=radians(orientation.rotationXDeg),ay=radians(orientation.rotationYDeg),az=radians(orientation.rotationZDeg);
  const cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay),cz=Math.cos(az),sz=Math.sin(az);

  const x1=point.x;
  const y1=point.y*cx-point.z*sx;
  const z1=point.y*sx+point.z*cx;

  const x2=x1*cy+z1*sy;
  const y2=y1;
  const z2=-x1*sy+z1*cy;

  const x3=x2*cz-y2*sz;
  const y3=x2*sz+y2*cz;

  return{...point,x:x3,y:y3,z:z2};
}

/** Direction vectors use the same rotation as points, without translation. */
export function orientDirection3(direction:OrientationTuple3,orientation:PartOrientation):OrientationTuple3{
  const p=orientPoint3({x:direction[0],y:direction[1],z:direction[2]},orientation);
  return[p.x,p.y,p.z];
}

export function orientTuple3(point:OrientationTuple3,orientation:PartOrientation):OrientationTuple3{
  const p=orientPoint3({x:point[0],y:point[1],z:point[2]},orientation);
  return[p.x,p.y,p.z];
}
