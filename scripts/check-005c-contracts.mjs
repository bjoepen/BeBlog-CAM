import fs from 'node:fs';

const simulation=fs.readFileSync('src/lib/jobPreviewSimulation.ts','utf8');
const view=fs.readFileSync('src/lib/JobPreviewScene.svelte','utf8');

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

const checks=[
  ['005C derives operation navigation only from the existing simulation timeline',simulation.includes('buildJobPreviewOperationStops(timeline:JobPreviewSimulationTimeline)')&&simulation.includes('for(const step of timeline.steps)')],
  ['005C inspector consumes the existing preview simulation timeline',view.includes('buildJobPreviewOperationStops(timeline)')&&view.includes('buildJobPreviewSimulationTimeline(scene)')],
  ['005C exposes a direct job scrubber',view.includes('type="range"')&&view.includes('oninput={scrubSimulation}')&&view.includes('seekToDistance')],
  ['005C supports operation-level navigation without CAM reconstruction',view.includes('jumpToOperation')&&view.includes('jumpOperation(-1)')&&view.includes('jumpOperation(1)')],
  ['005C exposes precise inspector progress',view.includes('Motion {Math.min(currentMotionNumber,scene.motionCount)} / {scene.motionCount}')&&view.includes('jobDistanceLabel')],
  ['005C states its read-only contract',view.includes('Read-only, ohne CAM-Neuberechnung.')],
  ['005C simulation helper has no forbidden CAM dependencies',forbidden.every(name=>!simulation.includes(name))],
  ['005C view has no forbidden CAM dependencies',forbidden.every(name=>!view.includes(name))]
];

let failed=false;
for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 005C: ${label}`);if(!ok)failed=true;}
if(failed)process.exit(1);
console.log('005C contract PASS: Job Simulation Inspector is read-only navigation over the existing 005B timeline.');
