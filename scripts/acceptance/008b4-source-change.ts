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

  // Relocation is reserved for path failures. An identity mismatch is a real
  // source-change failure and must not be converted into an "open model" flow.
  const recovered=await resolveProjectSource({
    source,
    inspect:async path=>{if(path===source.path)throw new Error('ENOENT');return summary(expectedIdentity);},
    relocate:async()=>'/archive/008b4-reference.dxf',
  });

  // Legacy projects created before source fingerprinting remain loadable. The
  // next fingerprint-aware save upgrades them onto the strict identity path.
  const legacy=await resolveProjectSource({
    source:{path:source.path,fileName},
    inspect:async()=>summary(expectedIdentity),
  });

  const changedReplacementError=await rejected(()=>resolveProjectSource({
    source,
    inspect:async path=>{if(path===source.path)throw new Error('ENOENT');return summary(changedIdentity);},
    relocate:async()=>'/moved/008b4-reference.dxf',
  }));

  return{unchanged,changedError,recovered,legacy,changedReplacementError};
}

run008b4().then(result=>console.log(JSON.stringify(result)));
