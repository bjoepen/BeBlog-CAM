import fs from 'node:fs';

const path='src/lib/GeometryView.svelte';
let text=fs.readFileSync(path,'utf8');
const from="const triangles=projectTriangles(part,v,map,faceIds),edges=ep.map(edge=>({edgeId:edge.edgeId,d:path(edge.points.map(map))})).filter(edge=>Boolean(edge.d));";
const to="const triangles=projectTriangles(part,v,map,faceIds);\n    const visibleFaceIds=new Set(triangles.map(triangle=>triangle.faceId));\n    const visibleEdgeIds=new Set<number>();\n    if(stepFeatureSourceResult?.ok){for(const faceId of visibleFaceIds)for(const wire of stepFeatureSourceResult.source.wiresByFace.get(faceId)??[])for(const edgeId of wire.edgeIds)visibleEdgeIds.add(edgeId);}\n    const edges=ep.filter(edge=>!stepFeatureSourceResult?.ok||visibleEdgeIds.has(edge.edgeId)).map(edge=>({edgeId:edge.edgeId,d:path(edge.points.map(map))})).filter(edge=>Boolean(edge.d));";
if(!text.includes(from))throw new Error('GeometryView visible-edge patch anchor missing');
text=text.replace(from,to);
fs.writeFileSync(path,text);
console.log('004Z visible-face viewport patch applied.');
