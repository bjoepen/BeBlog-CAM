import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { resolveTrochoidalPhysicalDirection } from '../../src/lib/trochoidalPhysicalDirection';
import { buildTrochoidalContourOperationState } from '../../src/lib/trochoidalOperationState';
import { createOperation } from '../../src/lib/operationsProject';
import type { ImportSummary, StockDefinition, PartPlacement, PartOrientation, WorkCoordinateSystem } from '../../src/lib/types';
import { defaultTrochoidalContourContract, type TrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';
const expect=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg)};
const circle:Curve2={kind:'circle',center:{x:0,y:0},radius:20};
const op=(side:'inside'|'outside'):TrochoidalContourContract=>({...defaultTrochoidalContourContract,id:'f10',name:'F10',tool:{...defaultTrochoidalContourContract.tool,id:'t',name:'Endmill',diameterMm:4,cuttingLengthMm:20},contourId:0,side,direction:'climb',trochoidRadiusMm:1.5,forwardStepMm:.5,radialAllowanceMm:0,axialAllowanceMm:0,depthMode:'manual',overcutMm:0,totalDepthMm:3,stepDownMm:1,feedMmMin:500,plungeMmMin:150,spindleRpm:12000,safeZMm:5,rampAngleDeg:3});
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

const stock:StockDefinition={width:100,height:80,thickness:12,offsetX:0,offsetY:0,offsetZ:0};
const placement:PartPlacement={horizontal:'center',vertical:'center',offsetX:0,offsetY:0,offsetZ:0};
const wcs:WorkCoordinateSystem={x:'left',y:'front',z:'top'};
const shapes=[
  {name:'circle',curves:[{kind:'circle',center:{x:20,y:20},radius:15}] as Curve2[]},
  {name:'capsule',curves:[{kind:'polyline',closed:true,points:[{x:10,y:10},{x:30,y:10},{x:30,y:30},{x:10,y:30}],bulges:[0,1,0,1]}] as Curve2[]}
];
for(const shape of shapes)for(const side of ['outside','inside'] as const)for(const direction of ['climb','conventional'] as const)for(const rotationZDeg of [0,37]){
  const summary:ImportSummary={kind:'dxf',fileName:'f10.dxf',backend:'acceptance',status:'ready',entities:{},planarGeometry:{curves:shape.curves}};
  const operation=createOperation('trochoidal-contour-roughing',1);if(operation.kind!=='trochoidal-contour-roughing')throw new Error('operation kind');
  operation.contourId=0;operation.side=side;operation.direction=direction;operation.totalDepthMm=2.4;operation.stepDownMm=1;
  operation.trochoidRadiusMm=4;operation.forwardStepMm=.5;operation.tool.cuttingLengthMm=20;
  const orientation:PartOrientation={rotationXDeg:0,rotationYDeg:0,rotationZDeg};
  const before=JSON.stringify({summary,stock,placement,orientation,wcs,operation});
  const state=buildTrochoidalContourOperationState({summary,stock,stockMode:'manual',placement,orientation,wcs,operation});
  expect(state.ok,`${shape.name} ${side} ${direction} ${rotationZDeg}: ${state.errors.join(' ')}`);
  if(state.ok){
    expect(state.toolpath.runs.length===3,`${shape.name} multidepth schedule`);
    expect(!!state.toolpath.motions?.length,`${shape.name} canonical motions`);
    expect(state.toolpath.runs.every(r=>r.entrySegments.length>0&&r.cutSegments3.length>0),`${shape.name} stock entry and protected cuts`);
    expect(state.toolpath.sourceOperationId===operation.id,`${shape.name} source identity`);
  }
  expect(JSON.stringify({summary,stock,placement,orientation,wcs,operation})===before,`${shape.name} operation pipeline immutable`);
}
console.log('010-F10 physical cut direction: PASS');
