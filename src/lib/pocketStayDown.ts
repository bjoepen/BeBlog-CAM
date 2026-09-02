import type { PocketOperation } from './types';

export type StayDownResult={code:string;links:number;retainedRetracts:number};

type XY={x:number;y:number};
const EPS=.002;
const xyRe=/^G(?:0|1|2|3)\s+.*?X([-+]?\d+(?:\.\d+)?)\s+Y([-+]?\d+(?:\.\d+)?)/i;
const offsetRe=/^\( Offset \d+\/\d+ · innen ([-+]?\d+(?:\.\d+)?) mm \)$/;
const zCutRe=/^G1\s+Z([-+]?\d+(?:\.\d+)?)\s+F\d+/i;
const safeRe=/^G0\s+Z[-+]?\d+(?:\.\d+)?$/i;
const rapidXYRe=/^G0\s+X([-+]?\d+(?:\.\d+)?)\s+Y([-+]?\d+(?:\.\d+)?)/i;
const linearXYRe=/^G1\s+X([-+]?\d+(?:\.\d+)?)\s+Y([-+]?\d+(?:\.\d+)?)/i;

const distance=(a:XY,b:XY)=>Math.hypot(a.x-b.x,a.y-b.y);
function xyOf(line:string):XY|null{const m=line.trim().match(xyRe);return m?{x:Number(m[1]),y:Number(m[2])}:null;}
function near(a:number,b:number,t=EPS){return Math.abs(a-b)<=t;}

function offsetLoopPoints(lines:string[],offsetIndex:number):XY[]|null{
  const points:XY[]=[];
  for(let i=offsetIndex+1;i<lines.length;i++){
    const trim=lines[i].trim();
    if(safeRe.test(trim)||offsetRe.test(trim))break;
    if(/^G[23]\b/i.test(trim))return null;
    const move=trim.match(linearXYRe);
    if(move)points.push({x:Number(move[1]),y:Number(move[2])});
  }
  return points.length?points:null;
}

function isAxisAlignedRectangle(points:XY[]|null):boolean{
  if(!points||points.length!==4)return false;
  const unique=points.filter((point,index)=>points.findIndex(other=>near(point.x,other.x)&&near(point.y,other.y))===index);
  if(unique.length!==4)return false;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const horizontal=near(a.y,b.y),vertical=near(a.x,b.x);
    if(horizontal===vertical)return false;
  }
  const xs=[...new Set(points.map(point=>point.x.toFixed(3)))],ys=[...new Set(points.map(point=>point.y.toFixed(3)))];
  return xs.length===2&&ys.length===2;
}

function previousOffsetIndex(lines:string[],safeIndex:number):number{
  for(let i=safeIndex-1;i>=0;i--)if(offsetRe.test(lines[i].trim()))return i;
  return-1;
}

/**
 * Gate 8C deliberately optimizes only the already-proven parallel-pocket output.
 * A retract is removed only when the analytical offset correction advances by no
 * more than the configured stepover and the linking move is geometrically bounded.
 *
 * Mixed LINE/ARC contours keep the original strict link-distance gate. For the
 * separately proven axis-aligned rectangle gate, matching nested rectangle corners
 * are allowed to connect diagonally: the diagonal lies entirely inside the pocket
 * and is bounded by sqrt(2) times the analytical inward correction step.
 *
 * If any condition is ambiguous, the original Safe-Z sequence is retained.
 */
export function optimizeParallelPocketStayDown(code:string,operation:PocketOperation):StayDownResult{
  if(!code.includes('( Konturparallele Tasche'))return{code,links:0,retainedRetracts:0};
  const requestedStepover=operation.tool.diameterMm*operation.stepoverPercent/100;
  if(!(requestedStepover>0))return{code,links:0,retainedRetracts:0};

  const input=code.split(/\r?\n/);const out:string[]=[];
  let currentXY:XY|null=null;let previousCorrection:number|null=null;let links=0,retainedRetracts=0;

  for(let i=0;i<input.length;i++){
    const line=input[i],trim=line.trim();
    const offset=trim.match(offsetRe);if(offset)previousCorrection=Number(offset[1]);
    const motion=xyOf(line);if(motion)currentXY=motion;

    if(safeRe.test(trim)&&i+3<input.length){
      const rapid=input[i+1].trim().match(rapidXYRe),cut=input[i+2].trim().match(zCutRe),nextOffset=input[i+3].trim().match(offsetRe);
      if(rapid&&cut&&nextOffset&&currentXY&&previousCorrection!==null){
        const nextXY={x:Number(rapid[1]),y:Number(rapid[2])},nextCorrection=Number(nextOffset[1]);
        const linkDistance=distance(currentXY,nextXY),correctionStep=nextCorrection-previousCorrection;
        const safeCorrection=correctionStep>EPS&&correctionStep<=requestedStepover+EPS;
        const strictDistance=linkDistance<=requestedStepover+EPS;
        const previousIndex=previousOffsetIndex(input,i);
        const rectangular=previousIndex>=0
          &&isAxisAlignedRectangle(offsetLoopPoints(input,previousIndex))
          &&isAxisAlignedRectangle(offsetLoopPoints(input,i+3));
        const rectangularCornerDistance=rectangular&&linkDistance<=correctionStep*Math.SQRT2+EPS*2;
        if(safeCorrection&&(strictDistance||rectangularCornerDistance)){
          out.push(`G1 X${nextXY.x.toFixed(3)} Y${nextXY.y.toFixed(3)} F${Math.round(operation.feedMmMin)}`);
          currentXY=nextXY;previousCorrection=nextCorrection;links++;i+=2;continue;
        }
      }
      retainedRetracts++;
    }
    out.push(line);
  }
  const optimized=out.join('\n').replace(/\n+$/,'')+'\n';
  return{code:optimized,links,retainedRetracts};
}
