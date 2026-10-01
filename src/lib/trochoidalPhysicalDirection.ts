import type { SemanticSegment } from './contourMath';
import type { CutDirection } from './types';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';

export type TrochoidalPhysicalDirection={guide:TrochoidalContourGuide;contourWinding:'cw'|'ccw';freeSide:'left'|'right';loopDirection:'cw'|'ccw'};

const signedArea=(segments:SemanticSegment[])=>segments.reduce((area,segment)=>{
  const chord=(segment.start.x*segment.end.y-segment.end.x*segment.start.y)/2;
  if(segment.kind==='line')return area+chord;
  const start=Math.atan2(segment.start.y-segment.center.y,segment.start.x-segment.center.x);
  const end=Math.atan2(segment.end.y-segment.center.y,segment.end.x-segment.center.x);
  let sweep=end-start;if(segment.ccw){while(sweep<=0)sweep+=Math.PI*2}else{while(sweep>=0)sweep-=Math.PI*2}
  return area+chord+segment.radius**2*(sweep-Math.sin(sweep))/2;
},0);

const reverseSegments=(segments:SemanticSegment[]):SemanticSegment[]=>[...segments].reverse().map(segment=>
  segment.kind==='line'?{kind:'line',start:segment.end,end:segment.start}
    :{kind:'arc',start:segment.end,end:segment.start,center:{...segment.center},radius:segment.radius,ccw:!segment.ccw});

export function resolveTrochoidalPhysicalDirection(guide:TrochoidalContourGuide,direction:CutDirection):TrochoidalPhysicalDirection|null{
  if(!guide?.validation?.ok||(guide.side!=='inside'&&guide.side!=='outside')||(direction!=='climb'&&direction!=='conventional'))return null;
  const area=signedArea(guide.segments);if(!Number.isFinite(area)||Math.abs(area)<=1e-9)return null;
  // M3 spindle: climb is CW outside and CCW inside; conventional is the inverse.
  const climbCcw=guide.side==='inside';
  const targetCcw=direction==='climb'?climbCcw:!climbCcw;
  const oriented=area>0===targetCcw?guide:{...guide,source:reverseSegments(guide.source),segments:reverseSegments(guide.segments)};
  const interiorSide=targetCcw?'left':'right';
  const freeSide=guide.side==='inside'?interiorSide:interiorSide==='left'?'right':'left';
  // At the guide-touch point this winding moves the cutter centre forward along the oriented guide.
  const loopDirection=freeSide==='left'?'ccw':'cw';
  return{guide:oriented,contourWinding:targetCcw?'ccw':'cw',freeSide,loopDirection};
}
