import type { CanonicalToolpath } from './canonicalToolpath';

export type CanonicalPreflightResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  runCount:number;
  motionCount:number;
  spatialEntryCount:number;
  summary:string;
};

const finite=(value:number)=>Number.isFinite(value);

export function validateCanonicalToolpath(toolpath:CanonicalToolpath|null|undefined):CanonicalPreflightResult{
  if(!toolpath){
    return{ok:false,errors:['Keine kanonische Werkzeugbahn erzeugt.'],warnings:[],runCount:0,motionCount:0,spatialEntryCount:0,summary:'keine kanonische Werkzeugbahn'};
  }

  const errors:string[]=[];
  const warnings:string[]=[];
  const runCount=toolpath.runs.length;
  const motionCount=toolpath.motions?.length??0;
  const spatialEntryCount=toolpath.runs.reduce((count,run)=>count+(run.entrySegments?.length??0),0);

  if(!(toolpath.tool.diameterMm>0&&finite(toolpath.tool.diameterMm)))errors.push('Kanonische Werkzeugbahn enthält keinen gültigen Werkzeugdurchmesser.');
  if(!runCount&&!motionCount)errors.push('Kanonische Werkzeugbahn enthält keine Maschinenbewegung.');

  for(const [runIndex,run] of toolpath.runs.entries()){
    if(!finite(run.z))errors.push(`Werkzeugbahn ${runIndex+1}: ungültige Z-Höhe.`);
    if(run.points.length<2)errors.push(`Werkzeugbahn ${runIndex+1}: weniger als zwei XY-Punkte.`);
    if(run.points.some(point=>!finite(point.x)||!finite(point.y)))errors.push(`Werkzeugbahn ${runIndex+1}: nicht-endliche XY-Koordinate.`);
    for(const segment of run.entrySegments??[]){
      if(![segment.start.x,segment.start.y,segment.start.z,segment.end.x,segment.end.y,segment.end.z].every(finite))errors.push(`Werkzeugbahn ${runIndex+1}: ungültige räumliche Einstiegsbewegung.`);
    }
  }

  for(const [motionIndex,motion] of (toolpath.motions??[]).entries()){
    if(![motion.start.x,motion.start.y,motion.start.z,motion.end.x,motion.end.y,motion.end.z].every(finite))errors.push(`Maschinenbewegung ${motionIndex+1}: nicht-endliche XYZ-Koordinate.`);
    if(motion.kind==='arc3'&&(!finite(motion.center.x)||!finite(motion.center.y)))errors.push(`Maschinenbewegung ${motionIndex+1}: ungültiges Bogenzentrum.`);
  }

  if(toolpath.operationKind==='drill'&&motionCount===0)errors.push('Bohren/Helix muss als kanonische XYZ-Maschinenbewegung vorliegen.');
  if(toolpath.operationKind!=='drill'&&runCount===0)errors.push(`${toolpath.operationKind}: keine kanonische Schnittbahn vorhanden.`);

  const summary=toolpath.operationKind==='drill'
    ? `${motionCount} kanonische Maschinenbewegung${motionCount===1?'':'en'} · ${toolpath.strategy}`
    : `${runCount} kanonische Werkzeugbahn${runCount===1?'':'en'}${spatialEntryCount?` · ${spatialEntryCount} räumliche Einstiegsbewegung${spatialEntryCount===1?'':'en'}`:''} · ${toolpath.strategy}`;

  return{ok:errors.length===0,errors,warnings,runCount,motionCount,spatialEntryCount,summary};
}
