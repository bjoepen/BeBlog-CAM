export type StepEdge3={edgeId:number;points:number[]};

export function decodeStepEdges(raw:number[][]|undefined):StepEdge3[]{
  if(!raw)return[];
  return raw.map((points,edgeId)=>({edgeId,points})).filter(edge=>Array.isArray(edge.points)&&edge.points.length>=6&&edge.points.length%3===0);
}
