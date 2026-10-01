import { buildTrochoidalContourOperationState } from '../../src/lib/trochoidalOperationState';
import { resolveTrochoidalMachiningDepth } from '../../src/lib/trochoidalMachiningDepth';
import { createOperation } from '../../src/lib/operationsProject';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { proveTrochoidalRectangleGuideBoundary } from '../../src/lib/trochoidalRectangleBoundary';
import type { ImportSummary,StockDefinition,PartPlacement,PartOrientation,WorkCoordinateSystem } from '../../src/lib/types';
const expect=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg)};
const summary:ImportSummary={kind:'dxf',fileName:'f8.dxf',backend:'acceptance',status:'ready',entities:{circle:1},planarGeometry:{curves:[{kind:'circle',center:{x:10,y:10},radius:20}]}};
const stock:StockDefinition={width:80,height:60,thickness:12,offsetX:0,offsetY:0,offsetZ:0};
const placement:PartPlacement={horizontal:'center',vertical:'center',offsetX:0,offsetY:0,offsetZ:0};
const orientation:PartOrientation={rotationXDeg:0,rotationYDeg:0,rotationZDeg:0};
const wcs:WorkCoordinateSystem={x:'left',y:'front',z:'top'};
const op=createOperation('trochoidal-contour-roughing',1);if(op.kind!=='trochoidal-contour-roughing')throw new Error('kind');
op.contourId=0;op.depthMode='stock-bottom';op.overcutMm=.3;op.stepDownMm=5;op.tool.cuttingLengthMm=15;op.forwardStepMm=.5;
const before=JSON.stringify({summary,stock,placement,orientation,wcs,op});
const depth=resolveTrochoidalMachiningDepth({operation:op,stock,stockMode:'manual',wcs});
expect(depth.ok&&depth.targetDepthMm===12.3&&depth.workpieceBottomDepthMm===12&&depth.overcutMm===.3,'stock bottom and overcut remain distinct');
const state=buildTrochoidalContourOperationState({summary,stock,stockMode:'manual',placement,orientation,wcs,operation:op});
expect(state.ok,'through-cut state: '+state.errors.join(' '));
if(state.ok)expect(JSON.stringify(state.toolpath.runs.map(r=>r.z))===JSON.stringify([-5,-10,-12.3]),'exact shortened final through-cut step');
const smallTool={...op,depthMode:'manual' as const,totalDepthMm:3,overcutMm:0,stepDownMm:1,
  trochoidRadiusMm:2,forwardStepMm:.5,tool:{...op.tool,diameterMm:3,cuttingLengthMm:15,shaftDiameterMm:3}};
const smallToolState=buildTrochoidalContourOperationState({summary,stock,stockMode:'manual',placement,orientation,wcs,operation:smallTool});
expect(smallToolState.ok,'3 mm production cutter must retain the proven 140 degree exposure limit: '+smallToolState.errors.join(' '));
const rectangleSummary:ImportSummary={kind:'dxf',fileName:'e7-rectangle.dxf',backend:'acceptance',status:'ready',
  entities:{polyline:1},planarGeometry:{curves:[{kind:'polyline',closed:true,
    points:[{x:15,y:15},{x:45,y:15},{x:45,y:35},{x:15,y:35}],bulges:[0,0,0,0]}]}};
const rectangleOp={...smallTool,id:'e7-rectangle',side:'outside' as const};
const rectangleState=buildTrochoidalContourOperationState({summary:rectangleSummary,stock,stockMode:'manual',placement,orientation,wcs,operation:rectangleOp});
expect(rectangleState.ok,'E7 outside rectangle must pass the protected production path: '+rectangleState.errors.join(' '));
const defaultSixMmRectangle={...rectangleOp,id:'e8a-rectangle-default',trochoidRadiusMm:4,forwardStepMm:2,
  tool:{...rectangleOp.tool,diameterMm:6,shaftDiameterMm:6,cuttingLengthMm:15}};
const defaultSixMmState=buildTrochoidalContourOperationState({summary:rectangleSummary,stock,stockMode:'manual',placement,orientation,wcs,
  operation:defaultSixMmRectangle});
expect(defaultSixMmState.ok,'E8A Ø6/R4/step2 rectangle must auto-subdivide below the 140 degree material limit: '+defaultSixMmState.errors.join(' '));
const rectangleGuide=buildTrochoidalContourGuide(rectangleSummary.planarGeometry!.curves,rectangleOp);
expect(rectangleGuide.ok,'E7 rectangle guide must be constructible');
if(rectangleGuide.ok){
  const invaded=[...rectangleGuide.guide.segments];
  invaded[0]={kind:'line',start:{x:20,y:16},end:{x:40,y:16}};
  const rejectedBoundary=proveTrochoidalRectangleGuideBoundary(rectangleGuide.guide,invaded);
  expect(!rejectedBoundary.ok,'rectangle boundary proof must reject a path invading the protected part');
}
const rectangleInside=buildTrochoidalContourOperationState({summary:rectangleSummary,stock,stockMode:'manual',placement,orientation,wcs,
  operation:{...rectangleOp,side:'inside'}});
expect(!rectangleInside.ok&&rectangleInside.toolpath===null,'E7 inside sharp-corner rectangle remains fail closed');
const short={...op,tool:{...op.tool,cuttingLengthMm:12.2}};
const rejectedShort=buildTrochoidalContourOperationState({summary,stock,stockMode:'manual',placement,orientation,wcs,operation:short});
expect(!rejectedShort.ok&&rejectedShort.toolpath===null&&rejectedShort.errors.some(e=>e.includes('Schneidenlänge')),'short cutter fails closed');
const noStock=resolveTrochoidalMachiningDepth({operation:op,stock,stockMode:'none',wcs});expect(!noStock.ok,'stock-bottom without stock fails closed');
const manualOvercut={...op,depthMode:'manual' as const,totalDepthMm:3,overcutMm:.2};
const rejectedManual=resolveTrochoidalMachiningDepth({operation:manualOvercut,stock,stockMode:'manual',wcs});expect(!rejectedManual.ok,'manual overcut fails closed');
const manualTooDeep=resolveTrochoidalMachiningDepth({operation:{...op,depthMode:'manual',overcutMm:0,totalDepthMm:15.1,tool:{...op.tool,cuttingLengthMm:15}},stock,stockMode:'manual',wcs});expect(manualTooDeep.ok===false&&manualTooDeep.errors.some(e=>e.includes('Schneidenlänge')),'manual depth beyond cutting length fails closed');
const bottom=resolveTrochoidalMachiningDepth({operation:op,stock,stockMode:'manual',wcs:{...wcs,z:'bottom'}});expect(!bottom.ok,'bottom WCS fails closed');
expect(JSON.stringify({summary,stock,placement,orientation,wcs,op})===before,'inputs immutable');
console.log('010-F8 real machining limits: PASS');
