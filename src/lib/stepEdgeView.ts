export type StepEdge3={points:number[]};

export function decodeStepEdges(raw:number[][]|undefined):StepEdge3[]{
  if(!raw)return[];
  return raw.filter(edge=>Array.isArray(edge)&&edge.length>=6&&edge.length%3===0).map(points=>({points}));
}
