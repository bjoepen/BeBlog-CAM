import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import { generateCarveGcode } from './carveGcode';
import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, CarveOperation } from './types';

type CarveArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:CarveOperation};
export type CarveCanonicalPostOptions={safeZMm:number;feedMmMin:number;plungeMmMin:number;spindleRpm:number};
type State={x:number;y:number;z:number};

const numberWord=(line:string,letter:string):number|null=>{
  const match=line.match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`,'i'));
  if(!match)return null;
  const value=Number(match[1]);
  return Number.isFinite(value)?value:null;
};
const same=(a:number,b:number)=>Math.abs(a-b)<=1e-9;
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

export function canonicalCarveToolpathFromGcode(code:string,operation:CarveOperation):CanonicalToolpath|null{
  const state:State={x:0,y:0,z:0};
  const runs:CanonicalToolpath['runs']=[];
  let cutZ:number|null=null;

  for(const raw of code.split(/\r?\n/)){
    const line=raw.replace(/\([^)]*\)/g,'').trim();if(!line)continue;
    const command=line.match(/\b(G0|G1)\b/i)?.[1]?.toUpperCase();if(!command)continue;
    const next={...state},x=numberWord(line,'X'),y=numberWord(line,'Y'),z=numberWord(line,'Z');
    if(x!==null)next.x=x;if(y!==null)next.y=y;if(z!==null)next.z=z;
    if(command==='G0'){
      cutZ=null;
      Object.assign(state,next);
      continue;
    }
    const xyChanged=!same(next.x,state.x)||!same(next.y,state.y),zChanged=!same(next.z,state.z);
    if(!xyChanged&&zChanged){cutZ=next.z<0?next.z:null;Object.assign(state,next);continue;}
    if(xyChanged&&cutZ!==null&&same(next.z,state.z)&&next.z<0){
      const start:ToolpathPoint2={x:state.x,y:state.y},end:ToolpathPoint2={x:next.x,y:next.y};
      const segments:CanonicalToolpathSegment[]=[{kind:'line',start,end}];
      runs.push({kind:'cut',z:next.z,points:[start,end],segments,retractAfter:true});
    }
    Object.assign(state,next);
  }
  if(!runs.length)return null;
  return{version:1,operationKind:'carve',strategy:'carve',tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:0,runs};
}

export function buildCarveCanonicalToolpath(args:CarveArgs):CanonicalToolpath|null{
  const result=generateCarveGcode(args);if(!result.ok)return null;
  return canonicalCarveToolpathFromGcode(result.code,args.operation);
}

export function postCarveCanonicalToolpath(toolpath:CanonicalToolpath,options:CarveCanonicalPostOptions):string{
  if(toolpath.operationKind!=='carve')throw new Error('Canonical toolpath is not a carve toolpath.');
  const lines:string[]=[
    '( BeBlog CAM 001Z-A )',
    '( Operation: Carve · canonical toolpath )',
    '( Sichtbare Werkzeugbahn und Maschinenbahn verwenden dieselbe kanonische Geometrie )',
    'G21','G90','G17',`S${Math.round(options.spindleRpm)} M3`,`G0 Z${f3(options.safeZMm)}`,
  ];
  toolpath.runs.forEach((run,index)=>{
    if(run.points.length<2)return;
    const start=run.points[0];
    lines.push(`( Werkzeugbahn ${index+1}/${toolpath.runs.length} · Z${f3(run.z)} )`);
    lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
    lines.push(`G1 Z${f3(run.z)} F${Math.round(options.plungeMmMin)}`);
    for(const segment of run.segments??[]){
      if(segment.kind==='line')lines.push(`G1 X${f3(segment.end.x)} Y${f3(segment.end.y)} F${Math.round(options.feedMmMin)}`);
      else{
        const code=segment.ccw?'G3':'G2',i=segment.center.x-segment.start.x,j=segment.center.y-segment.start.y;
        lines.push(`${code} X${f3(segment.end.x)} Y${f3(segment.end.y)} I${f3(i)} J${f3(j)} F${Math.round(options.feedMmMin)}`);
      }
    }
    if(run.retractAfter!==false)lines.push(`G0 Z${f3(options.safeZMm)}`);
  });
  lines.push('M5','M30');
  return lines.join('\n')+'\n';
}
