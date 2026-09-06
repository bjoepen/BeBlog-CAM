from pathlib import Path

def replace_once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    return s.replace(old, new, 1)

# Preflight exposes the exact materialized toolpath used by all safety checks.
p=Path('src/lib/jobPreflight.ts'); s=p.read_text()
if "import type { CanonicalToolpath } from './canonicalToolpath';" not in s:
    s=replace_once(s,"import { materializeSafeMotionChain } from './safeMotionChain';\n","import { materializeSafeMotionChain, buildJobSafeTransitions } from './safeMotionChain';\nimport type { CanonicalToolpath } from './canonicalToolpath';\n",'preflight safe imports')
else:
    s=s.replace("import { materializeSafeMotionChain } from './safeMotionChain';","import { materializeSafeMotionChain, buildJobSafeTransitions } from './safeMotionChain';")
s=s.replace("export type JobPreflightOperation={id:string;index:number;kind:CamOperation['kind'];label:string;detail:string;canonical:string;level:JobPreflightLevel;errors:string[];warnings:string[];toolAssembly:JobPreflightToolAssembly;fixtureCollision:JobPreflightFixtureCollision;machineEnvelope:JobPreflightMachineEnvelope};","export type JobPreflightOperation={id:string;index:number;kind:CamOperation['kind'];label:string;detail:string;canonical:string;level:JobPreflightLevel;errors:string[];warnings:string[];toolAssembly:JobPreflightToolAssembly;fixtureCollision:JobPreflightFixtureCollision;machineEnvelope:JobPreflightMachineEnvelope;toolpath:CanonicalToolpath|null};")
s=s.replace("operations.push({id:operation.id,index:index+1,kind:operation.kind,label,detail,canonical:canonical.summary,level,errors:opErrors,warnings:opWarnings,toolAssembly,fixtureCollision,machineEnvelope});","operations.push({id:operation.id,index:index+1,kind:operation.kind,label,detail,canonical:canonical.summary,level,errors:opErrors,warnings:opWarnings,toolAssembly,fixtureCollision,machineEnvelope,toolpath:canonicalToolpath});")
# Validate job-level transitions too.
anchor="  if(!enabled.length)errors.push('Der Gesamtjob enthält keine aktivierte Bearbeitung.');"
block="""  const transitionSource=operations.filter(op=>op.toolpath&&!op.errors.length).map(op=>({id:op.id,safeZMm:enabled.find(item=>item.id===op.id)?.safeZMm??0,toolpath:op.toolpath!}));
  const transitions=buildJobSafeTransitions({operations:transitionSource});
  errors.push(...transitions.errors.map(message=>`Safe Motion 004T Job: ${message}`));
  if(machineEnvelopeConfig&&machineWcsOrigin){
    for(const transition of transitions.transitions){
      if(!transition.motions.length)continue;
      const probe:CanonicalToolpath={version:1,operationKind:'contour',strategy:'contour',tool:{diameterMm:1},stepoverPercent:0,runs:[],motions:transition.motions};
      const check=validateMachineEnvelope({toolpath:probe,envelope:machineEnvelopeConfig,wcsOrigin:machineWcsOrigin,safeZMm:transition.motions[0].start.z});
      errors.push(...check.errors.map(message=>`Maschinenraum Übergang ${transition.fromOperationId} → ${transition.toOperationId}: ${message}`));
      warnings.push(...check.warnings.map(message=>`Maschinenraum Übergang ${transition.fromOperationId} → ${transition.toOperationId}: ${message}`));
    }
  }
"""
if 'Safe Motion 004T Job:' not in s:
    s=replace_once(s,anchor,block+anchor,'preflight transition validation')
p.write_text(s)

# Rewrite generateJobGcode to use preflight toolpaths + canonical motion poster.
p=Path('src/lib/jobGcode.ts'); s=p.read_text()
if "from './safeMotionChain'" not in s:
    s=replace_once(s,"import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n","import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\nimport { buildJobSafeTransitions } from './safeMotionChain';\nimport { postCanonicalMachineMotions } from './canonicalMotionGcode';\n",'job safe imports')
