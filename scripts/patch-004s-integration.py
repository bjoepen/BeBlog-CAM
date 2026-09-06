from pathlib import Path

def replace_once(s,old,new,label):
    if old not in s: raise SystemExit(f'{label} anchor missing')
    return s.replace(old,new,1)

# App state + setup panel + preflight/export wiring.
p=Path('src/App.svelte'); s=p.read_text()
if "import MachineSetupPanel from './lib/MachineSetupPanel.svelte';" not in s:
    s=replace_once(s,"  import FixtureSetupPanel from './lib/FixtureSetupPanel.svelte';\n","  import FixtureSetupPanel from './lib/FixtureSetupPanel.svelte';\n  import MachineSetupPanel from './lib/MachineSetupPanel.svelte';\n",'App machine panel import')
if "import type { MachineEnvelope, MachineWcsOrigin } from './lib/machineEnvelope';" not in s:
    s=replace_once(s,"  import type { FixtureVolume } from './lib/fixtureCollision';\n","  import type { FixtureVolume } from './lib/fixtureCollision';\n  import type { MachineEnvelope, MachineWcsOrigin } from './lib/machineEnvelope';\n",'App machine types')
if 'let machineEnvelopeEnabled=false;' not in s:
    s=replace_once(s,"  let fixtures:FixtureVolume[]=[];\n","  let fixtures:FixtureVolume[]=[];\n  let machineEnvelopeEnabled=false;\n  let machineEnvelope:MachineEnvelope={minX:0,maxX:500,minY:0,maxY:500,minZ:-100,maxZ:0,warningMarginMm:5};\n  let machineWcsOrigin:MachineWcsOrigin={x:0,y:0,z:0};\n",'App machine state')
if '<MachineSetupPanel' not in s:
    s=replace_once(s,"<FixtureSetupPanel {fixtures} onChange={next=>fixtures=next}/>","<FixtureSetupPanel {fixtures} onChange={next=>fixtures=next}/>\n<MachineSetupPanel enabled={machineEnvelopeEnabled} envelope={machineEnvelope} wcsOrigin={machineWcsOrigin} onEnabledChange={value=>machineEnvelopeEnabled=value} onEnvelopeChange={value=>machineEnvelope=value} onWcsOriginChange={value=>machineWcsOrigin=value}/>",'App machine setup placement')
s=s.replace("<JobPreflightPanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} operations={operationsProject.operations}/>","<JobPreflightPanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} machineEnvelope={machineEnvelopeEnabled?machineEnvelope:null} machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} operations={operationsProject.operations}/>")
s=s.replace("<JobGCodePanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} operations={operationsProject.operations}/>","<JobGCodePanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} machineEnvelope={machineEnvelopeEnabled?machineEnvelope:null} machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} operations={operationsProject.operations}/>")
p.write_text(s)

# Job preflight: machine envelope status per operation.
p=Path('src/lib/jobPreflight.ts'); s=p.read_text()
if "from './machineEnvelope'" not in s:
    s=replace_once(s,"import { validateToolAssemblyAgainstFixtures, type FixtureVolume, type FixtureCollisionKind } from './fixtureCollision';\n","import { validateToolAssemblyAgainstFixtures, type FixtureVolume, type FixtureCollisionKind } from './fixtureCollision';\nimport { validateMachineEnvelope, type MachineEnvelope, type MachineWcsOrigin } from './machineEnvelope';\n",'preflight machine import')
