import { resolveProjectSource } from '../../src/lib/projectSourceRecovery';
import type { ImportSummary } from '../../src/lib/types';

const identity='src-v1:008b3:fixture';
const summary=(fileName:string,sourceFingerprint=identity):ImportSummary=>({kind:'dxf',fileName,backend:'008b3-fixture',status:'ready',entities:{LINE:4},planarGeometry:{curves:[]},sourceFingerprint} as ImportSummary&{sourceFingerprint:string});

export async function run008b3(){
  const source={path:'/old/location/008b3-reference.dxf',fileName:'008b3-reference.dxf',geometryIdentity:identity};

  const direct=await resolveProjectSource({
    source,
    inspect:async path=>{
      if(path!==source.path)throw new Error('unexpected path');
      return summary(source.fileName);
    },
  });

  const legacySource={path:'/old/location/legacy-reference.dxf',fileName:'legacy-reference.dxf'};
  const legacyDirect=await resolveProjectSource({
    source:legacySource,
    inspect:async path=>{
      if(path!==legacySource.path)throw new Error('unexpected path');
      return summary(legacySource.fileName);
    },
    relocate:async()=>{throw new Error('legacy direct load must not relocate');},
  });

  let identityMismatchError='';
  let identityMismatchRelocateCalls=0;
  try{
    await resolveProjectSource({
      source,
      inspect:async()=>summary(source.fileName,'src-v1:changed:fixture'),
      relocate:async()=>{identityMismatchRelocateCalls+=1;return'/new/location/008b3-reference.dxf';},
    });
  }catch(error){identityMismatchError=error instanceof Error?error.message:String(error);}

  let missingError='';
  try{
    await resolveProjectSource({source,inspect:async()=>{throw new Error('ENOENT');}});
  }catch(error){missingError=error instanceof Error?error.message:String(error);}

  const moved=await resolveProjectSource({
    source,
    inspect:async path=>{
      if(path===source.path)throw new Error('ENOENT');
      if(path==='/new/location/008b3-reference.dxf')return summary(source.fileName);
      throw new Error('unexpected path');
    },
    relocate:async()=>'/new/location/008b3-reference.dxf',
  });

  let cancelledError='';
  try{
    await resolveProjectSource({
      source,
      inspect:async()=>{throw new Error('ENOENT');},
      relocate:async()=>null,
    });
  }catch(error){cancelledError=error instanceof Error?error.message:String(error);}

  let wrongNameError='';
  try{
    await resolveProjectSource({
      source,
      inspect:async()=>{throw new Error('ENOENT');},
      relocate:async()=>'/new/location/different-part.dxf',
    });
  }catch(error){wrongNameError=error instanceof Error?error.message:String(error);}

  return{direct,legacyDirect,identityMismatchError,identityMismatchRelocateCalls,missingError,moved,cancelledError,wrongNameError};
}

run008b3().then(result=>console.log(JSON.stringify(result)));
