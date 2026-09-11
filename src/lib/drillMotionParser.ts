import type { CanonicalMachineMotion, ToolpathPoint3 } from './canonicalToolpath';

type AxisState={x:number|null;y:number|null;z:number|null};

const numberWord=(line:string,letter:string):number|null=>{
  const match=line.match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`,'i'));
  if(!match)return null;
  const value=Number(match[1]);
  return Number.isFinite(value)?value:null;
};

const completePoint=(state:AxisState):ToolpathPoint3|null=>{
  if(state.x===null||state.y===null||state.z===null)return null;
  return{x:state.x,y:state.y,z:state.z};
};

export function parseCanonicalMachineMotions(code:string):CanonicalMachineMotion[]{
  const state:AxisState={x:null,y:null,z:null};
  const motions:CanonicalMachineMotion[]=[];

  for(const raw of code.split(/\r?\n/)){
    const line=raw.replace(/\([^)]*\)/g,'').trim();
    if(!line)continue;
    const command=line.match(/\b(G0|G1|G2|G3)\b/i)?.[1]?.toUpperCase();
    if(!command)continue;

    const start=completePoint(state);
    const next:AxisState={...state};
    const x=numberWord(line,'X'),y=numberWord(line,'Y'),z=numberWord(line,'Z'),feed=numberWord(line,'F');
    if(x!==null)next.x=x;
    if(y!==null)next.y=y;
    if(z!==null)next.z=z;
    const end=completePoint(next);

    // A partial modal state is not a known machine position. The first lines of
    // generated drill G-code intentionally establish Safe-Z and then XY. Do not
    // invent missing axes as WCS zero; only materialize motion once both start
    // and end are fully known XYZ anchors.
    if(start&&end){
      if(command==='G0')motions.push({kind:'rapid3',start,end});
      else if(command==='G1')motions.push({kind:'line3',start,end,feedMmMin:feed??undefined});
      else{
        const i=numberWord(line,'I')??0,j=numberWord(line,'J')??0;
        motions.push({kind:'arc3',start,end,center:{x:start.x+i,y:start.y+j},ccw:command==='G3',feedMmMin:feed??undefined});
      }
    }

    Object.assign(state,next);
  }

  return motions;
}