start=s.index('export function generateJobGcode(')
new_func=r'''export function generateJobGcode(args:Args):JobGcodeResult{
  const enabled=args.operations.filter(op=>op.enabled!==false),preflight=validateJob(args);
  if(preflight.level==='fail')return{ok:false,errors:['Gesamtjob ist durch den Preflight nicht freigegeben.',...preflight.errors],warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  if(!enabled.length)return{ok:false,errors:['Keine aktive Bearbeitung im Projekt.'],warnings:preflight.warnings,code:'',lineCount:0,operationCount:0,toolChangeCount:0};
  const prepared=enabled.map(operation=>({operation,preflight:preflight.operations.find(item=>item.id===operation.id)}));
  const missing=prepared.filter(item=>!item.preflight?.toolpath);
  if(missing.length)return{ok:false,errors:missing.map(item=>`Bearbeitung ${item.operation.name}: 004T liefert keinen materialisierten Werkzeugweg.`),warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const transitions=buildJobSafeTransitions({operations:prepared.map(item=>({id:item.operation.id,safeZMm:item.operation.safeZMm,toolpath:item.preflight!.toolpath!}))});
  if(!transitions.ok)return{ok:false,errors:transitions.errors,warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const lines:string[]=['( BeBlog CAM 004T )','( Gesamtjob · Preflight und NC-Ausgabe verwenden dieselbe kanonische Motion-Wahrheit )',`( ${enabled.length} Bearbeitungen )`,'G21','G90','G17'];
  let toolChangeCount=0;
  prepared.forEach((item,index)=>{
    const operation=item.operation,toolpath=item.preflight!.toolpath!;
    lines.push(`( Bearbeitung ${index+1}/${enabled.length} · ${label(operation)} · ${operationDisplayName(operation,index)} )`,`M3 S${Math.round(operation.spindleRpm)}`);
    lines.push(...postCanonicalMachineMotions({motions:toolpath.motions??[],operation}));
    const next=prepared[index+1]?.operation;
    if(!next)return;
    if(toolKey(operation)!==toolKey(next)){
      toolChangeCount++;
      lines.push('M5',`( Werkzeugwechsel ${toolChangeCount} )`,`M0 ( Werkzeug ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm einsetzen und bestaetigen )`);
    }else lines.push(`( Gleiches Werkzeug · ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm )`);
    const transition=transitions.transitions.find(t=>t.fromOperationId===operation.id&&t.toOperationId===next.id);
    if(transition?.motions.length)lines.push(...postCanonicalMachineMotions({motions:transition.motions,operation:next}));
  });
  lines.push('M5','M30');
  const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings:[...new Set(preflight.warnings)],code,lineCount:lines.length,operationCount:enabled.length,toolChangeCount};
}
'''
s=s[:start]+new_func
p.write_text(s)

# Gate proves common truth + explicit transition posting.
p=Path('scripts/check-004t-contracts.mjs'); s=p.read_text()
if "const job=read('src/lib/jobGcode.ts');" not in s:
    s=s.replace("const preflight=read('src/lib/jobPreflight.ts');\n","const preflight=read('src/lib/jobPreflight.ts');\nconst job=read('src/lib/jobGcode.ts');\nconst poster=read('src/lib/canonicalMotionGcode.ts');\n")
marker="  ['package exposes local-first 004T gate',pkg.includes('\"check:004t\": \"node scripts/check-004t-contracts.mjs\"')],\n"
addition="  ['preflight exposes the exact materialized toolpath used for export',preflight.includes('toolpath:CanonicalToolpath|null')&&preflight.includes('toolpath:canonicalToolpath')],\n  ['job transitions are complete lift XY descend motion chains',chain.includes('motions:CanonicalMachineMotion[]')&&chain.includes('const lifted=')&&chain.includes('const across=')],\n  ['job preflight checks operation transitions against machine envelope',preflight.includes('Safe Motion 004T Job:')&&preflight.includes('Maschinenraum Übergang')],\n  ['NC job posts preflight materialized motions instead of legacy operation G-code',job.includes('item.preflight!.toolpath!')&&job.includes('postCanonicalMachineMotions')&&job.includes('buildJobSafeTransitions')&&!job.slice(job.indexOf('export function generateJobGcode')).includes('generateOperation(args,operation)')],\n  ['canonical poster emits rapid line and arc motions directly',poster.includes("motion.kind==='rapid3'")&&poster.includes("motion.kind==='line3'")&&poster.includes("motion.ccw?'G3':'G2'")],\n"+marker
if 'preflight exposes the exact materialized toolpath used for export' not in s:
    if marker not in s: raise SystemExit('gate marker missing')
    s=s.replace(marker,addition,1)
p.write_text(s)
