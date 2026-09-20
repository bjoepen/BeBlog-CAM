import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A14 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A14 contract failed: ${l}`);};

const part=read('src/lib/partSafetySurface.ts');
const a3=read('src/lib/endMillRoughingSafety.ts');
const reachability=read('src/lib/flatEndCutterReachability.ts');
const a4=read('src/lib/threeDRoughingLevelEligibility.ts');
const a6=read('src/lib/threeDRoughingSafeChains.ts');
const a10=read('src/lib/threeDRoughingPipeline.ts');
const op=read('src/lib/threeDRoughingOperation.ts');

need(part,'export function partSafetyUpperZAt','complete-part upper-envelope query missing');
need(part,'if(!bc)continue','vertical/XY-degenerate triangles must not invalidate the complete part envelope');
need(part,'if(Number.isFinite(z)&&(upper===null||z>upper))upper=z','part safety must choose the upper projected shell');
need(reachability,'curvedFaceTargetZAt(target,x,y)','selected target must still own cutter-centre machining intent');
need(reachability,'partSafetyUpperZAt(partSafety,x+dx,y+dy)','cutter disk must use complete Part Safety Truth');
need(a3,'flatEndCutterReachabilityAt(','A3 must consume the explicit cutter reachability truth');
forbid(a3,'Fräser-Stirnfläche ist nicht vollständig durch die ausgewählte 3D-Zielfläche belegt.','selected-face footprint must no longer be cutter-disk coverage truth');
need(a4,'endMillRoughingSafetyAt(target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm)','A4 must consume A14 through A3');
need(a6,'endMillRoughingSafetyAt(target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm)','A6 must re-prove with the identical A14/A3 truth');
need(a10,'target:CurvedFaceTarget;\n  partSafety:PartSafetySurface;','A10 must carry target and part safety as separate truths');
need(op,'buildPlacedPartTriangles(summary,stock,placement,orientation)','operation must derive Part Safety Truth from the complete placed part');
need(op,'translatePartSafetySurface(buildPartSafetySurface(placedPart),{x:-origin.x,y:-origin.y,z:-origin.z})','Part Safety Truth must share A13 WCS normalization');
need(op,'buildThreeDRoughingPipeline({target:wcsTarget,partSafety,stock,wcs,operation})','pipeline must receive both truths explicitly');
for(const source of [part,reachability,a3,a4,a6,a10,op])for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','ballnoseContactAt'])forbid(source,forbidden,`forbidden geometry shortcut ${forbidden}`);

console.log('008H-A14 part-aware cutter safety contract PASS');
