import type { PocketOperation } from './types';

export type StayDownResult={code:string;links:number;retainedRetracts:number};

type XY={x:number;y:number};
const EPS=.002;
const xyRe=/^G(?:0|1|2|3)\s+.*?X([-+]?\d+(?:\.\d+)?)\s+Y([-+]?\d+(?:\.\d+)?)/i;
const offsetRe=/^\( Offset \d+\/\d+ · innen ([-+]?\d+(?:\.\d+)?) mm \)$/;
const zCutRe=/^G1\s+Z([-+]?\d+(?:\.\d+)?)\s+F\d+/i;
const safeRe=/^G0\s+Z[-+]?\d+(?:\.\d+)?$/i;
const rapidXYRe=/^G0\s+X([-+]?\d+(?:\.\d+)?)\s+Y([-+]?\d+(?:\.\d+)?)/i;

const distance=(a:XY,b:XY)=>Math.hypot(a.x-b.x,a.y-b.y);
function xyOf(line:string):XY|null{const m=line.trim().match(xyRe);return m?{x:Number(m[1]),y:Number(m[2])}:null;}

/**
 * Gate 8C deliberately optimizes only the already-proven 8B parallel-pocket
 * output. A retract is removed only when the next loop starts within one
 * configured stepover of the previous closed-loop endpoint AND the analytical
 * offset correction advances by no more than that stepover.
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
        const safeDistance=linkDistance<=requestedStepover+EPS;
        const safeCorrection=correctionStep>EPS&&correctionStep<=requestedStepover+EPS;
        if(safeDistance&&safeCorrection){
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
