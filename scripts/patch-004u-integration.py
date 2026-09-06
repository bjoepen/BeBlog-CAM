from pathlib import Path

def once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    return s.replace(old,new,1)

# jobPreflight
p=Path('src/lib/jobPreflight.ts'); s=p.read_text()
if "from './spindleHeadCollision'" not in s:
    s=once(s,"import { materializeSafeMotionChain, buildJobSafeTransitions } from './safeMotionChain';\n","import { materializeSafeMotionChain, buildJobSafeTransitions } from './safeMotionChain';\nimport { validateSpindleHeadAgainstFixtures, type SpindleHeadGeometry, type SpindleHeadCollisionKind } from './spindleHeadCollision';\n",'preflight import')
s=s.replace("export type JobPreflightMachineEnvelope={level:JobPreflightLevel;checkedPoints:number;limitHits:number;marginHits:number;usesExplicitMotions:boolean;errors:string[];warnings:string[]}|null;","export type JobPreflightMachineEnvelope={level:JobPreflightLevel;checkedPoints:number;limitHits:number;marginHits:number;usesExplicitMotions:boolean;errors:string[];warnings:string[]}|null;\nexport type JobPreflightSpindleHead={level:JobPreflightLevel;checkedFixtures:number;checkedMotions:number;hits:number;kinds:SpindleHeadCollisionKind[];errors:string[];warnings:string[]}|null;")
s=s.replace("machineEnvelope:JobPreflightMachineEnvelope;toolpath:CanonicalToolpath|null};","machineEnvelope:JobPreflightMachineEnvelope;spindleHead:JobPreflightSpindleHead;toolpath:CanonicalToolpath|null};")
s=s.replace("machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null}","machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null;spindleHead?:SpindleHeadGeometry|null}")
s=s.replace("machineWcsOrigin=args.machineWcsOrigin??null,enabled=", "machineWcsOrigin=args.machineWcsOrigin??null,spindleHeadConfig=args.spindleHead??null,enabled=")
s=s.replace("machineEnvelope:JobPreflightMachineEnvelope=null;", "machineEnvelope:JobPreflightMachineEnvelope=null,spindleHead:JobPreflightSpindleHead=null;")
anchor="    if(canonicalToolpath&&!opErrors.length&&machineEnvelopeConfig&&machineWcsOrigin){"
block="""    if(canonicalToolpath&&!opErrors.length&&spindleHeadConfig&&fixtures.some(f=>f.enabled!==false)){const result=validateSpindleHeadAgainstFixtures({toolpath:canonicalToolpath,fixtures,geometry:spindleHeadConfig});opErrors.push(...result.errors.map(message=>`Spindelkopf: ${message}`));opWarnings.push(...result.warnings.map(message=>`Spindelkopf: ${message}`));spindleHead={level:result.errors.length?'fail':result.warnings.length?'warn':'pass',checkedFixtures:result.checkedFixtures,checkedMotions:result.checkedMotions,hits:result.hits.length,kinds:[...new Set(result.hits.map(hit=>hit.kind))],errors:[...result.errors],warnings:[...result.warnings]};detail+=` · 004U ${result.hits.length?`${result.hits.length} Spindelkopf-Treffer`:'Spindelkopf frei'}`;}
"""
if 'Spindelkopf:' not in s:
    s=once(s,anchor,block+anchor,'spindle preflight block')
s=s.replace("toolAssembly,fixtureCollision,machineEnvelope,toolpath:canonicalToolpath", "toolAssembly,fixtureCollision,machineEnvelope,spindleHead,toolpath:canonicalToolpath")
p.write_text(s)

# jobGcode args pass-through
p=Path('src/lib/jobGcode.ts'); s=p.read_text()
if "type { SpindleHeadGeometry }" not in s:
    s=once(s,"import { postCanonicalMachineMotions } from './canonicalMotionGcode';\n","import { postCanonicalMachineMotions } from './canonicalMotionGcode';\nimport type { SpindleHeadGeometry } from './spindleHeadCollision';\n",'job import')
s=s.replace("machineWcsOrigin?:MachineWcsOrigin|null};","machineWcsOrigin?:MachineWcsOrigin|null;spindleHead?:SpindleHeadGeometry|null};")
p.write_text(s)

# Preflight panel
p=Path('src/lib/JobPreflightPanel.svelte'); s=p.read_text()
if "SpindleHeadGeometry" not in s:
    s=once(s,"  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n","  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n  import type { SpindleHeadGeometry } from './spindleHeadCollision';\n",'panel import')
s=s.replace("export let operations:CamOperation[];", "export let spindleHead:SpindleHeadGeometry|null=null;export let operations:CamOperation[];")
s=s.replace("operations,fixtures,machineEnvelope,machineWcsOrigin});", "operations,fixtures,machineEnvelope,machineWcsOrigin,spindleHead});")
needle="{#if op.machineEnvelope}"
ui="{#if op.spindleHead}<div class=\"spindle-check\" class:pass={op.spindleHead.level==='pass'} class:warn={op.spindleHead.level==='warn'} class:fail={op.spindleHead.level==='fail'}><strong>004U Spindelkopf · {op.spindleHead.level.toUpperCase()}</strong><span>{op.spindleHead.checkedFixtures} Spannmittel · {op.spindleHead.checkedMotions} Bewegungen · {op.spindleHead.hits} Treffer</span><span>{op.spindleHead.kinds.length?op.spindleHead.kinds.map(kind=>kind==='spindle-nose'?'Spindelnase/Spannzange':'Z-Schlitten').join(' / '):'kein Konflikt'}</span></div>{/if}"
if '004U Spindelkopf' not in s:
    s=s.replace(needle,ui+needle,1)
