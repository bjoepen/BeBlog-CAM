import type { ImportSummary,PartOrientation,PartPlacement,StockDefinition,WorkCoordinateSystem,ZLevelRoughingOperation } from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import { orientPoint3 } from './partOrientation';
import type { P3 } from './stepView';
import { sliceTrianglesAtZ, sliceFaceSegmentsAtZ, type ZLevelFaceSegment } from './zLevelSlice';
import { buildModelSliceRegions } from './modelSliceRegion';
import { buildRoughingRegions, type RoughingRegion } from './roughingRegion';
import { buildModelRoughingCanonicalToolpath } from './modelRoughingToolpath';
import { isPlanarRasterPointSafe } from './planarRasterKernel';
import type { ZLevelPerformanceProfile } from './zLevelPerformance';

export type ModelRoughingOperationState={ok:boolean;toolpath:CanonicalToolpath|null;levelCount:number;roughingRegionCount:number;errors:string[];warnings:string[]};
const EPS=1e-6;
function bounds(p:P3[]){const x=p.map(q=>q.x),y=p.map(q=>q.y),z=p.map(q=>q.z);return{minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y),minZ:Math.min(...z),maxZ:Math.max(...z)}}
function placedPart(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation):P3[]|null{
  if(summary.kind!=='step')return null;const v=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<v.length;i+=3)raw.push(orientPoint3({x:v[i],y:v[i+1],z:v[i+2]},orientation));if(!raw.length)return null;
  const b=bounds(raw),pw=b.maxX-b.minX,ph=b.maxY-b.minY,tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-pw:(stock.width-pw)/2,ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-ph:(stock.height-ph)/2,dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;
  return raw.map(p=>({x:p.x+dx,y:p.y+dy,z:p.z-b.minZ+placement.offsetZ}));
}
function origin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0}}
function levels(top:number,bottom:number,step:number){const out:number[]=[];for(let z=top-step;z>bottom+1e-3;z-=step)out.push(z);const last=bottom+1e-3;if(last<top-EPS&&(out.length===0||Math.abs(out[out.length-1]-last)>1e-4))out.push(last);return out}
type FaceScope={triangles:P3[];minZ:number;maxZ:number};
type FaceScopeGroup={faceId:number;scope:FaceScope};
function selectedFaceScope(part:P3[],faceIds:number[],selectedFaceIds:number[]):FaceScope|null{
  const selected=new Set(selectedFaceIds),triangles:P3[]=[];
  for(let t=0;t<faceIds.length&&t*3+2<part.length;t++){
    if(selected.has(faceIds[t]))triangles.push(part[t*3],part[t*3+1],part[t*3+2]);
  }
  if(!triangles.length)return null;
  const b=bounds(triangles);
  return{triangles,minZ:b.minZ,maxZ:b.maxZ};
}
function selectedFaceScopeGroups(part:P3[],faceIds:number[],selectedFaceIds:number[]):FaceScopeGroup[]{
  const groups:FaceScopeGroup[]=[];
  for(const faceId of [...new Set(selectedFaceIds)]){
    const scope=selectedFaceScope(part,faceIds,[faceId]);
    if(scope)groups.push({faceId,scope});
  }
  return groups;
}
function pointSegmentDistance2(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number}){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<=EPS*EPS)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function clipSegmentToFaceSlice(a:{x:number;y:number},b:{x:number;y:number},segments:ZLevelFaceSegment[],contactRadius:number){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<=EPS)return[];
  const step=Math.max(0.05,Math.min(0.25,contactRadius/6||0.1));
  const count=Math.max(1,Math.ceil(length/step));
  const at=(t:number)=>({x:a.x+dx*t,y:a.y+dy*t});
  const inside=(t:number)=>segments.some(segment=>pointSegmentDistance2(at(t),segment.a,segment.b)<=contactRadius+EPS);
  const intervals:[number,number][]=[];
  let t0=0,in0=inside(0),open=in0?0:null as number|null;
  for(let i=1;i<=count;i++){
    const t1=i/count,in1=inside(t1);
    if(in1!==in0){
      let lo=t0,hi=t1;
      for(let n=0;n<18;n++){const mid=(lo+hi)/2;if(inside(mid)===in0)lo=mid;else hi=mid}
      const edge=(lo+hi)/2;
      if(in0&&open!=null){intervals.push([open,edge]);open=null}else if(in1)open=edge;
    }
    t0=t1;in0=in1;
  }
  if(in0&&open!=null)intervals.push([open,1]);
  return intervals.filter(([u,v])=>v-u>1e-7).map(([u,v])=>[at(u),at(v)] as [{x:number;y:number},{x:number;y:number}]);
}
function clipToolpathToSelectedFaceSlices(toolpath:CanonicalToolpath,part:P3[],faceIds:number[],selectedFaceIds:number[],o:P3,contactRadius:number,allowance:number,profile?:ZLevelPerformanceProfile):CanonicalToolpath{
  const runs:CanonicalToolpath['runs']=[];
  for(const run of toolpath.runs){
    // Use the same allowance-shifted Z plane as the solid slice that created
    // this roughing region. Face ownership and Stock−Model truth therefore
    // refer to one identical geometric section.
    const sliceZ=Math.max(0,run.z+o.z-allowance);
    const segments=sliceFaceSegmentsAtZ(part,faceIds,selectedFaceIds,sliceZ,profile);
    if(!segments.length)continue;
    let current:typeof run.points=[];
    const flush=()=>{if(current.length>=2)runs.push({...run,points:current,retractAfter:true});current=[]};
    for(let i=1;i<run.points.length;i++){
      const aw={x:run.points[i-1].x+o.x,y:run.points[i-1].y+o.y};
      const bw={x:run.points[i].x+o.x,y:run.points[i].y+o.y};
      const pieces=clipSegmentToFaceSlice(aw,bw,segments,contactRadius);
      if(!pieces.length){flush();continue}
      for(const [wa,wb] of pieces){
        const pa={x:wa.x-o.x,y:wa.y-o.y},pb={x:wb.x-o.x,y:wb.y-o.y},last=current.at(-1);
        if(!last||Math.hypot(last.x-pa.x,last.y-pa.y)>1e-5){flush();current=[pa]}
        if(Math.hypot(current.at(-1)!.x-pb.x,current.at(-1)!.y-pb.y)>EPS)current.push(pb);
      }
    }
    flush();
  }
  return{...toolpath,runs};
}
function islandLoops(i:RoughingRegion['islands'][number]){return[{points:i.outer},...i.holes.map(points=>({points}))]}
function safeInRegion(r:RoughingRegion,p:{x:number;y:number},d:number,profile?:ZLevelPerformanceProfile){return r.islands.some(i=>{if(profile)profile.accessibilityRegionTests++;return isPlanarRasterPointSafe(islandLoops(i),p,d,profile)})}
function accessErrors(toolpath:CanonicalToolpath,regions:RoughingRegion[],o:P3,d:number,profile?:ZLevelPerformanceProfile){
  const ordered=[...regions].filter(r=>r.valid).sort((a,b)=>b.z-a.z),sample=Math.max(.15,Math.min(.75,d/8));
  for(const run of toolpath.runs){const wz=run.z+o.z,higher=ordered.filter(r=>r.z>wz+1e-5);for(let i=1;i<run.points.length;i++){const a=run.points[i-1],b=run.points[i],dist=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(dist/sample));for(let k=0;k<=steps;k++){if(profile)profile.accessibilitySamples++;const t=k/steps,p={x:a.x+(b.x-a.x)*t+o.x,y:a.y+(b.y-a.y)*t+o.y},blocked=higher.find(r=>!safeInRegion(r,p,d,profile));if(blocked)return[`Top-Zugänglichkeit verletzt: Bahn Z ${wz.toFixed(3)} mm bei X ${p.x.toFixed(3)} / Y ${p.y.toFixed(3)} mm ist durch Ebene Z ${blocked.z.toFixed(3)} mm blockiert.`]}}}
  return[];
}
export function buildModelRoughingOperationState(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ZLevelRoughingOperation;profile?:ZLevelPerformanceProfile;scopeToSelectedFaces?:boolean;}):ModelRoughingOperationState{
  const {summary,stock,placement,orientation,wcs,operation,profile}=args,errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='step')errors.push('Modell-Schruppen benötigt ein STEP/BRep-Modell.');if(wcs.z!=='top')errors.push('Modell-Schruppen benötigt WCS Z auf der Rohlingoberseite.');if(!(operation.finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');if(!(operation.stepDownMm>0))errors.push('Zustellung muss größer als 0 sein.');
  if(errors.length)return{ok:false,toolpath:null,levelCount:0,roughingRegionCount:0,errors,warnings};
  const part=placedPart(summary,stock,placement,orientation);if(!part)return{ok:false,toolpath:null,levelCount:0,roughingRegionCount:0,errors:['STEP/BRep-Triangulation konnte nicht rekonstruiert werden.'],warnings};
  const b=bounds(part);if(b.minZ<-EPS||b.maxZ>stock.thickness+EPS)errors.push(`Bauteil Z ${b.minZ.toFixed(3)}…${b.maxZ.toFixed(3)} mm liegt nicht vollständig im Rohling 0…${stock.thickness.toFixed(3)} mm.`);
  const faceIds=summary.brep?.displayFaceIds??[];
  const selected=args.scopeToSelectedFaces?selectedFaceScope(part,faceIds,operation.faceIds):null;
  if(args.scopeToSelectedFaces&&!selected)errors.push('Gewählte STEP/BRep-Zielflächen konnten nicht als Z-Level-Bearbeitungsbereich rekonstruiert werden.');
  const allowance=Math.max(0,operation.finishAllowanceMm);
  const bottom=(selected?.minZ??b.minZ)+allowance;
  const zs=levels(stock.thickness,bottom,operation.stepDownMm);if(!zs.length)errors.push('Keine Z-Level zwischen Rohlingoberseite und Zielbereich vorhanden.');if(errors.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:0,errors,warnings};
  // 008H True Z-Level: each cutting plane is derived from an actual solid slice.
  // For stock allowance, sample the solid lower by the allowance. Together with
  // the enlarged XY clearance disk this forms a conservative 3D envelope around
  // the nominal model instead of a mere Z offset.
  const slices=zs.map(cutZ=>{const slice=sliceTrianglesAtZ(part,Math.max(b.minZ,cutZ-allowance),profile);return{...slice,z:cutZ}});
  const model=buildModelSliceRegions(slices);
  // 008H-E: the stock boundary is a material boundary, not a collision wall.
  // A flat endmill must be allowed to overhang a stock edge by its clearance
  // radius in order to machine model geometry that reaches that edge. The
  // planar raster kernel subsequently erodes the roughing region by the same
  // clearance radius. Expanding the temporary stock-domain by twice that radius
  // leaves one clearance radius of legal cutter-centre overhang beyond the real
  // stock. Model boundaries remain untouched and therefore retain the full
  // cutter-radius + allowance protection.
  const toolRadius=operation.tool.diameterMm/2;
  const clearanceRadius=toolRadius+allowance;
  const rasterStock={
    minX:-2*clearanceRadius,
    minY:-2*clearanceRadius,
    maxX:stock.width+2*clearanceRadius,
    maxY:stock.height+2*clearanceRadius,
  };
  const rough=buildRoughingRegions(model,rasterStock),invalid=rough.filter(r=>!r.valid);
  if(invalid.length){errors.push(`${invalid.length} Stock−Model-Ebene${invalid.length===1?' ist':'n sind'} ungültig.`);for(const r of invalid)for(const e of r.errors)errors.push(`Z ${r.z.toFixed(3)}: ${e}`)}
  if(errors.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings};
  const o=origin(stock,wcs);
  // 008H-K: selected-face ownership comes from actual face/Z intersection
  // segments on the exact allowance-shifted solid slice plane. No global or
  // Z-filtered XY face projection participates in CAM scope any more.
  // The full solid remains the only material/safety truth; face scope only
  // filters already-safe motion by triangles that can physically participate
  // at that level. This removes the asymmetric global-XY-shadow behaviour.
  // 008H-I: finish allowance belongs to the complete-solid safety envelope.
  // Face selection only expresses cutter-contact intent, so its XY reach is the
  // physical cutter radius, not cutter radius + allowance. Adding allowance a
  // second time here displaced accepted paths away from the selected surface.
  // The generated solid-safe cutter centre is clearanceRadius away from the
  // nominal model when finish allowance is requested. Face intent must accept
  // that intentional gap; this radius filters ownership only and cannot create
  // motion outside the already-safe Stock−Model candidate.
  const faceContactRadius=clearanceRadius;
  const buildDirection=(direction:'x'|'y',scope:FaceScope|null=selected,scopeFaceIds:number[]=operation.faceIds)=>{
    const candidateWarnings:string[]=[];
    const candidateErrors:string[]=[];
    const built=buildModelRoughingCanonicalToolpath(rough,operation.tool.diameterMm,operation.stepoverPercent,o,profile,allowance,direction);
    candidateWarnings.push(...built.warnings);
    candidateErrors.push(...built.errors);
    if(!built.ok||!built.toolpath)return{direction,toolpath:null as CanonicalToolpath|null,errors:candidateErrors,warnings:candidateWarnings};
    let candidate=built.toolpath;
    if(scope){
      candidate=clipToolpathToSelectedFaceSlices(candidate,part,faceIds,scopeFaceIds,o,faceContactRadius,allowance,profile);
      if(!candidate.runs.length)candidateErrors.push('Im Werkzeugkontakt-Bereich der gewählten Faces blieb keine sichere True-Z-Level-Schruppbahn übrig.');
    }
    if(candidate.runs.length)candidateErrors.push(...accessErrors(candidate,rough,o,operation.tool.diameterMm+2*allowance,profile));
    return{direction,toolpath:candidateErrors.length?null:candidate,errors:candidateErrors,warnings:candidateWarnings};
  };
  const pathLength=(toolpath:CanonicalToolpath)=>toolpath.runs.reduce((sum,run)=>sum+run.points.slice(1).reduce((runSum,p,i)=>runSum+Math.hypot(p.x-run.points[i].x,p.y-run.points[i].y),0),0);
  const chooseCandidate=(candidates:ReturnType<typeof buildDirection>[])=>{
    const valid=candidates.filter(candidate=>candidate.toolpath&&!candidate.errors.length);
    valid.sort((a,b)=>{
      const ar=a.toolpath!.runs.length,br=b.toolpath!.runs.length;
      if(ar!==br)return ar-br;
      const aa=pathLength(a.toolpath!)/Math.max(1,ar),ba=pathLength(b.toolpath!)/Math.max(1,br);
      if(Math.abs(aa-ba)>1e-6)return ba-aa;
      return a.direction.localeCompare(b.direction);
    });
    return valid[0]??null;
  };
  const requestedDirection=operation.rasterDirection??'auto';
  let toolpath:CanonicalToolpath|null=null;
  if(requestedDirection==='auto'&&selected){
    // 008H-H: Auto is local manufacturing strategy. Each selected BRep face
    // chooses X/Y independently, because one operation may contain orthogonal
    // long/short fillets. Every local candidate still passes the complete-solid
    // safety and accessibility chain before it can contribute canonical runs.
    const groups=selectedFaceScopeGroups(part,faceIds,operation.faceIds);
    const combinedRuns:CanonicalToolpath['runs']=[];
    const decisions:string[]=[];
    for(const group of groups){
      const candidates=[buildDirection('x',group.scope,[group.faceId]),buildDirection('y',group.scope,[group.faceId])];
      const chosen=chooseCandidate(candidates);
      if(!chosen||!chosen.toolpath){
        errors.push(`Face ${group.faceId}: keine freigabefähige automatische Rasterrichtung.`);
        for(const candidate of candidates)errors.push(...candidate.errors);
        continue;
      }
      combinedRuns.push(...chosen.toolpath.runs);
      warnings.push(...chosen.warnings);
      const x=candidates[0],y=candidates[1];
      const describe=(candidate:typeof chosen)=>candidate.toolpath?`${candidate.direction.toUpperCase()}: ${candidate.toolpath.runs.length} Bahnen · Ø ${(pathLength(candidate.toolpath)/Math.max(1,candidate.toolpath.runs.length)).toFixed(1)} mm`:`${candidate.direction.toUpperCase()}: nicht freigabefähig`;
      decisions.push(`Face ${group.faceId} → ${chosen.direction.toUpperCase()} (${describe(x)}; ${describe(y)})`);
    }
    if(errors.length||!combinedRuns.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
    const template=[buildDirection('x'),buildDirection('y')].find(candidate=>candidate.toolpath)?.toolpath;
    if(!template)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:['008H-H: kanonische Z-Level-Metadaten konnten nicht materialisiert werden.'],warnings:[...new Set(warnings)]};
    toolpath={...template,runs:combinedRuns};
    warnings.push(`008H-H: Rasterrichtung Auto lokal pro Ziel-Face gewählt: ${decisions.join(' · ')}.`);
  }else{
    const candidates=requestedDirection==='auto'?[buildDirection('x'),buildDirection('y')]:[buildDirection(requestedDirection)];
    const chosen=chooseCandidate(candidates);
    if(!chosen||!chosen.toolpath){
      for(const candidate of candidates){errors.push(...candidate.errors);warnings.push(...candidate.warnings)}
      return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
    }
    toolpath=chosen.toolpath;
    warnings.push(...chosen.warnings);
    if(requestedDirection==='auto')warnings.push(`008H-G: Rasterrichtung Auto → ${chosen.direction.toUpperCase()} gewählt.`);
  }
  if(selected)warnings.push('008H: Ziel-Faces begrenzen den Bearbeitungsbereich über ihren Werkzeugkontakt-Bereich (echte Face/Z-Schnittsegmente auf derselben Solid-Schnittebene + Werkzeug-Clearance; keine projizierte 3D-Face-Geometrie); Kollisions- und Materialwahrheit stammt aus dem vollständigen STEP-Solid. Rohlingkanten sind Materialgrenzen und erlauben werkzeugradius-sicheren Fräserüberhang.');
  return{ok:true,toolpath:toolpath!,levelCount:zs.length,roughingRegionCount:rough.length,errors:[],warnings:[...new Set(warnings)]};
}
