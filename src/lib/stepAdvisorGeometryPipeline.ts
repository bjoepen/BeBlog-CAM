import { classifyStepManufacturingFeatures, type StepFeatureClassificationResult } from './stepFeatureClassification';
import { buildStepManufacturingFeatureInventory, type StepManufacturingFeatureInventoryResult } from './stepManufacturingFeatureInventory';
import type { ImportSummary, PartOrientation } from './types';

export type StepAdvisorGeometryPipelineResult=Readonly<{
  inventoryResult:StepManufacturingFeatureInventoryResult;
  classificationResult:StepFeatureClassificationResult|null;
}>;

export type StepAdvisorGeometryProducers=Readonly<{
  buildInventory:typeof buildStepManufacturingFeatureInventory;
  classifyInventory:typeof classifyStepManufacturingFeatures;
}>;

/**
 * Pure G1/G2 boundary. Its deliberately narrow arguments keep stock, WCS,
 * material, tools and capability revisions out of geometry recomputation.
 */
export function createStepAdvisorGeometryPipeline(producers:StepAdvisorGeometryProducers){
  return(summary:ImportSummary,orientation:PartOrientation):StepAdvisorGeometryPipelineResult=>{
    const inventoryResult=producers.buildInventory(summary,orientation);
    return{inventoryResult,classificationResult:inventoryResult.ok?producers.classifyInventory(inventoryResult.inventory):null};
  };
}

export const buildStepAdvisorGeometryPipeline=createStepAdvisorGeometryPipeline({
  buildInventory:buildStepManufacturingFeatureInventory,
  classifyInventory:classifyStepManufacturingFeatures,
});