s=s.replace("export type JobPreflightOperation={id:string;index:number;kind:CamOperation['kind'];label:string;detail:string;canonical:string;level:JobPreflightLevel;errors:string[];warnings:string[];toolAssembly:JobPreflightToolAssembly;fixtureCollision:JobPreflightFixtureCollision};","export type JobPreflightMachineEnvelope={level:JobPreflightLevel;checkedPoints:number;limitHits:number;marginHits:number;usesExplicitMotions:boolean;errors:string[];warnings:string[]}|null;\nexport type JobPreflightOperation={id:string;index:number;kind:CamOperation['kind'];label:string;detail:string;canonical:string;level:JobPreflightLevel;errors:string[];warnings:string[];toolAssembly:JobPreflightToolAssembly;fixtureCollision:JobPreflightFixtureCollision;machineEnvelope:JobPreflightMachineEnvelope};")
s=s.replace("export function validateJob(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[]}):JobPreflightResult{\n  const {summary,stock,stockMode,placement,orientation,wcs}=args,fixtures=args.fixtures??[],enabled=args.operations.filter(op=>op.enabled!==false),operations:JobPreflightOperation[]=[],errors:string[]=[],warnings:string[]=[],stockSimulationOperations:StockSimulationOperation[]=[];","export function validateJob(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[];machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null}):JobPreflightResult{\n  const {summary,stock,stockMode,placement,orientation,wcs}=args,fixtures=args.fixtures??[],machineEnvelopeConfig=args.machineEnvelope??null,machineWcsOrigin=args.machineWcsOrigin??null,enabled=args.operations.filter(op=>op.enabled!==false),operations:JobPreflightOperation[]=[],errors:string[]=[],warnings:string[]=[],stockSimulationOperations:StockSimulationOperation[]=[];")
s=s.replace("let opErrors:string[]=[],opWarnings:string[]=[],detail='',canonicalToolpath=null,toolAssembly:JobPreflightToolAssembly=null,fixtureCollision:JobPreflightFixtureCollision=null;","let opErrors:string[]=[],opWarnings:string[]=[],detail='',canonicalToolpath=null,toolAssembly:JobPreflightToolAssembly=null,fixtureCollision:JobPreflightFixtureCollision=null,machineEnvelope:JobPreflightMachineEnvelope=null;")
machine_block="""
    if(canonicalToolpath&&!opErrors.length&&machineEnvelopeConfig&&machineWcsOrigin){const machine=validateMachineEnvelope({toolpath:canonicalToolpath,envelope:machineEnvelopeConfig,wcsOrigin:machineWcsOrigin,safeZMm:operation.safeZMm});opErrors.push(...machine.errors.map(message=>`Maschinenraum: ${message}`));opWarnings.push(...machine.warnings.map(message=>`Maschinenraum: ${message}`));const limitHits=machine.hits.filter(hit=>hit.kind==='limit').length,marginHits=machine.hits.filter(hit=>hit.kind==='margin').length;machineEnvelope={level:machine.errors.length?'fail':machine.warnings.length?'warn':'pass',checkedPoints:machine.checkedPoints,limitHits,marginHits,usesExplicitMotions:machine.usesExplicitMotions,errors:[...machine.errors],warnings:[...machine.warnings]};detail+=` · 004S ${machine.checkedPoints} Maschinenpunkte geprüft`;}
"""
if 'validateMachineEnvelope({toolpath:canonicalToolpath' not in s:
    s=replace_once(s,"    opErrors=unique(opErrors);opWarnings=unique(opWarnings);",machine_block+"    opErrors=unique(opErrors);opWarnings=unique(opWarnings);",'preflight machine validation')
s=s.replace("operations.push({id:operation.id,index:index+1,kind:operation.kind,label,detail,canonical:canonical.summary,level,errors:opErrors,warnings:opWarnings,toolAssembly,fixtureCollision});","operations.push({id:operation.id,index:index+1,kind:operation.kind,label,detail,canonical:canonical.summary,level,errors:opErrors,warnings:opWarnings,toolAssembly,fixtureCollision,machineEnvelope});")
p.write_text(s)

# Preflight panel.
p=Path('src/lib/JobPreflightPanel.svelte'); s=p.read_text()
if "import type { MachineEnvelope, MachineWcsOrigin }" not in s:
    s=replace_once(s,"  import type { FixtureVolume } from './fixtureCollision';\n","  import type { FixtureVolume } from './fixtureCollision';\n  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n",'panel machine imports')
s=s.replace("export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let placement:PartPlacement;export let orientation:PartOrientation;export let wcs:WorkCoordinateSystem;export let fixtures:FixtureVolume[]=[];export let operations:CamOperation[];","export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let placement:PartPlacement;export let orientation:PartOrientation;export let wcs:WorkCoordinateSystem;export let fixtures:FixtureVolume[]=[];export let machineEnvelope:MachineEnvelope|null=null;export let machineWcsOrigin:MachineWcsOrigin|null=null;export let operations:CamOperation[];")
s=s.replace("$: result=validateJob({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures});","$: result=validateJob({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures,machineEnvelope,machineWcsOrigin});")
ui="{#if op.machineEnvelope}<div class=\"machine-check\" class:pass={op.machineEnvelope.level==='pass'} class:warn={op.machineEnvelope.level==='warn'} class:fail={op.machineEnvelope.level==='fail'}><strong>004S Maschinenraum · {op.machineEnvelope.level.toUpperCase()}</strong><span>{op.machineEnvelope.checkedPoints} Punkte geprüft · {op.machineEnvelope.limitHits} Grenzverletzung{op.machineEnvelope.limitHits===1?'':'en'} · {op.machineEnvelope.marginHits} Warnabstand-Treffer</span><span>{op.machineEnvelope.usesExplicitMotions?'Vollständige canonical motions verwendet.':'Fallback: Runs + Entry/Exit; vollständige Rapid-Kette noch nicht verfügbar.'}</span></div>{/if}"
if '004S Maschinenraum' not in s:
    s=replace_once(s,"{#each op.errors as message}",ui+"{#each op.errors as message}",'panel machine UI')
