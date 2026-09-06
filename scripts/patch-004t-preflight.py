from pathlib import Path

def replace_once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    return s.replace(old, new, 1)

p=Path('src/lib/jobPreflight.ts'); s=p.read_text()
if "from './safeMotionChain'" not in s:
    s=replace_once(s,"import { validateMachineEnvelope, type MachineEnvelope, type MachineWcsOrigin } from './machineEnvelope';\n","import { validateMachineEnvelope, type MachineEnvelope, type MachineWcsOrigin } from './machineEnvelope';\nimport { materializeSafeMotionChain } from './safeMotionChain';\n",'safe motion import')
block="""
    if(canonicalToolpath&&!opErrors.length){const safeChain=materializeSafeMotionChain({toolpath:canonicalToolpath,safeZMm:operation.safeZMm});opErrors.push(...safeChain.errors.map(message=>`Safe Motion 004T: ${message}`));opWarnings.push(...safeChain.warnings.map(message=>`Safe Motion 004T: ${message}`));if(safeChain.toolpath){canonicalToolpath=safeChain.toolpath;detail+=` · 004T ${safeChain.motionCount} vollständige XYZ-Motions`;}}
"""
anchor="    const canonical=validateCanonicalToolpath(canonicalToolpath);"
if 'Safe Motion 004T:' not in s:
    s=replace_once(s,anchor,block+anchor,'preflight materialization')
p.write_text(s)

p=Path('scripts/check-004t-contracts.mjs'); s=p.read_text()
if "const preflight=read('src/lib/jobPreflight.ts');" not in s:
    s=s.replace("const pkg=read('package.json');\n","const pkg=read('package.json');\nconst preflight=read('src/lib/jobPreflight.ts');\nconst machine=read('src/lib/machineEnvelope.ts');\n")
marker="  ['package exposes local-first 004T gate',pkg.includes('\"check:004t\": \"node scripts/check-004t-contracts.mjs\"')],\n"
addition="  ['job preflight materializes every canonical operation before safety checks',preflight.includes('materializeSafeMotionChain({toolpath:canonicalToolpath,safeZMm:operation.safeZMm})')&&preflight.indexOf('materializeSafeMotionChain({toolpath:canonicalToolpath')<preflight.indexOf('validateCanonicalToolpath(canonicalToolpath)')],\n  ['004S receives explicit materialized motions instead of run fallback',preflight.indexOf('materializeSafeMotionChain({toolpath:canonicalToolpath')<preflight.indexOf('validateMachineEnvelope({toolpath:canonicalToolpath')&&machine.includes('toolpath.motions')],\n"+marker
if 'job preflight materializes every canonical operation' not in s:
    if marker not in s: raise SystemExit('gate marker missing')
    s=s.replace(marker,addition,1)
p.write_text(s)
