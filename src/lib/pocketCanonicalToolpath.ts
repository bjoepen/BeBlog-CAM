import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import { generatePocketGcode } from './pocketGcode';
import { optimizeParallelPocketStayDown } from './pocketStayDown';
import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, PocketOperation } from './types';

type PocketArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation};
type MachineState={x:number;y:number;z:number};
export type PocketCanonicalPostOptions={safeZMm:number;feedMmMin:number;plungeMmMin:number;spindleRpm:number};

const numberWord=(line:string,letter:string):number|null=>{
  const match=line.match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`,'i'));
  if(!match)return null;
  const value=Number(match[1]);
  return Number.isFinite(value)?value:null;
};
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const same=(a:number,b:number)=>Math.abs(a-b)<=1e-9;

function sampleArc(start:ToolpathPoint2,end:ToolpathPoint2,center:ToolpathPoint2,ccw:boolean):ToolpathPoint2[]{
  const radius=Math.hypot(start.x-center.x,start.y-center.y);
  if(!(radius>0))return[end];
  let a0=Math.atan2(start.y-center.y,start.x-center.x),a1=Math.atan2(end.y-center.y,end.x-center.x),delta=a1-a0;
  if(ccw){while(delta<=0)delta+=Math.PI*2}else{while(delta>=0)delta-=Math.PI*2}
  const steps=Math.max(8,Math.ceil(Math.abs(delta)/(Math.PI/18)));
  return Array.from({length:steps},(_,index)=>{const angle=a0+delta*(index+1)/steps;return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius}});
}

export function samplePocketSpatialSegment(segment:CanonicalSpatialSegment):ToolpathPoint3[]{
  if(segment.kind==='line3'){
    const distance=Math.hypot(segment.end.x-segment.start.x,segment.end.y-segment.start.y,segment.end.z-segment.start.z);
    const steps=Math.max(2,Math.ceil(distance/2));
    return Array.from({length:steps+1},(_,i)=>{const t=i/steps;return{x:segment.start.x+(segment.end.x-segment.start.x)*t,y:segment.start.y+(segment.end.y-segment.start.y)*t,z:segment.start.z+(segment.end.z-segment.start.z)*t}});
  }
  const radius=Math.hypot(segment.start.x-segment.center.x,segment.start.y-segment.center.y);
  let a0=Math.atan2(segment.start.y-segment.center.y,segment.start.x-segment.center.x),a1=Math.atan2(segment.end.y-segment.center.y,segment.end.x-segment.center.x),delta=a1-a0;
  if(segment.ccw){while(delta<=0)delta+=Math.PI*2}else{while(delta>=0)delta-=Math.PI*2}
  const steps=Math.max(12,Math.ceil(Math.abs(delta)/(Math.PI/24)));
  return Array.from({length:steps+1},(_,i)=>{const t=i/steps,a=a0+delta*t;return{x:segment.center.x+Math.cos(a)*radius,y:segment.center.y+Math.sin(a)*radius,z:segment.start.z+(segment.end.z-segment.start.z)*t}});
}

export function canonicalPocketToolpathFromGcode(code:string,operation:PocketOperation,strategy:'raster'|'concentric'|'parallel'):CanonicalToolpath|null{
  const state:MachineState={x:0,y:0,z:0},runs:CanonicalToolpath['runs']=[];
  let pendingEntry:CanonicalSpatialSegment[]=[];
  let current:{z:number;points:ToolpathPoint2[];segments:CanonicalToolpathSegment[];entrySegments:CanonicalSpatialSegment[];retractAfter:boolean}|null=null;
  const close=(retractAfter=true)=>{
    if(current&&current.points.length>=2)runs.push({kind:'cut',z:current.z,points:current.points,segments:current.segments,entrySegments:current.entrySegments.length?current.entrySegments:undefined,retractAfter});
    current=null;
  };
  const begin=(z:number,start:ToolpathPoint2)=>{
    close(false);
    current={z,points:[start],segments:[],entrySegments:pendingEntry,retractAfter:true};
    pendingEntry=[];
  };

  for(const raw of code.split(/\r?\n/)){
    const line=raw.replace(/\([^)]*\)/g,'').trim();if(!line)continue;
    const command=line.match(/\b(G0|G1|G2|G3)\b/i)?.[1]?.toUpperCase();if(!command)continue;
    const next={...state},x=numberWord(line,'X'),y=numberWord(line,'Y'),z=numberWord(line,'Z'),feed=numberWord(line,'F');
    if(x!==null)next.x=x;if(y!==null)next.y=y;if(z!==null)next.z=z;
    if(command==='G0'){
      close(true);
      pendingEntry=[];
      Object.assign(state,next);
      continue;
    }
    const xyChanged=!same(next.x,state.x)||!same(next.y,state.y),zChanged=!same(next.z,state.z);
    if(command==='G1'){
      if(xyChanged&&zChanged){
        if(current)close(false);
        pendingEntry.push({kind:'line3',start:{...state},end:{...next},feedMmMin:feed??undefined});
        Object.assign(state,next);continue;
      }
      if(xyChanged&&next.z<0){
        if(!current||!same(current.z,next.z))begin(next.z,{x:state.x,y:state.y});
        const start={x:state.x,y:state.y},end={x:next.x,y:next.y};current!.segments.push({kind:'line',start,end});current!.points.push(end);
      }
      Object.assign(state,next);continue;
    }
    if((command==='G2'||command==='G3')&&next.z<0){
      const i=numberWord(line,'I')??0,j=numberWord(line,'J')??0,ccw=command==='G3',center={x:state.x+i,y:state.y+j};
      if(zChanged){
        if(current)close(false);
        pendingEntry.push({kind:'arc3',start:{...state},end:{...next},center,ccw,feedMmMin:feed??undefined});
        Object.assign(state,next);continue;
      }
      if(!current||!same(current.z,next.z))begin(next.z,{x:state.x,y:state.y});
      const start={x:state.x,y:state.y},end={x:next.x,y:next.y};
      current!.segments.push({kind:'arc',start,end,center,ccw});current!.points.push(...sampleArc(start,end,center,ccw));Object.assign(state,next);
    }
  }
  close(true);if(!runs.length)return null;
  return{version:1,operationKind:'pocket',strategy:strategy==='parallel'?'parallel-pocket':strategy,tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:operation.stepoverPercent,runs};
}

export function buildPocketCanonicalToolpath(args:PocketArgs):CanonicalToolpath|null{
  const result=generatePocketGcode(args);if(!result.ok)return null;
  const optimized=result.strategy==='parallel'?optimizeParallelPocketStayDown(result.code,args.operation).code:result.code;
  return canonicalPocketToolpathFromGcode(optimized,args.operation,result.strategy);
}

function emitSpatial(lines:string[],segment:CanonicalSpatialSegment,options:PocketCanonicalPostOptions){
  const feed=Math.round(segment.feedMmMin??options.plungeMmMin);
  if(segment.kind==='line3'){
    lines.push(`G1 X${f3(segment.end.x)} Y${f3(segment.end.y)} Z${f3(segment.end.z)} F${feed}`);
    return;
  }
  const i=segment.center.x-segment.start.x,j=segment.center.y-segment.start.y;
  lines.push(`${segment.ccw?'G3':'G2'} X${f3(segment.end.x)} Y${f3(segment.end.y)} Z${f3(segment.end.z)} I${f3(i)} J${f3(j)} F${feed}`);
}

export function postPocketCanonicalToolpath(toolpath:CanonicalToolpath,options:PocketCanonicalPostOptions):string{
  if(toolpath.operationKind!=='pocket')throw new Error('Canonical toolpath is not a pocket toolpath.');
  const strategyLabel=toolpath.strategy==='parallel-pocket'?'Konturparallel':toolpath.strategy==='concentric'?'Konzentrisch':'Raster';
  const spatialCount=toolpath.runs.reduce((n,run)=>n+(run.entrySegments?.length??0),0);
  const lines:string[]=[
    '( BeBlog CAM 001Z-A )',
    `( Operation: Tasche · ${strategyLabel} · canonical toolpath )`,
    spatialCount?'( Planare Werkzeugbahn und räumlicher Einstieg verwenden dieselbe kanonische Bewegung )':'( Sichtbare Werkzeugbahn und Maschinenbahn verwenden dieselbe kanonische Geometrie )',
    'G21','G90','G17',`S${Math.round(options.spindleRpm)} M3`,`G0 Z${f3(options.safeZMm)}`,
  ];
  let previousRetracted=true;
  toolpath.runs.forEach((run,index)=>{
    if(run.points.length<2)return;
    const entry=run.entrySegments??[],start=entry[0]?.start??{x:run.points[0].x,y:run.points[0].y,z:run.z};
    lines.push(`( Werkzeugbahn ${index+1}/${toolpath.runs.length} · Z${f3(run.z)}${entry.length?' · räumlicher Einstieg':''} )`);
    if(previousRetracted){
      lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
      if(entry.length){
        if(Math.abs(start.z)<=.0005)lines.push('G0 Z0.000');
        else lines.push(`G1 Z${f3(start.z)} F${Math.round(options.plungeMmMin)}`);
      }else lines.push(`G1 Z${f3(run.z)} F${Math.round(options.plungeMmMin)}`);
    }
    for(const segment of entry)emitSpatial(lines,segment,options);
    if(run.segments?.length){
      for(const segment of run.segments){
        if(segment.kind==='line')lines.push(`G1 X${f3(segment.end.x)} Y${f3(segment.end.y)} F${Math.round(options.feedMmMin)}`);
        else{
          const code=segment.ccw?'G3':'G2',i=segment.center.x-segment.start.x,j=segment.center.y-segment.start.y;
          lines.push(`${code} X${f3(segment.end.x)} Y${f3(segment.end.y)} I${f3(i)} J${f3(j)} F${Math.round(options.feedMmMin)}`);
        }
      }
    }else for(let i=1;i<run.points.length;i++)lines.push(`G1 X${f3(run.points[i].x)} Y${f3(run.points[i].y)} F${Math.round(options.feedMmMin)}`);
    const retract=run.retractAfter!==false;
    if(retract)lines.push(`G0 Z${f3(options.safeZMm)}`);
    previousRetracted=retract;
  });
  if(!previousRetracted)lines.push(`G0 Z${f3(options.safeZMm)}`);
  lines.push('M5','M30');
  return lines.join('\n')+'\n';
}
