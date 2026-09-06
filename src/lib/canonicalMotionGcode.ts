import type { CanonicalMachineMotion } from './canonicalToolpath';
import type { CamOperation } from './types';

const f3=(n:number)=>Math.abs(n)<0.0005?'0.000':n.toFixed(3);
const same=(a:number,b:number)=>Math.abs(a-b)<1e-9;

export function postCanonicalMachineMotions(args:{motions:CanonicalMachineMotion[];operation:CamOperation}):string[]{
  const {motions,operation}=args;
  const lines:string[]=[];
  for(const motion of motions){
    if(motion.kind==='rapid3'){
      lines.push(`G0 X${f3(motion.end.x)} Y${f3(motion.end.y)} Z${f3(motion.end.z)}`);
      continue;
    }
    const zChanges=!same(motion.start.z,motion.end.z);
    const feed=motion.feedMmMin??(zChanges?operation.plungeMmMin:operation.feedMmMin);
    if(motion.kind==='line3'){
      lines.push(`G1 X${f3(motion.end.x)} Y${f3(motion.end.y)} Z${f3(motion.end.z)} F${f3(feed)}`);
      continue;
    }
    const i=motion.center.x-motion.start.x,j=motion.center.y-motion.start.y;
    lines.push(`${motion.ccw?'G3':'G2'} X${f3(motion.end.x)} Y${f3(motion.end.y)} Z${f3(motion.end.z)} I${f3(i)} J${f3(j)} F${f3(feed)}`);
  }
  return lines;
}
