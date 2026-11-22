import { isAdvisorContextCurrent, type AdvisorContext, type AdvisorContextSnapshot, type AdvisorFeature, type AdvisorReport } from './advisorStepFeasibility';
import type { StepClassifiedFeature, StepFeatureClassificationResult } from './stepFeatureClassification';
import type { StepManufacturingFeatureInventoryResult, StepManufacturingInventoryEntry } from './stepManufacturingFeatureInventory';
import type { PartOrientation } from './types';

export type StepAdvisorFeatureFeasibility=
  |Readonly<{status:'assessed';assessment:AdvisorFeature}>
  |Readonly<{status:'not-assessed';reason:string}>;

export type StepAdvisorFeatureOverviewEntry=Readonly<{
  featureId:string;
  inventory:StepManufacturingInventoryEntry;
  classification:StepClassifiedFeature;
  feasibility:StepAdvisorFeatureFeasibility;
}>;

export type StepAdvisorFeatureOverview=Readonly<{
  version:1;
  geometryIdentity:string;
  orientation:PartOrientation;
  features:readonly StepAdvisorFeatureOverviewEntry[];
}>;

export type StepAdvisorFeatureOverviewResult=
  |Readonly<{ok:true;overview:StepAdvisorFeatureOverview;errors:readonly []}>
  |Readonly<{ok:false;overview:null;errors:readonly string[]}>;

const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);
const notAssessed=(reason:string):StepAdvisorFeatureFeasibility=>({status:'not-assessed',reason});

/**
 * Read-only G3 join. Geometry/classification stay authoritative in G1/G2 and
 * feasibility is attached only to the exact, still-current reviewed context.
 */
export function buildStepAdvisorFeatureOverview(args:Readonly<{
  inventoryResult:StepManufacturingFeatureInventoryResult|null;
  classificationResult:StepFeatureClassificationResult|null;
  report:AdvisorReport|null;
  reviewedContext:AdvisorContextSnapshot|null;
  currentContext:AdvisorContext|null;
}>):StepAdvisorFeatureOverviewResult{
  const errors:string[]=[];
  if(!args.currentContext)errors.push('A verified current Advisor context is required.');
  if(!args.reviewedContext)errors.push('The feasibility report has no verified reviewed-context snapshot.');
  if(!args.inventoryResult?.ok)errors.push(...(args.inventoryResult?.errors.length?args.inventoryResult.errors:['STEP feature inventory is unavailable.']));
  if(!args.classificationResult?.ok)errors.push(...(args.classificationResult?.errors.length?args.classificationResult.errors:['STEP feature classification is unavailable.']));
  if(!args.report)errors.push('The existing Advisor feasibility report is unavailable.');
  if(errors.length)return{ok:false,overview:null,errors};

  const current=args.currentContext!;
  const inventory=args.inventoryResult!.inventory!;
  const classification=args.classificationResult!.classification!;
  const report=args.report!;
  if(!isAdvisorContextCurrent(args.reviewedContext,current))errors.push('Advisor context changed after feasibility review; feature associations are stale.');
  if(!current.geometryIdentity.startsWith('sha256:'))errors.push('Advisor geometry identity is not a verified source-content identity.');
  if(!same(inventory.orientation,current.orientation)||!same(classification.orientation,current.orientation))errors.push('Inventory, classification and Advisor orientations do not match.');
  if(inventory.entries.length!==classification.features.length)errors.push('Inventory and classification feature counts do not match.');
  else inventory.entries.forEach((entry,index)=>{
    const feature=classification.features[index];
    if(entry.featureId!==feature.featureId||entry.kind!==feature.geometryKind||!same(entry.sourceReferences,feature.sourceReferences))errors.push(`Feature ${index} does not preserve its G1 identity, kind and native source references.`);
  });
  if(report.material!==current.material)errors.push('Feasibility report material does not match the reviewed Advisor context.');
  if(errors.length)return{ok:false,overview:null,errors};

  const features=inventory.entries.map((entry,index):StepAdvisorFeatureOverviewEntry=>{
    const feature=classification.features[index];
    if(report.status!=='screened')return{featureId:entry.featureId,inventory:entry,classification:feature,feasibility:notAssessed('The existing Advisor feasibility screen is unavailable for this context.')};
    if(feature.geometryKind!=='hole'&&feature.geometryKind!=='unclassified-cylinder')return{featureId:entry.featureId,inventory:entry,classification:feature,feasibility:notAssessed('The existing Advisor does not assess this geometric feature kind.')};
    const matches=report.features.filter(candidate=>candidate.featureId===entry.featureId&&candidate.kind===feature.geometryKind&&same(candidate.faceIds,feature.sourceReferences.faceIds));
    if(matches.length!==1)return{featureId:entry.featureId,inventory:entry,classification:feature,feasibility:notAssessed(matches.length?'The feasibility association is ambiguous.':'No trustworthy matching feasibility finding exists.')};
    return{featureId:entry.featureId,inventory:entry,classification:feature,feasibility:{status:'assessed',assessment:matches[0]}};
  });
  return{ok:true,errors:[],overview:{version:1,geometryIdentity:current.geometryIdentity,orientation:{...inventory.orientation},features}};
}
