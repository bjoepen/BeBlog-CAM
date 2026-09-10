import fs from 'node:fs';

const simulation=fs.readFileSync(new URL('../src/lib/jobPreviewSimulation.ts',import.meta.url),'utf8');
const view=fs.readFileSync(new URL('../src/lib/JobPreviewScene.svelte',import.meta.url),'utf8');

const forbidden=[
  'buildActiveCanonicalToolpath',
  'materializeSafeMotionChain',
  'buildJobSafeTransitions',
  'buildFacingToolpath',
  'buildStepContourOperationState',
  'buildPocketOperationState',
  'buildDrillCanonicalToolpath',
  'buildZLevelOperationState',
  'buildSurfaceFinishingOperationState',
  'validateJob'
];

for(const token of forbidden){
  if(simulation.includes(token)||view.includes(token))throw new Error(`005B contract violation: simulation contains forbidden CAM/Preflight dependency ${token}`);
}
if(!simulation.includes('for(const segment of scene.segments)'))throw new Error('005B contract violation: simulation timeline must consume the existing preview scene segments.');
if(!view.includes('buildJobPreviewSimulationTimeline(scene)'))throw new Error('005B integration missing: preview must simulate the existing 005A scene.');
if(!view.includes('Darstellungstempo · keine Zeitprognose'))throw new Error('005B UI must not imply real machining-time simulation.');
if(!view.includes("simulationFrame.currentStep?.segment.operationLabel"))throw new Error('005B must expose the current existing operation from the simulated scene.');
if(!view.includes('class:done='))throw new Error('005B must distinguish already traversed motion segments.');

console.log('005B contract PASS: simulation is a read-only playback of the existing Job Preview / Preflight motion truth.');
