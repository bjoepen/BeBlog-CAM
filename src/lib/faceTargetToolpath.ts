import type { FaceTargetRoughing } from './faceTargetRoughing';
import type { CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';

const EPS=1e-6;

export type FaceTargetMachineOrigin={x:number;y:number;z:number};
export type FaceTargetCanonicalPostOptions={
  safeZMm:number;
  feedMmMin:number;
  plungeMmMin:number;
  spindleRpm:number;
};

function pointInEvenOdd(loops:{points:ToolpathPoint2[]}[],p:ToolpathPoint2){
  let inside=false;
  for(const loop of loops){
    const poly=loop.points;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      const hit=((a.y>p.y)!==(b.y>p.y))&&p.x<((b.x-a.x)*(p.y-a.y))/(b.y-a.y||Number.EPSILON)+a.x;
      if(hit)inside=!inside;
    }
  }
  return inside;
}

function distanceToSegment(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<=EPS)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

function clearanceToBoundary(loops:{points:ToolpathPoint2[]}[],p:ToolpathPoint2){
  let best=Infinity;
  for(const loop of loops){
    for(let i=0;i+1<loop.points.length;i++)best=Math.min(best,distanceToSegment(p,loop.points[i],loop.points[i+1]));
  }
  return best;
}

function safeAt(loops:{points:ToolpathPoint2[]}[],p:ToolpathPoint2,radius:number){
  return pointInEvenOdd(loops,p)&&clearanceToBoundary(loops,p)>=radius-EPS;
}

function bounds(loops:{points:ToolpathPoint2[]}[]){
  const pts=loops.flatMap(loop=>loop.points);
  if(!pts.length)return null;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}

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
  const b=bounds(target.loops);if(!b)return null;
  const radius=toolDiameterMm/2,stepover=Math.max(.05,toolDiameterMm*stepoverPercent/100);
  const sampleStep=Math.max(.15,Math.min(.75,toolDiameterMm/8));

  const rasterRows:{points:ToolpathPoint2[]}[]=[];
  let row=0;
  for(let y=b.minY+radius;y<=b.maxY-radius+EPS;y+=stepover,row++){
    const lineRuns:{a:number;b:number}[]=[];
    let start:number|null=null,last:number|null=null;
    for(let x=b.minX+radius;x<=b.maxX-radius+EPS;x+=sampleStep){
      if(safeAt(target.loops,{x,y},radius)){if(start===null)start=x;last=x}
      else if(start!==null&&last!==null){if(last-start>EPS)lineRuns.push({a:start,b:last});start=last=null}
    }
    if(start!==null&&last!==null&&last-start>EPS)lineRuns.push({a:start,b:last});
    for(const segment of lineRuns){
      const worldPoints=row%2===0?[{x:segment.a,y},{x:segment.b,y}]:[{x:segment.b,y},{x:segment.a,y}];
      rasterRows.push({points:worldPoints});
    }
  }
  if(!rasterRows.length)return null;

  const runs:CanonicalToolpathRun[]=[];
  // True Z-level roughing: clear the complete allowed XY region at one depth
  // before descending to the next level.
  for(const worldZ of target.levels){
    const machineZ=worldZ-origin.z;
    for(const rowRun of rasterRows){
      runs.push({
        kind:'cut',
        z:machineZ,
        points:rowRun.points.map(point=>({x:point.x-origin.x,y:point.y-origin.y})),
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

  const lines:string[]=[
    '( BeBlog CAM 001Z-C )',
    '( Operation: Face-Target Z-Level Roughing · canonical toolpath )',
    '( Gewählte BRep-Zielfläche = Bearbeitungsbereich + Zielhöhe )',
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
    lines.push(`( Werkzeugbahn ${index+1}/${toolpath.runs.length} )`);
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
