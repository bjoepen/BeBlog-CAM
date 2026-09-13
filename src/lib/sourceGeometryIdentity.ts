import type { ImportSummary } from './types';

const stable=(value:unknown):string=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
};

const fnv1a=(text:string):string=>{
  let hash=0x811c9dc5;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
};

export function sourceGeometryIdentity(summary:ImportSummary):string{
  const geometry=summary.kind==='dxf'
    ?{kind:summary.kind,entities:summary.entities,planarGeometry:summary.planarGeometry??null}
    :{kind:summary.kind,entities:summary.entities,brep:summary.brep??null};
  const serialized=stable(geometry);
  return `geom-v1:${fnv1a(serialized)}:${serialized.length}`;
}

export function assertSourceGeometryIdentity(expected:string|undefined,summary:ImportSummary):void{
  if(!expected)throw new Error('Projektquelle kann nicht sicher validiert werden: gespeicherte Geometrie-Identität fehlt. Projekt nicht geladen.');
  const actual=sourceGeometryIdentity(summary);
  if(actual!==expected)throw new Error(`Projektquelle wurde seit dem Speichern geometrisch verändert. Erwartet ${expected}, gefunden ${actual}. Projekt nicht geladen.`);
}
