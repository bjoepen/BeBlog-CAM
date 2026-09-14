import type { ImportSummary } from './types';

export type ProjectSourceReference={path:string;fileName:string;geometryIdentity?:string};
export type ProjectSourceResolution={path:string;summary:ImportSummary;relocated:boolean};

export type ProjectSourceInspector=(path:string)=>Promise<ImportSummary>;
export type ProjectSourceRelocator=(source:ProjectSourceReference,originalError:unknown)=>Promise<string|null>;

type ImportSummaryWithIdentity=ImportSummary&{sourceFingerprint?:string};

const baseName=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)??'';
const isIdentityError=(error:unknown)=>error instanceof Error&&(error.message.includes('Geometrie-Identität')||error.message.includes('seit dem Speichern verändert'));

function assertExpectedSource(source:ProjectSourceReference,summary:ImportSummary):void{
  // Legacy projects created before source fingerprinting remain loadable. Once
  // they are saved by a fingerprint-aware build, the backend injects a
  // geometryIdentity and all subsequent loads use the strict validation path.
  if(!source.geometryIdentity)return;
  const actual=(summary as ImportSummaryWithIdentity).sourceFingerprint;
  if(!actual){
    throw new Error(`Projektquelle kann nicht sicher validiert werden: aktuelle Geometrie-Identität fehlt (${source.fileName}). Projekt nicht geladen.`);
  }
  if(actual!==source.geometryIdentity){
    throw new Error(`Projektquelle wurde seit dem Speichern verändert: ${source.fileName}. Projekt nicht geladen.`);
  }
}

export async function resolveProjectSource(args:{
  source:ProjectSourceReference;
  inspect:ProjectSourceInspector;
  relocate?:ProjectSourceRelocator;
}):Promise<ProjectSourceResolution>{
  const {source,inspect,relocate}=args;
  try{
    const summary=await inspect(source.path);
    assertExpectedSource(source,summary);
    return{path:source.path,summary,relocated:false};
  }catch(originalError){
    // Identity failures are not path failures. Relocating the file cannot make
    // a changed or unverifiable fingerprint valid and would present a
    // misleading "open model" dialog to the user.
    if(isIdentityError(originalError))throw originalError;
    if(!relocate){
      throw new Error(`Projektquelle nicht verfügbar: ${source.fileName}. Gespeicherter Pfad: ${source.path}`);
    }
    const replacement=await relocate(source,originalError);
    if(!replacement){
      throw new Error(`Projektquelle nicht verfügbar und keine Neuzuordnung gewählt: ${source.fileName}.`);
    }
    const replacementName=baseName(replacement);
    if(replacementName!==source.fileName){
      throw new Error(`Neuzuordnung abgelehnt: erwartet wird ${source.fileName}, gewählt wurde ${replacementName||'eine Datei ohne Namen'}.`);
    }
    try{
      const summary=await inspect(replacement);
      assertExpectedSource(source,summary);
      return{path:replacement,summary,relocated:true};
    }catch(replacementError){
      const message=replacementError instanceof Error?replacementError.message:String(replacementError);
      throw new Error(`Neu zugeordnete Projektquelle konnte nicht sicher geladen werden: ${source.fileName}. ${message}`);
    }
  }
}
