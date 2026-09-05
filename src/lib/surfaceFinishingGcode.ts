import type { CanonicalToolpath } from './canonicalToolpath';
import type { SurfaceFinishingOperation } from './types';

export type SurfaceFinishingGcodeResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  code:string;
};

const f3=(value:number)=>Math.abs(value)<.0005?'0.000':value.toFixed(3);

export function postSurfaceFinishingCanonicalToolpath(
  toolpath:CanonicalToolpath,
  operation:SurfaceFinishingOperation,
):SurfaceFinishingGcodeResult{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(toolpath.operationKind!=='surface-finishing')errors.push('Kanonischer Werkzeugweg ist kein 3D-Schlichtpfad.');
  if(toolpath.strategy!=='parallel-surface')errors.push('3D-Schlichten erwartet die Strategie parallel-surface.');
  if(operation.tool.kind!=='ball-nose')errors.push('3D Schlichten erlaubt ausschließlich Vollradiusfräser.');

  const motions=toolpath.motions??[];
  if(!motions.length)errors.push('3D-Schlichtpfad enthält keine XYZ-Maschinenbewegungen.');
  if(errors.length)return{ok:false,errors,warnings,code:''};

  const first=motions[0];
  const lines:string[]=[
    '( BeBlog CAM · 3D Schlichten )',
    '( Kanonischer XYZ-Werkzeugweg · Vollradiusfräser )',
    'G21',
    'G90',
    'G17',
    `S${Math.round(operation.spindleRpm)} M3`,
    `G0 Z${f3(operation.safeZMm)}`,
    `G0 X${f3(first.start.x)} Y${f3(first.start.y)}`,
  ];

  let lastFeed:number|null=null;

  for(const motion of motions){
    if(motion.kind==='rapid3'){
      lines.push(`G0 X${f3(motion.end.x)} Y${f3(motion.end.y)} Z${f3(motion.end.z)}`);
      continue;
    }

    const feed=motion.feedMmMin??operation.feedMmMin;
    const feedSuffix=lastFeed===feed?'':` F${Math.round(feed)}`;
    lastFeed=feed;

    if(motion.kind==='line3'){
      lines.push(`G1 X${f3(motion.end.x)} Y${f3(motion.end.y)} Z${f3(motion.end.z)}${feedSuffix}`);
      continue;
    }

    errors.push('3D Schlichten unterstützt in 003D4 nur line3/rapid3; arc3 ist nicht freigegeben.');
  }

  if(errors.length)return{ok:false,errors,warnings,code:''};

  lines.push(`G0 Z${f3(operation.safeZMm)}`,'M5','M30');
  return{ok:true,errors:[],warnings,code:lines.join('\n')+'\n'};
}
