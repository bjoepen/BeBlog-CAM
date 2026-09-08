import fs from 'node:fs';

const path='src/lib/GeometryView.svelte';
let text=fs.readFileSync(path,'utf8');

const edgeFrom=`    const triangles=projectTriangles(part,v,map,faceIds);\n    const visibleFaceIds=new Set(triangles.map(triangle=>triangle.faceId));\n    const visibleEdgeIds=new Set<number>();\n    if(stepFeatureSourceResult?.ok){for(const faceId of visibleFaceIds)for(const wire of stepFeatureSourceResult.source.wiresByFace.get(faceId)??[])for(const edgeId of wire.edgeIds)visibleEdgeIds.add(edgeId);}\n    const edges=ep.filter(edge=>!stepFeatureSourceResult?.ok||visibleEdgeIds.has(edge.edgeId)).map(edge=>({edgeId:edge.edgeId,d:path(edge.points.map(map))})).filter(edge=>Boolean(edge.d));`;
const edgeTo=`    const triangles=projectTriangles(part,v,map,faceIds);\n    // Generic BRep edges are deliberately not overlaid on top of the opaque shell:\n    // that made hidden rear edges look like an X-ray view. Only edges that are\n    // actively part of contour editing remain visible/refinable.\n    const edges=ep.filter(edge=>stepEdgeSelectable(edge.edgeId)||stepEdgeExcluded(edge.edgeId)).map(edge=>({edgeId:edge.edgeId,d:path(edge.points.map(map))})).filter(edge=>Boolean(edge.d));`;
if(!text.includes(edgeFrom))throw new Error('004Z solid-view edge anchor missing');
text=text.replace(edgeFrom,edgeTo);

const helperAnchor=`  function faceKey(e:KeyboardEvent,faceId:number){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleFace(faceId)}}\n`;
const helper=`  function faceKey(e:KeyboardEvent,faceId:number){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleFace(faceId)}}\n  function pointInTriangle(p:P2,t:P2[]){\n    if(t.length!==3)return false;\n    const [a,b,c]=t;\n    const sign=(p1:P2,p2:P2,p3:P2)=>(p1.x-p3.x)*(p2.y-p3.y)-(p2.x-p3.x)*(p1.y-p3.y);\n    const d1=sign(p,a,b),d2=sign(p,b,c),d3=sign(p,c,a);\n    const hasNeg=d1<-.001||d2<-.001||d3<-.001,hasPos=d1>.001||d2>.001||d3>.001;\n    return !(hasNeg&&hasPos);\n  }\n  function pointerSvgPoint(e:MouseEvent):P2|null{\n    const matrix=viewport?.getScreenCTM();if(!matrix)return null;\n    const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());\n    return{x:point.x,y:point.y};\n  }\n  function pickVisibleFace(e:MouseEvent){\n    if(summary.kind!=='step'||dragMoved||!s3?.facePickingAvailable)return;\n    const target=e.target as Element|null;if(target?.closest?.('.step-edge-hit'))return;\n    const p=pointerSvgPoint(e);if(!p)return;\n    // s3.triangles is painter ordered far -> near. Iterate backwards so the\n    // visually topmost triangle wins. Hidden faces can therefore never be picked.\n    for(let i=s3.triangles.length-1;i>=0;i--){const triangle=s3.triangles[i];if(!pointInTriangle(p,triangle.points))continue;toggleFace(triangle.faceId);return;}\n  }\n`;
if(!text.includes(helperAnchor))throw new Error('004Z solid-view helper anchor missing');
text=text.replace(helperAnchor,helper);

const svgFrom=`  <svg bind:this={viewport} viewBox="0 0 1000 650" class:interactive={summary.kind==='step'||(summary.kind==='dxf'&&drillViewMode==='25d')}>`;
const svgTo=`  <svg bind:this={viewport} viewBox="0 0 1000 650" class:interactive={summary.kind==='step'||(summary.kind==='dxf'&&drillViewMode==='25d')} onclick={pickVisibleFace}>`;
if(!text.includes(svgFrom))throw new Error('004Z solid-view svg anchor missing');
text=text.replace(svgFrom,svgTo);

const faceInteraction=' tabindex="-1" onclick={()=>toggleFace(triangle.faceId)} onkeydown={(e)=>faceKey(e,triangle.faceId)}';
if(!text.includes(faceInteraction))throw new Error('004Z solid-view face interaction anchor missing');
text=text.replace(faceInteraction,'');

const edgeClickFrom=`onclick={()=>toggleStepEdge(edge.edgeId)}`;
const edgeClickTo=`onclick={(e)=>{e.stopPropagation();toggleStepEdge(edge.edgeId)}}`;
if(!text.includes(edgeClickFrom))throw new Error('004Z solid-view edge click anchor missing');
text=text.replaceAll(edgeClickFrom,edgeClickTo);

const cssFrom=`.step-face{stroke:none;outline:none;pointer-events:none}.step-face.selectable-face{pointer-events:visiblePainted;cursor:pointer}`;
const cssTo=`.step-face{stroke:none;outline:none;pointer-events:none}.step-face.selectable-face{cursor:pointer}`;
if(!text.includes(cssFrom))throw new Error('004Z solid-view CSS anchor missing');
text=text.replace(cssFrom,cssTo);

fs.writeFileSync(path,text);
console.log('004Z solid visible-face picking patch applied.');
