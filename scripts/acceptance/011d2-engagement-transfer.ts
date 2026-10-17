import { defaultContourOperation, defaultPocketOperation, defaultThreeDRoughingOperation, type CamOperation } from '../../src/lib/types';
import { prepareEngagementTransfer, isEngagementTransferTargetCurrent } from '../../src/lib/engagementTransfer';
import { recommendCuttingEngagement } from '../../src/lib/cuttingEngagementRecommendation';
const assert = (value: unknown, description: string) => { if (!value) throw new Error(description); };
const base = { material: 'aluminium' as const, toolKind: 'end-mill' as const, diameterMm: 3,
  cuttingLengthMm: 10, operation: 'contour' as const, machineRigidity: 'light' as const };
const advice = recommendCuttingEngagement(base);
const contour = { ...defaultContourOperation, tool:{...defaultContourOperation.tool,kind:'end-mill' as const} };
const initial = JSON.stringify(contour);
const axial = prepareEngagementTransfer(contour, advice, {applyAxial:true,applyRadial:false});
assert(axial.status === 'ready' && axial.changed.length === 1 && axial.changed[0] === 'stepDownMm', 'contour ap opt in');
if(axial.status==='ready'&&advice.status==='advisory'&&advice.axial){
  assert(axial.operation.stepDownMm===advice.axial.preferredMm,'contour ap exact recommended value');
  assert(axial.operation.feedMmMin===contour.feedMmMin&&axial.operation.spindleRpm===contour.spindleRpm,
    'axial transfer preserves speed and feed');
  assert(JSON.stringify({...axial.operation,stepDownMm:contour.stepDownMm})===initial,
    'axial transfer changes no unselected fields');
}
assert(JSON.stringify(contour) === initial, 'original operation immutable');
const contourRadial = prepareEngagementTransfer(contour, advice, {applyAxial:false,applyRadial:true});
assert(contourRadial.status === 'unavailable', 'contour has no radial stepover');
const pocket = {...defaultPocketOperation, tool:{...defaultPocketOperation.tool,kind:'end-mill' as const},entry:'helix' as const};
const pocketAdvice = recommendCuttingEngagement({...base,operation:'pocket'});
assert(prepareEngagementTransfer(pocket,pocketAdvice,{applyAxial:true,applyRadial:false}).status==='unavailable','helix pitch not ap');
const rampPocket={...pocket,entry:'ramp' as const};
const beforeRadial=JSON.stringify(rampPocket);
const radial = prepareEngagementTransfer(rampPocket,pocketAdvice,{applyAxial:false,applyRadial:true});
assert(radial.status==='ready' && radial.changed[0]==='stepoverPercent','pocket radial only');
if(radial.status==='ready'&&pocketAdvice.status==='advisory'&&pocketAdvice.radial){
  const expected=Math.round(pocketAdvice.radial.preferredMm/rampPocket.tool.diameterMm*10000)/100;
  assert(radial.operation.kind==='pocket'&&radial.operation.stepoverPercent===expected,
    'pocket stepover is converted from recommended ae');
  assert(radial.operation.stepDownMm===rampPocket.stepDownMm,'radial transfer preserves axial depth');
  assert(JSON.stringify({...radial.operation,stepoverPercent:rampPocket.stepoverPercent})===beforeRadial,
    'radial transfer changes no unselected fields');
}
assert(JSON.stringify(rampPocket)===beforeRadial,'radial operation remains immutable');
assert(prepareEngagementTransfer(contour,advice,{applyAxial:false,applyRadial:false}).status==='unavailable','explicit selection required');
assert(prepareEngagementTransfer({...contour,tool:{...contour.tool,kind:'ball-nose'}},advice,{applyAxial:true,applyRadial:false}).status==='unavailable','tool kind guarded');

// UI-to-App confirmation guard: changing the target, editing the operation or
// removing it invalidates the prior explicit confirmation.
const reviewedSnapshot=JSON.stringify(contour);
assert(isEngagementTransferTargetCurrent([contour],'contour-op', 'contour-op',reviewedSnapshot) === (contour.id==='contour-op'), 'guard sanity');
assert(isEngagementTransferTargetCurrent([contour],contour.id,contour.id,reviewedSnapshot), 'unchanged reviewed target accepted');
assert(!isEngagementTransferTargetCurrent([contour],'other-id',contour.id,reviewedSnapshot), 'operation selection switch rejected');
assert(!isEngagementTransferTargetCurrent([] ,contour.id,contour.id,reviewedSnapshot), 'removed target rejected');
assert(!isEngagementTransferTargetCurrent([{...contour,stepDownMm:contour.stepDownMm+0.5}],contour.id,contour.id,reviewedSnapshot), 'edited target rejected');
assert(!isEngagementTransferTargetCurrent([contour],contour.id,contour.id,JSON.stringify({...contour,feedMmMin:contour.feedMmMin+1})), 'stale confirmation rejected');

console.log('011-D2 explicit transfer policy and UI target guards: PASS');
