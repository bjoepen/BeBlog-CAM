import { resolveProjectSource } from '../../src/lib/projectSourceRecovery';
import type { ImportSummary } from '../../src/lib/types';

const identity='src-v1:008b3:fixture';
const summary=(fileName:string):ImportSummary=>({kind:'dxf',fileName,backend:'008b3-fixture',status:'ready',entities:{LINE:4},planarGeometry:{curves:[]},sourceFingerprint:identity} as ImportSummary&{sourceFingerprint:string});

export async function run008b3(){
  const source={path:'/old/location/008b3-reference.dxf',fileName:'008b3-reference.dxf',geometryIdentity:identity};

  const direct=await resolveProjectSource({
    source,
    inspect:async path=>{
      if(path!==source.path)throw new Error('unexpected path');
      return summary(source.fileName);
    },
  });

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

  return{direct,missingError,moved,cancelledError,wrongNameError};
}

run008b3().then(result=>console.log(JSON.stringify(result)));
