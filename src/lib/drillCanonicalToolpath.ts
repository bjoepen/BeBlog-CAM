import type { CanonicalSpatialSegment, CanonicalToolpath, ToolpathPoint3 } from './canonicalToolpath';
import { generateDrillGcode, type DrillGcodeResult } from './drillGcode';
import type { DrillOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

type DrillArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:DrillOperation};
export type DrillCanonicalPostOptions={spindleRpm:number};
type State=ToolpathPoint3;

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const numberWord=(line:string,letter:string):number|null=>{
  const match=line.match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`,'i'));
  if(!match)return null;
  const value=Number(match[1]);
  return Number.isFinite(value)?value:null;
};

export function canonicalDrillToolpathFromGcode(code:string,operation:DrillOperation):CanonicalToolpath|null{
  const state:State={x:0,y:0,z:0};
  const motions:CanonicalSpatialSegment[]=[];

  for(const raw of code.split(/\r?\n/)){
    const line=raw.replace(/\([^)]*\)/g,'').trim();
    if(!line)continue;
    const command=line.match(/\b(G0|G1|G2|G3)\b/i)?.[1]?.toUpperCase();
    if(!command)continue;
    const next={...state};
    const x=numberWord(line,'X'),y=numberWord(line,'Y'),z=numberWord(line,'Z'),feed=numberWord(line,'F');
    if(x!==null)next.x=x;if(y!==null)next.y=y;if(z!==null)next.z=z;
    const start={...state},end={...next};
    if(command==='G0')motions.push({kind:'rapid3',start,end});
    else if(command==='G1')motions.push({kind:'line3',start,end,feedMmMin:feed??undefined});
    else{
      const i=numberWord(line,'I')??0,j=numberWord(line,'J')??0;
      motions.push({kind:'arc3',start,end,center:{x:start.x+i,y:start.y+j},ccw:command==='G3',feedMmMin:feed??undefined});
    }
    Object.assign(state,next);
  }
  if(!motions.length)return null;
  return{
    version:1,
    operationKind:'drill',
    strategy:operation.method==='helical-mill'?'helical-bore':'drill',
    tool:{diameterMm:operation.tool.diameterMm},
    stepoverPercent:0,
    runs:[],
    motions,
  };
}

export function buildDrillCanonicalToolpath(args:DrillArgs):CanonicalToolpath|null{
  const result=generateDrillGcode(args);
  if(!result.ok)return null;
  return canonicalDrillToolpathFromGcode(result.code,args.operation);
}

export function postDrillCanonicalToolpath(toolpath:CanonicalToolpath,options:DrillCanonicalPostOptions):string{
  if(toolpath.operationKind!=='drill')throw new Error('Canonical toolpath is not a drill toolpath.');
  const motions=toolpath.motions??[];
  if(!motions.length)throw new Error('Canonical drill toolpath contains no machine motions.');
  const lines:string[]=[
    '( BeBlog CAM 001Z-A )',
    `( Operation: Bohren · ${toolpath.strategy==='helical-bore'?'Helixfräsen':'Axial bohren'} · canonical toolpath )`,
    '( Sichtbare Werkzeugbahn und Maschinenbahn verwenden dieselbe kanonische Bewegungsgeometrie )',
    'G21','G90','G17',`S${Math.round(options.spindleRpm)} M3`,
  ];
  for(const motion of motions){
    if(motion.kind==='rapid3'){
      const parts=['G0'];
      if(motion.end.x!==motion.start.x)parts.push(`X${f3(motion.end.x)}`);
      if(motion.end.y!==motion.start.y)parts.push(`Y${f3(motion.end.y)}`);
      if(motion.end.z!==motion.start.z)parts.push(`Z${f3(motion.end.z)}`);
      if(parts.length>1)lines.push(parts.join(' '));
      continue;
    }
    if(motion.kind==='line3'){
      const parts=['G1'];
      if(motion.end.x!==motion.start.x)parts.push(`X${f3(motion.end.x)}`);
      if(motion.end.y!==motion.start.y)parts.push(`Y${f3(motion.end.y)}`);
      if(motion.end.z!==motion.start.z)parts.push(`Z${f3(motion.end.z)}`);
      if(motion.feedMmMin!==undefined)parts.push(`F${Math.round(motion.feedMmMin)}`);
      if(parts.length>1)lines.push(parts.join(' '));
      continue;
    }
    const code=motion.ccw?'G3':'G2';
    const i=motion.center.x-motion.start.x,j=motion.center.y-motion.start.y;
    const parts=[code,`X${f3(motion.end.x)}`,`Y${f3(motion.end.y)}`];
    if(motion.end.z!==motion.start.z)parts.push(`Z${f3(motion.end.z)}`);
    parts.push(`I${f3(i)}`,`J${f3(j)}`);
    if(motion.feedMmMin!==undefined)parts.push(`F${Math.round(motion.feedMmMin)}`);
    lines.push(parts.join(' '));
  }
  lines.push('M5','M30');
  return lines.join('\n')+'\n';
}

export function generateCanonicalDrillGcode(args:DrillArgs):DrillGcodeResult{
  const legacy=generateDrillGcode(args);
  if(!legacy.ok)return legacy;
  const toolpath=canonicalDrillToolpathFromGcode(legacy.code,args.operation);
  if(!toolpath)return{...legacy,ok:false,errors:['Kanonische Bohr-/Helixbahn konnte nicht aus der geprüften Bewegungsgeometrie erzeugt werden.'],code:'',lineCount:0};
  try{
    const code=postDrillCanonicalToolpath(toolpath,{spindleRpm:args.operation.spindleRpm});
    return{...legacy,code,lineCount:code.trimEnd().split(/\r?\n/).length};
  }catch(error){
    return{...legacy,ok:false,errors:[String(error)],code:'',lineCount:0};
  }
}
