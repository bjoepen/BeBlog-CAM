import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import { generatePocketGcode } from './pocketGcode';
import { optimizeParallelPocketStayDown } from './pocketStayDown';
import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, PocketOperation } from './types';

type PocketArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation};
type MachineState={x:number;y:number;z:number};

const numberWord=(line:string,letter:string):number|null=>{
  const match=line.match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`,'i'));
  if(!match)return null;
  const value=Number(match[1]);
  return Number.isFinite(value)?value:null;
};

function sampleArc(start:ToolpathPoint2,end:ToolpathPoint2,center:ToolpathPoint2,ccw:boolean):ToolpathPoint2[]{
  const radius=Math.hypot(start.x-center.x,start.y-center.y);
  if(!(radius>0))return[end];
  let a0=Math.atan2(start.y-center.y,start.x-center.x),a1=Math.atan2(end.y-center.y,end.x-center.x),delta=a1-a0;
  if(ccw){while(delta<=0)delta+=Math.PI*2}else{while(delta>=0)delta-=Math.PI*2}
  const steps=Math.max(8,Math.ceil(Math.abs(delta)/(Math.PI/18)));
  return Array.from({length:steps},(_,index)=>{const angle=a0+delta*(index+1)/steps;return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius}});
}

export function canonicalPocketToolpathFromGcode(code:string,operation:PocketOperation,strategy:'raster'|'concentric'|'parallel'):CanonicalToolpath|null{
  const state:MachineState={x:0,y:0,z:0},runs:CanonicalToolpath['runs']=[];
  let current:{z:number;points:ToolpathPoint2[];segments:CanonicalToolpathSegment[]}|null=null;
  const close=()=>{if(current&&current.points.length>=2)runs.push({kind:'cut',z:current.z,points:current.points,segments:current.segments});current=null;};

  for(const raw of code.split(/\r?\n/)){
    const line=raw.replace(/\([^)]*\)/g,'').trim();if(!line)continue;
    const command=line.match(/\b(G0|G1|G2|G3)\b/i)?.[1]?.toUpperCase();if(!command)continue;
    const next={...state},x=numberWord(line,'X'),y=numberWord(line,'Y'),z=numberWord(line,'Z');
    if(x!==null)next.x=x;if(y!==null)next.y=y;if(z!==null)next.z=z;
    if(command==='G0'){close();Object.assign(state,next);continue;}
    const xyChanged=next.x!==state.x||next.y!==state.y;
    if(command==='G1'){
      if(xyChanged&&next.z<0){if(!current||Math.abs(current.z-next.z)>1e-9){close();current={z:next.z,points:[{x:state.x,y:state.y}],segments:[]};}const start={x:state.x,y:state.y},end={x:next.x,y:next.y};current.segments.push({kind:'line',start,end});current.points.push(end);}
      Object.assign(state,next);continue;
    }
    if((command==='G2'||command==='G3')&&next.z<0){
      // Helical arcs change Z while moving in XY. They are intentionally not flattened into
      // a false 2.5D cutting plane; helix preview gets its own canonical 3D motion gate later.
      if(Math.abs(next.z-state.z)>1e-9){close();Object.assign(state,next);continue;}
      if(!current||Math.abs(current.z-next.z)>1e-9){close();current={z:next.z,points:[{x:state.x,y:state.y}],segments:[]};}
      const i=numberWord(line,'I')??0,j=numberWord(line,'J')??0,start={x:state.x,y:state.y},end={x:next.x,y:next.y},center={x:state.x+i,y:state.y+j},ccw=command==='G3';
      current.segments.push({kind:'arc',start,end,center,ccw});current.points.push(...sampleArc(start,end,center,ccw));Object.assign(state,next);
    }
  }
  close();if(!runs.length)return null;
  return{version:1,operationKind:'pocket',strategy:strategy==='parallel'?'parallel-pocket':strategy,tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:operation.stepoverPercent,runs};
}

export function buildPocketCanonicalToolpath(args:PocketArgs):CanonicalToolpath|null{
  if(args.operation.entry==='helix')return null;
  const result=generatePocketGcode(args);if(!result.ok)return null;
  const optimized=result.strategy==='parallel'?optimizeParallelPocketStayDown(result.code,args.operation).code:result.code;
  return canonicalPocketToolpathFromGcode(optimized,args.operation,result.strategy);
}
