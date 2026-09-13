import { resolveProjectSource } from '../../src/lib/projectSourceRecovery';
import type { ImportSummary } from '../../src/lib/types';

const expectedIdentity='src-v1:aaaaaaaaaaaaaaaa:100';
const changedIdentity='src-v1:bbbbbbbbbbbbbbbb:100';
const fileName='008b4-reference.dxf';

const summary=(identity:string):ImportSummary=>({
  kind:'dxf',fileName,backend:'008b4-fixture',status:'ready',entities:{LINE:4},planarGeometry:{curves:[]},sourceFingerprint:identity,
} as ImportSummary&{sourceFingerprint:string});

async function rejected(action:()=>Promise<unknown>){
  try{await action();return'';}catch(error){return error instanceof Error?error.message:String(error);}
}

export async function run008b4(){
  const source={path:'/project/source/008b4-reference.dxf',fileName,geometryIdentity:expectedIdentity};

  const unchanged=await resolveProjectSource({source,inspect:async()=>summary(expectedIdentity)});

  const changedError=await rejected(()=>resolveProjectSource({source,inspect:async()=>summary(changedIdentity)}));

  const recovered=await resolveProjectSource({
    source,
    inspect:async path=>path===source.path?summary(changedIdentity):summary(expectedIdentity),
    relocate:async()=>'/archive/008b4-reference.dxf',
  });

  const legacyError=await rejected(()=>resolveProjectSource({
    source:{path:source.path,fileName},
    inspect:async()=>summary(expectedIdentity),
  }));

  const changedReplacementError=await rejected(()=>resolveProjectSource({
    source,
    inspect:async path=>{if(path===source.path)throw new Error('ENOENT');return summary(changedIdentity);},
    relocate:async()=>'/moved/008b4-reference.dxf',
  }));

  return{unchanged,changedError,recovered,legacyError,changedReplacementError};
}

run008b4().then(result=>console.log(JSON.stringify(result)));
