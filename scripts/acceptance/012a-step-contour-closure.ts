import { chainSegments } from '../../src/lib/stepSideFaceContour';
import { offsetPolygon, validateOffsetSegments } from '../../src/lib/contourMath';
import { buildStepContourOperationState } from '../../src/lib/stepContourOperation';
import { defaultContourOperation, defaultPartOrientation, defaultPartPlacement, defaultWcs, type ImportSummary } from '../../src/lib/types';
const a={x:0,y:0},b={x:40,y:0},c={x:40,y:30},d={x:0,y:30};
const s=(edgeId:number,p:{x:number;y:number},q:{x:number;y:number})=>({edgeId,points:[p,q]});
const three=chainSegments([s(1,a,b),s(2,b,c),s(3,c,d)]);
if(!three||three.topology!=='open'||three.edgeIds.length!==3)throw Error('3 faces must remain open');
const four=chainSegments([s(1,a,b),s(3,c,d),s(4,d,a),s(2,b,c)]);
if(!four||four.topology!=='closed'||four.edgeIds.length!==4)throw Error('4 faces must form closed ring');
const offset=offsetPolygon(four.points,1.5);
if(!validateOffsetSegments(four.points,offset,1.5,.01).ok)throw Error('closed contour offset geometry failed');
const disconnected=chainSegments([s(1,a,b),s(7,{x:100,y:100},{x:120,y:100})]);
if(disconnected!==null)throw Error('disconnected geometry must fail closed');
console.log('012-A STEP contour open/closed chain: PASS');

/** Minimal synthetic native-BRep manufacturing topology; no dependence on an OCCT runtime. */
const xy=[[0,0],[40,0],[40,30],[0,30]] as const;
const faces=xy.map((_,i)=>({faceId:i,kind:'plane' as const,orientation:'forward' as const,origin:[...xy[i],0] as [number,number,number],normal:([ [0,-1,0],[1,0,0],[0,1,0],[-1,0,0] ] as [number,number,number][])[i]}));
const edges=xy.map((point,i)=>({edgeId:i,kind:'line' as const,orientation:'forward' as const,start:[...point,0] as [number,number,number],end:[...xy[(i+1)%4],0] as [number,number,number],closed:false,degenerated:false}));
const wires=xy.map((_,i)=>({wireId:i,faceId:i,orientation:'forward' as const,closed:false,edgeIds:[i]}));
const summary:ImportSummary={
  kind:'step',fileName:'012a-synthetic-rectangle.step',backend:'native-test',status:'ready',entities:{},
  brep:{backend:'native-test',nativeBrep:true,faces:4,edges:4,vertices:8,solids:1,
    surfaceTypes:[],cylinderRadiiMm:[],displayTriangles:0,
    displayVertices:[0,0,-10,40,0,-10,40,30,-10,0,30,-10,0,0,0,40,0,0,40,30,0,0,30,0],note:'',
    manufacturingFaces:faces,manufacturingEdges:edges,manufacturingWires:wires} as ImportSummary['brep']
};
const setup={summary,stock:{width:40,height:30,thickness:10,offsetX:0,offsetY:0,offsetZ:0},stockMode:'manual' as const,placement:defaultPartPlacement,orientation:defaultPartOrientation,wcs:defaultWcs};
const operation={...defaultContourOperation,stepWireId:null,stepContourFaceIds:[0,1,2,3],excludedSegmentIds:[],topology:'closed' as const};
const ring=buildStepContourOperationState({...setup,operation});
if(!ring.ok||!ring.toolpath?.runs.length||!ring.toolpath.targetKey?.startsWith('step-side-faces:'))throw Error('closed side-face ring with null stepWireId must produce an operation toolpath: '+ring.errors.join('; '));
if(!ring.toolpath.runs.every(run=>run.points.length>2&&Math.hypot(run.points[0].x-run.points.at(-1)!.x,run.points[0].y-run.points.at(-1)!.y)<1e-4))throw Error('closed ring cutter runs must return to origin');
const wrongMode=buildStepContourOperationState({...setup,operation:{...operation,topology:'open'}});
if(wrongMode.ok||wrongMode.toolpath!==null)throw Error('closed ring in open mode must fail');
const incomplete=buildStepContourOperationState({...setup,operation:{...operation,stepContourFaceIds:[0,1,2]}});
if(incomplete.ok||incomplete.toolpath!==null)throw Error('partial side-face chain in closed mode must fail');
console.log('012-A canonical STEP contour operation target selection: PASS');

// 011-S1 regression: the STEP profile can sit below an unmachined stock top.
const recessedSummary: ImportSummary = {
  ...summary,
  brep: {
    ...summary.brep!,
    manufacturingEdges: summary.brep!.manufacturingEdges!.map(edge => ({
      ...edge,
      start: [edge.start[0], edge.start[1], -2] as [number,number,number],
      end: [edge.end[0], edge.end[1], -2] as [number,number,number]
    })),
    manufacturingFaces: summary.brep!.manufacturingFaces!.map(face => ({ ...face, origin: [face.origin[0], face.origin[1], -2] as [number,number,number] }))
  }
};
const recessedSetup = {...setup, summary: recessedSummary, stock: {...setup.stock, thickness: 12}};
const firstClosed = buildStepContourOperationState({...recessedSetup, operation});
if(!firstClosed.ok || !firstClosed.toolpath)throw Error('011-S1 first closed contour failed: '+firstClosed.errors.join('; '));
if(!firstClosed.warnings.some(w => w.includes('Rohlingoberseite Z 0.000')))throw Error('011-S1 first contour must use stock top, not recessed profile');
if(firstClosed.toolpath.runs[0].z >= 0 || firstClosed.toolpath.runs[0].z < -operation.stepDownMm - 1e-6)throw Error('011-S1 first pass must step down from stock top');
const firstOpen = buildStepContourOperationState({...recessedSetup, operation:{...operation,topology:'open',stepContourFaceIds:[0,1,2]}});
if(!firstOpen.ok || !firstOpen.toolpath)throw Error('011-S1 first open contour failed: '+firstOpen.errors.join('; '));
if(!firstOpen.warnings.some(w => w.includes('Rohlingoberseite Z 0.000')))throw Error('011-S1 open contour must use stock top');
if(firstOpen.toolpath.runs[0].z >= 0 || firstOpen.toolpath.runs[0].z < -operation.stepDownMm - 1e-6)throw Error('011-S1 open first pass must step down from stock top');
console.log('011-S1 initial stock-top STEP contours: PASS');
