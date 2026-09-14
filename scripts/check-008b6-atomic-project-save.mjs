import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function pass(name,condition,detail=''){
  if(!condition){console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);process.exitCode=1;return;}
  console.log(`PASS ${name}`);
}

const lib=fs.readFileSync('src-tauri/src/lib.rs','utf8');
const writer=fs.readFileSync('src-tauri/src/project_file.rs','utf8');

pass('008B6 project save routes through atomic writer',lib.includes('project_file::atomic_write(path, encoded.as_bytes())'));
pass('008B6 project save no longer writes target directly',!lib.includes('std::fs::write(path, encoded.as_bytes())'));
pass('008B6 atomic writer uses same-directory temporary file before replace',writer.includes('parent.join(format!')&&writer.includes('file.write_all(bytes)?;')&&writer.includes('file.sync_all()?;')&&writer.includes('fs::rename(&temp_path, path)?;'));
pass('008B6 failed pre-replace save cleans temporary file',writer.includes('if result.is_err()')&&writer.includes('fs::remove_file(&temp_path)'));

try{
  execFileSync('cargo',['test','--locked','--manifest-path','src-tauri/Cargo.toml','project_file::tests','--','--nocapture'],{stdio:'inherit'});
  pass('008B6 atomic save failure fixtures pass',true);
}catch(error){
  pass('008B6 atomic save failure fixtures pass',false,error instanceof Error?error.message:String(error));
}

if(!process.exitCode){
  console.log('PASS 008B6 interrupted/failed save contract: project content is fully staged and synced before atomic replacement, a failed pre-replace save preserves an existing valid project, and failed first-save attempts do not leave a partial target.');
}
