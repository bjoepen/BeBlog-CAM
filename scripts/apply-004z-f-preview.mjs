import fs from 'node:fs';
function patch(path,edits){let t=fs.readFileSync(path,'utf8');for(const [from,to,label] of edits){if(!t.includes(from))throw new Error(`${path}: ${label}`);t=t.replace(from,to);}fs.writeFileSync(path,t);}

patch('src/lib/GeometryView.svelte',[
[`    const jobToolWorld=jobToolpaths.flatMap(path=>path.runs.map(run=>run.points.map(point=>({x:point.x+wp.x,y:point.y+wp.y,z:run.z+wp.z}))));`,`    const jobToolWorld=jobToolpaths.flatMap(toolpath=>toolpath.runs.flatMap(run=>run.cutSegments3?.length?run.cutSegments3.map(segment=>sampleMachineMotion(segment).map(point=>({x:point.x+wp.x,y:point.y+wp.y,z:point.z+wp.z}))):[run.points.map(point=>({x:point.x+wp.x,y:point.y+wp.y,z:run.z+wp.z}))]));`,'STEP 3D preview must prefer spatial tab cuts'],
[`    const canonicalRuns=renderToolpaths.flatMap(toolpath=>toolpath.runs.map(run=>({z:run.z,points:sampleRunPoints(run).map(point=>project({...fromWcs2(point),z:run.z}))})));`,`    const canonicalRuns=renderToolpaths.flatMap(toolpath=>toolpath.runs.flatMap(run=>run.cutSegments3?.length?run.cutSegments3.map(segment=>({z:segment.end.z,points:sampleMachineMotion(segment).map(point=>{const xy=fromWcs2(point);return project({x:xy.x,y:xy.y,z:point.z})})})):[{z:run.z,points:sampleRunPoints(run).map(point=>project({...fromWcs2(point),z:run.z}))}]));`,'2D/2.5D preview must prefer spatial tab cuts']
]);

const gate='scripts/check-004z-contracts.mjs';let g=fs.readFileSync(gate,'utf8');
const anchor=`requireText(app,'STEP auch für offene Konturen','Bearbeiten explains open STEP tab support');`;
const add=`${anchor}\nrequireText(geometryView,'run.cutSegments3?.length?run.cutSegments3.map(segment=>sampleMachineMotion(segment)','004Z-F STEP preview renders spatial tab lifts instead of flattening them to run.z');\nrequireText(geometryView,'run.cutSegments3?.length?run.cutSegments3.map(segment=>({z:segment.end.z,points:sampleMachineMotion(segment)','004Z-F 2D/2.5D preview also preserves tab Z motion');`;
if(!g.includes(anchor))throw new Error('004Z-F gate anchor');g=g.replace(anchor,add);fs.writeFileSync(gate,g);