if '.machine-check{' not in s:
    s=s.replace(".fixture-check.fail strong{color:#a13f38}",".fixture-check.fail strong{color:#a13f38}.machine-check{display:grid;gap:3px;margin-top:8px;padding:8px 10px;border-left:2px solid #2f6b4d;background:#f6f6f3;font-size:.75rem;color:#666b66}.machine-check.warn{border-left-color:#9a6a19}.machine-check.fail{border-left-color:#a13f38}.machine-check.pass strong{color:#2f6b4d}.machine-check.warn strong{color:#9a6a19}.machine-check.fail strong{color:#a13f38}")
p.write_text(s)

# Job G-code contract and panel: same machine-aware preflight blocks export.
p=Path('src/lib/jobGcode.ts'); s=p.read_text()
if "import type { MachineEnvelope, MachineWcsOrigin }" not in s:
    s=replace_once(s,"import type { FixtureVolume } from './fixtureCollision';\n","import type { FixtureVolume } from './fixtureCollision';\nimport type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n",'job machine imports')
s=s.replace("type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[]};","type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[];machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null};")
p.write_text(s)

p=Path('src/lib/JobGCodePanel.svelte'); s=p.read_text()
if "import type { MachineEnvelope, MachineWcsOrigin }" not in s:
    s=replace_once(s,"  import type { FixtureVolume } from './fixtureCollision';\n","  import type { FixtureVolume } from './fixtureCollision';\n  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n",'job panel machine imports')
s=s.replace("  export let fixtures:FixtureVolume[]=[];","  export let fixtures:FixtureVolume[]=[];\n  export let machineEnvelope:MachineEnvelope|null=null;\n  export let machineWcsOrigin:MachineWcsOrigin|null=null;")
s=s.replace("$: raw=generateJobGcode({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures});","$: raw=generateJobGcode({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures,machineEnvelope,machineWcsOrigin});")
p.write_text(s)

# Contract gate.
p=Path('scripts/check-004s-contracts.mjs'); s=p.read_text()
if "const app=read('src/App.svelte');" not in s:
    s=s.replace("const canonical=read('src/lib/canonicalToolpath.ts');\n","const canonical=read('src/lib/canonicalToolpath.ts');\nconst app=read('src/App.svelte');\nconst setup=read('src/lib/MachineSetupPanel.svelte');\nconst preflight=read('src/lib/jobPreflight.ts');\nconst panel=read('src/lib/JobPreflightPanel.svelte');\nconst job=read('src/lib/jobGcode.ts');\nconst jobPanel=read('src/lib/JobGCodePanel.svelte');\n")
marker="  ['package exposes local-first 004S gate',pkg.includes('\"check:004s\": \"node scripts/check-004s-contracts.mjs\"')],\n"
addition="  ['machine setup is explicit and optional',app.includes('machineEnvelopeEnabled=false')&&app.includes('MachineSetupPanel')&&setup.includes('Sicherheitsrelevant')],\n  ['job preflight consumes machine envelope and WCS machine origin',preflight.includes('machineEnvelope?:MachineEnvelope|null')&&preflight.includes('validateMachineEnvelope({toolpath:canonicalToolpath')&&preflight.includes('machineEnvelope:JobPreflightMachineEnvelope')],\n  ['preflight panel exposes visible 004S PASS WARN FAIL status',panel.includes('004S Maschinenraum')&&panel.includes('op.machineEnvelope.level')],\n  ['NC export reuses machine-aware preflight',job.includes('machineEnvelope?:MachineEnvelope|null')&&job.includes('preflight=validateJob(args)')&&jobPanel.includes('machineEnvelope,machineWcsOrigin')],\n"+marker
if 'machine setup is explicit and optional' not in s:
    if marker not in s: raise SystemExit('004S gate marker missing')
    s=s.replace(marker,addition,1)
p.write_text(s)
