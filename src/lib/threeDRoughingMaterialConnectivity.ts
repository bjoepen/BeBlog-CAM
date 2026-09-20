import type {
  ThreeDRoughingEligibilitySample,
  ThreeDRoughingLevelEligibility,
} from './threeDRoughingLevelEligibility';

export type ThreeDRoughingMaterialComponent={
  id:number;
  cutZ:number;
  samples:ThreeDRoughingEligibilitySample[];
  bounds:{minX:number;maxX:number;minY:number;maxY:number};
};

export type ThreeDRoughingMaterialConnectivity={
  valid:boolean;
  cutZ:number;
  components:ThreeDRoughingMaterialComponent[];
  removableSampleCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;
const key=(x:number,y:number)=>`${x.toPrecision(15)}|${y.toPrecision(15)}`;

function uniqueSorted(values:number[]){
  return [...new Set(values.map(value=>Number(value.toPrecision(15))))].sort((a,b)=>a-b);
}

/**
 * 008H-A5: sampled material-connectivity truth for one approved A4 level.
 *
 * This stage groups only A4 REMOVABLE samples into orthogonally connected
 * components. PROTECTED and UNRESOLVED samples are hard barriers. Diagonal
 * contact alone is not connectivity. No interpolation, region polygons,
 * cutting chains, toolpaths or machine motions are created here.
 */
export function buildThreeDRoughingMaterialConnectivity(
  level:ThreeDRoughingLevelEligibility,
):ThreeDRoughingMaterialConnectivity{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!level.valid)errors.push('3D-Schrupp-Level-Eligibility ist ungültig.');
  if(!Number.isFinite(level.cutZ))errors.push('Z-Level muss endlich sein.');
  if(!level.samples.length)errors.push('3D-Schrupp-Level enthält keine Eligibility-Samples.');

  if(errors.length)return{
    valid:false,cutZ:level.cutZ,components:[],removableSampleCount:0,errors,warnings,
  };

  const xs=uniqueSorted(level.samples.map(sample=>sample.x));
  const ys=uniqueSorted(level.samples.map(sample=>sample.y));
  const sampleByKey=new Map(level.samples.map(sample=>[key(sample.x,sample.y),sample]));

  if(sampleByKey.size!==level.samples.length){
    errors.push('Eligibility-Raster enthält doppelte XY-Samples.');
    return{valid:false,cutZ:level.cutZ,components:[],removableSampleCount:0,errors,warnings};
  }

  const removable=new Set(
    level.samples.filter(sample=>sample.state==='removable').map(sample=>key(sample.x,sample.y)),
  );
  const visited=new Set<string>();
  const components:ThreeDRoughingMaterialComponent[]=[];

  for(const sample of level.samples){
    const startKey=key(sample.x,sample.y);
    if(sample.state!=='removable'||visited.has(startKey))continue;

    const queue=[sample];
    visited.add(startKey);
    const componentSamples:ThreeDRoughingEligibilitySample[]=[];

    while(queue.length){
      const current=queue.shift()!;
      componentSamples.push(current);
      const ix=xs.findIndex(x=>Math.abs(x-current.x)<=EPS);
      const iy=ys.findIndex(y=>Math.abs(y-current.y)<=EPS);
      if(ix<0||iy<0){
        errors.push('Eligibility-Sample konnte nicht dem deterministischen Raster zugeordnet werden.');
        break;
      }

      const neighbours=[
        ix>0?{x:xs[ix-1],y:ys[iy]}:null,
        ix+1<xs.length?{x:xs[ix+1],y:ys[iy]}:null,
        iy>0?{x:xs[ix],y:ys[iy-1]}:null,
        iy+1<ys.length?{x:xs[ix],y:ys[iy+1]}:null,
      ];

      for(const neighbour of neighbours){
        if(!neighbour)continue;
        const neighbourKey=key(neighbour.x,neighbour.y);
        if(!removable.has(neighbourKey)||visited.has(neighbourKey))continue;
        const neighbourSample=sampleByKey.get(neighbourKey);
        if(!neighbourSample)continue;
        visited.add(neighbourKey);
        queue.push(neighbourSample);
      }
    }

    if(errors.length)break;
    const cx=componentSamples.map(point=>point.x),cy=componentSamples.map(point=>point.y);
    components.push({
      id:components.length+1,
      cutZ:level.cutZ,
      samples:componentSamples,
      bounds:{minX:Math.min(...cx),maxX:Math.max(...cx),minY:Math.min(...cy),maxY:Math.max(...cy)},
    });
  }

  const removableSampleCount=level.samples.filter(sample=>sample.state==='removable').length;
  if(level.unresolvedCount)warnings.push(`${level.unresolvedCount} UNRESOLVED-Sample${level.unresolvedCount===1?' bleibt':'s bleiben'} harte Material-Barriere.`);
  if(removableSampleCount&&!components.length&&!errors.length)errors.push('REMOVABLE-Samples konnten keiner sicheren Materialkomponente zugeordnet werden.');

  return{
    valid:errors.length===0,
    cutZ:level.cutZ,
    components:errors.length?[]:components,
    removableSampleCount,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
  };
}
