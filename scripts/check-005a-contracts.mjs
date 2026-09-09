import fs from 'node:fs';

const adapter=fs.readFileSync(new URL('../src/lib/jobPreviewScene.ts',import.meta.url),'utf8');
const view=fs.readFileSync(new URL('../src/lib/JobPreviewScene.svelte',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../src/lib/JobPreflightPanel.svelte',import.meta.url),'utf8');

const forbidden=[
  'buildActiveCanonicalToolpath',
  'materializeSafeMotionChain',
  'buildJobSafeTransitions',
  'buildFacingToolpath',
  'buildStepContourOperationState',
  'buildPocketOperationState',
  'buildDrillCanonicalToolpath',
  'buildZLevelOperationState',
  'buildSurfaceFinishingOperationState'
];

for(const token of forbidden){
  if(adapter.includes(token)||view.includes(token))throw new Error(`005A contract violation: preview contains forbidden CAM/Safe-Motion dependency ${token}`);
}
if(!adapter.includes('operation.toolpath?.motions??[]'))throw new Error('005A contract violation: scene adapter must read materialized preflight motions directly.');
if(!panel.includes("import JobPreviewScene from './JobPreviewScene.svelte'"))throw new Error('005A integration missing from JobPreflightPanel.');
if(!view.includes('Keine CAM-Neuberechnung')&&!panel.includes('Keine CAM-Neuberechnung'))throw new Error('005A UI must state its read-only motion contract.');

console.log('005A contract PASS: Job Preview is a read-only consumer of materialized JobPreflight motions.');
