import type { ImportSummary } from './types';

export type ProjectSourceReference={path:string;fileName:string};
export type ProjectSourceResolution={path:string;summary:ImportSummary;relocated:boolean};

export type ProjectSourceInspector=(path:string)=>Promise<ImportSummary>;
export type ProjectSourceRelocator=(source:ProjectSourceReference,originalError:unknown)=>Promise<string|null>;

const baseName=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)??'';

export async function resolveProjectSource(args:{
  source:ProjectSourceReference;
  inspect:ProjectSourceInspector;
  relocate?:ProjectSourceRelocator;
}):Promise<ProjectSourceResolution>{
  const {source,inspect,relocate}=args;
  try{
    const summary=await inspect(source.path);
    return{path:source.path,summary,relocated:false};
  }catch(originalError){
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
      return{path:replacement,summary,relocated:true};
    }catch(replacementError){
      throw new Error(`Neu zugeordnete Projektquelle konnte nicht geladen werden: ${source.fileName}. ${String(replacementError)}`);
    }
  }
}
