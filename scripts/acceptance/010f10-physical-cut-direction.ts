import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { resolveTrochoidalPhysicalDirection } from '../../src/lib/trochoidalPhysicalDirection';
import type { TrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';
const expect=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg)};
const circle:Curve2={kind:'circle',center:{x:0,y:0},radius:20};
const op=(side:'inside'|'outside'):TrochoidalContourContract=>({id:'f10',kind:'trochoidal-contour-roughing',name:'F10',enabled:true,tool:{id:'t',name:'Endmill',diameterMm:4,kind:'end-mill',cuttingLengthMm:20},contourId:0,side,direction:'climb',trochoidRadiusMm:1.5,forwardStepMm:.5,radialAllowanceMm:0,depthMode:'manual',overcutMm:0,totalDepthMm:3,stepDownMm:1,feedMmMin:500,plungeMmMin:150,spindleRpm:12000,safeZMm:5,rampAngleDeg:3});
const winding=(segments:any[])=>segments.reduce((a,s)=>a+(s.start.x*s.end.y-s.end.x*s.start.y)/2+(s.kind==='arc'?s.radius*s.radius*((()=>{let w=Math.atan2(s.end.y-s.center.y,s.end.x-s.center.x)-Math.atan2(s.start.y-s.center.y,s.start.x-s.center.x);if(s.ccw){while(w<=0)w+=Math.PI*2}else{while(w>=0)w-=Math.PI*2}return w-Math.sin(w)})())/2:0),0)>0?'ccw':'cw';
for(const side of ['outside','inside'] as const){
  for(const direction of ['climb','conventional'] as const){
    for(const transform of [(p:{x:number;y:number})=>p,(p:{x:number;y:number})=>({x:-p.x,y:p.y})]){
      const operation={...op(side),direction};
      const guide=buildTrochoidalContourGuide([circle],operation,transform);expect(guide.ok,'guide');
      if(!guide.ok)continue;
      const before=JSON.stringify(guide.guide),resolved=resolveTrochoidalPhysicalDirection(guide.guide,direction);expect(!!resolved,'direction resolves');
      if(!resolved)continue;
      const expected=direction==='climb'?(side==='outside'?'cw':'ccw'):(side==='outside'?'ccw':'cw');
      expect(resolved.contourWinding===expected&&winding(resolved.guide.segments)===expected,`${side} ${direction} physical winding`);
      expect(resolved.loopDirection===(resolved.freeSide==='left'?'ccw':'cw'),'loop advances at guide touch');
      expect(JSON.stringify(guide.guide)===before,'resolver immutable');
    }
  }
}
console.log('010-F10 physical cut direction: PASS');