s=s.replace(".machine-check{display:grid", ".spindle-check{display:grid;gap:3px;margin-top:8px;padding:8px 10px;border-left:2px solid #2f6b4d;background:#f6f6f3;font-size:.75rem;color:#666b66}.spindle-check.warn{border-left-color:#9a6a19}.spindle-check.fail{border-left-color:#a13f38}.spindle-check.pass strong{color:#2f6b4d}.spindle-check.warn strong{color:#9a6a19}.spindle-check.fail strong{color:#a13f38}.machine-check{display:grid")
p.write_text(s)

# GCode panel
p=Path('src/lib/JobGCodePanel.svelte'); s=p.read_text()
if "SpindleHeadGeometry" not in s:
    s=once(s,"  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n","  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n  import type { SpindleHeadGeometry } from './spindleHeadCollision';\n",'gcode panel import')
s=s.replace("  export let machineWcsOrigin:MachineWcsOrigin|null=null;", "  export let machineWcsOrigin:MachineWcsOrigin|null=null;\n  export let spindleHead:SpindleHeadGeometry|null=null;")
s=s.replace("operations,fixtures,machineEnvelope,machineWcsOrigin});", "operations,fixtures,machineEnvelope,machineWcsOrigin,spindleHead});")
p.write_text(s)

# App wiring
p=Path('src/App.svelte'); s=p.read_text()
if "SpindleHeadSetupPanel" not in s:
    s=once(s,"  import MachineSetupPanel from './lib/MachineSetupPanel.svelte';\n","  import MachineSetupPanel from './lib/MachineSetupPanel.svelte';\n  import SpindleHeadSetupPanel from './lib/SpindleHeadSetupPanel.svelte';\n",'app component import')
if "SpindleHeadGeometry" not in s:
    s=once(s,"  import type { MachineEnvelope, MachineWcsOrigin } from './lib/machineEnvelope';\n","  import type { MachineEnvelope, MachineWcsOrigin } from './lib/machineEnvelope';\n  import type { SpindleHeadGeometry } from './lib/spindleHeadCollision';\n",'app type import')
state="  let spindleHeadEnabled=false;\n  let spindleHead:SpindleHeadGeometry={spindleNoseDiameterMm:80,spindleNoseBottomOffsetMm:60,spindleNoseLengthMm:80,carriageEnabled:false,carriageWidthMm:120,carriageDepthMm:120,carriageBottomOffsetMm:140,carriageHeightMm:120};\n"
if 'let spindleHeadEnabled=' not in s:
    s=once(s,"  let machineWcsOrigin:MachineWcsOrigin={x:0,y:0,z:0};\n","  let machineWcsOrigin:MachineWcsOrigin={x:0,y:0,z:0};\n"+state,'app state')
# place setup after machine setup
machine_tag="<MachineSetupPanel enabled={machineEnvelopeEnabled} envelope={machineEnvelope} wcsOrigin={machineWcsOrigin} onEnabledChange={value=>machineEnvelopeEnabled=value} onEnvelopeChange={value=>machineEnvelope=value} onWcsOriginChange={value=>machineWcsOrigin=value}/>
"
if '<SpindleHeadSetupPanel' not in s and machine_tag in s:
    s=s.replace(machine_tag,machine_tag+"<SpindleHeadSetupPanel enabled={spindleHeadEnabled} geometry={spindleHead} onEnabledChange={value=>spindleHeadEnabled=value} onGeometryChange={value=>spindleHead=value}/>\n",1)
# pass props to panels by augmenting exact existing closing patterns
s=s.replace("machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} operations={operationsProject.operations}/>", "machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} spindleHead={spindleHeadEnabled?spindleHead:null} operations={operationsProject.operations}/>")
p.write_text(s)

# Gate
p=Path('scripts/check-004u-contracts.mjs'); s=p.read_text()
insert="const preflight=read('src/lib/jobPreflight.ts');\nconst app=read('src/App.svelte');\nconst preflightPanel=read('src/lib/JobPreflightPanel.svelte');\nconst jobPanel=read('src/lib/JobGCodePanel.svelte');\nconst setup=read('src/lib/SpindleHeadSetupPanel.svelte');\n"
if "const preflight=read('src/lib/jobPreflight.ts');" not in s:
    s=s.replace("const pkg=read('package.json');\n","const pkg=read('package.json');\n"+insert)
marker="  ['package exposes local-first 004U gate',pkg.includes('\"check:004u\": \"node scripts/check-004u-contracts.mjs\"')],\n"
extra="  ['004U setup persists spindle and optional carriage geometry',setup.includes('Spindelkopf · 004U')&&setup.includes('spindleNoseBottomOffsetMm')&&setup.includes('carriageEnabled')],\n  ['app wires 004U profile into preflight and export',app.includes('spindleHeadEnabled')&&app.includes('SpindleHeadSetupPanel')&&app.includes('spindleHead={spindleHeadEnabled?spindleHead:null}')],\n  ['job preflight runs spindle head collision on canonical motions',preflight.includes('validateSpindleHeadAgainstFixtures')&&preflight.includes('Spindelkopf:')&&preflight.includes('spindleHead:JobPreflightSpindleHead')],\n  ['preflight panel visibly renders 004U status',preflightPanel.includes('004U Spindelkopf')&&preflightPanel.includes('op.spindleHead.level')],\n  ['NC export receives same 004U safety profile',jobPanel.includes('spindleHead:SpindleHeadGeometry|null')&&jobPanel.includes('machineWcsOrigin,spindleHead')],\n"
if '004U setup persists spindle' not in s:
    s=s.replace(marker,extra+marker,1)
p.write_text(s)
