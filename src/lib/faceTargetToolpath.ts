import type { FaceTargetRoughing } from './faceTargetRoughing';
import type { CanonicalToolpath, CanonicalToolpathRun } from './canonicalToolpath';
import { buildPlanarRasterChains } from './planarRasterKernel';

const EPS=1e-6;

export type FaceTargetMachineOrigin={x:number;y:number;z:number};
export type FaceTargetCanonicalPostOptions={
  safeZMm:number;
  feedMmMin:number;
  plungeMmMin:number;
  spindleRpm:number;
  source?:'face-target'|'model';
};

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

/**
 * Build the face-target roughing path in canonical MACHINE/WCS coordinates.
 *
 * Geometry tests are performed in stock/world XY because the selected BRep face
 * and its holes live there. Only the final canonical runs are translated into
 * WCS coordinates. Z is likewise expressed relative to the active WCS origin.
 *
 * This keeps the preview and future postprocessor on the same geometric truth.
 */
export function buildFaceTargetRasterToolpath(
  target:FaceTargetRoughing,
  toolDiameterMm:number,
  stepoverPercent:number,
  origin:FaceTargetMachineOrigin,
):CanonicalToolpath|null{
  if(!(toolDiameterMm>0)||!(stepoverPercent>0&&stepoverPercent<=100)||!target.levels.length||!target.loops.length)return null;
  const linkedWorldRuns=buildPlanarRasterChains(target.loops,toolDiameterMm,stepoverPercent);
  if(!linkedWorldRuns.length)return null;

  const runs:CanonicalToolpathRun[]=[];
  // True Z-level roughing: clear the complete allowed XY region at one depth
  // before descending to the next level. Retract only between disconnected safe
  // chains; the next depth always starts from safety again.
  for(const worldZ of target.levels){
    const machineZ=worldZ-origin.z;
    for(const linkedRun of linkedWorldRuns){
      runs.push({
        kind:'cut',
        z:machineZ,
        points:linkedRun.points.map(point=>({x:point.x-origin.x,y:point.y-origin.y})),
        retractAfter:true,
      });
    }
  }

  return{
    version:1,
    operationKind:'z-level-roughing',
    strategy:'raster',
    tool:{diameterMm:toolDiameterMm},
    stepoverPercent,
    runs,
  };
}

export function postFaceTargetCanonicalToolpath(
  toolpath:CanonicalToolpath,
  options:FaceTargetCanonicalPostOptions,
):string{
  if(toolpath.operationKind!=='z-level-roughing')throw new Error('Canonical toolpath is not a face-target Z-level roughing toolpath.');
  if(!toolpath.runs.length)throw new Error('Canonical face-target toolpath contains no cutting runs.');
  if(!(options.safeZMm>0&&options.feedMmMin>0&&options.plungeMmMin>0&&options.spindleRpm>0))throw new Error('Face-target post parameters are incomplete.');

  const source=options.source??'face-target';
  const lines:string[]=[
    '( BeBlog CAM 003C3 )',
    source==='model'?'( Operation: Model-based Z-Level Roughing · canonical toolpath )':'( Operation: Face-Target Z-Level Roughing · canonical toolpath )',
    source==='model'?'( Stock - Model = Bearbeitungsbereich je Z-Ebene )':'( Gewählte BRep-Zielfläche = Bearbeitungsbereich + Zielhöhe )',
    '( Sichtbare Werkzeugbahn und Maschinenbahn verwenden dieselbe kanonische Geometrie )',
    'G21','G90','G17',
    `S${Math.round(options.spindleRpm)} M3`,
    `G0 Z${f3(options.safeZMm)}`,
  ];

  let lastZ:number|null=null;
  toolpath.runs.forEach((run,index)=>{
    if(run.points.length<2)return;
    const start=run.points[0];
    if(lastZ===null||Math.abs(lastZ-run.z)>1e-9){
      lines.push(`( Z-Level ${f3(run.z)} )`);
      lastZ=run.z;
    }
    lines.push(`( Schnittkette ${index+1}/${toolpath.runs.length} )`);
    lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
    lines.push(`G1 Z${f3(run.z)} F${Math.round(options.plungeMmMin)}`);
    for(let i=1;i<run.points.length;i++){
      const point=run.points[i];
      lines.push(`G1 X${f3(point.x)} Y${f3(point.y)} F${Math.round(options.feedMmMin)}`);
    }
    lines.push(`G0 Z${f3(options.safeZMm)}`);
  });

  lines.push('M5','M30');
  return lines.join('\n')+'\n';
}
