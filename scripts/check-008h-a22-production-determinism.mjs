import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const need=(text,token,message)=>{if(!text.includes(token))throw new Error(message);};
const forbid=(text,token,message)=>{if(text.includes(token))throw new Error(message);};

const probe=read('src/lib/threeDRoughingProductionDeterminismProbe.ts');
const app=read('src/App.svelte');

need(probe,"buildThreeDRoughingOperationState","A22 must call the production 3D roughing operation builder.");
need(probe,"const firstA=signature(build(operationA));","A22 must build A first.");
need(probe,"const middleB=signature(build(operationB));","A22 must build B between both A builds.");
need(probe,"const secondA=signature(build(operationA));","A22 must rebuild the exact A input.");
need(probe,"deterministic:same(firstA,secondA)","A22 must compare both A production signatures.");
need(probe,"diameterA??6","A22 reference A diameter must default to 6 mm.");
need(probe,"diameterB??3","A22 intervening B diameter must default to 3 mm.");
need(probe,"[008H-A22][3D-production-determinism]","A22 result must be observable.");
need(app,"next.kind==='3d-roughing'","A22 must be connected only to 3D roughing editing.");
need(app,"Math.abs(value-6)<=1e-9","A22 real-world probe must run on the reproduced 6 mm edit.");
need(app,"buildThreeDRoughingProductionDeterminismProbe({summary:importSummary,stock,placement,orientation,wcs,operation:next,diameterA:6,diameterB:3})","A22 must use the live production inputs from the diameter edit path.");

forbid(probe,"buildThreeDRoughingPipeline(","A22 must test through the production operation builder, not bypass it.");
forbid(probe,"roughingMode","A22 must not reintroduce legacy roughing mode semantics.");
forbid(probe,"ballnoseContactAt","A22 must not alter cutter truth.");

console.log('008H-A22 production determinism probe contract PASS');
