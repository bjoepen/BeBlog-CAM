export type DxfTargetSelection={contourId:number|null;contourIds?:number[]};

export function normalizeDxfTargetIds(selection:DxfTargetSelection):number[]{
  const source=selection.contourIds?.length?selection.contourIds:(selection.contourId==null?[]:[selection.contourId]);
  return [...new Set(source.filter(id=>Number.isInteger(id)&&id>=0))].sort((a,b)=>a-b);
}

export function toggleDxfTargetId(selection:DxfTargetSelection,id:number):number[]{
  const ids=new Set(normalizeDxfTargetIds(selection));
  ids.has(id)?ids.delete(id):ids.add(id);
  return [...ids].sort((a,b)=>a-b);
}

export function dxfMultiTargetKey(ids:number[]):string{
  return `dxf-contours:${[...new Set(ids)].sort((a,b)=>a-b).join(',')}`;
}
