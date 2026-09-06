from pathlib import Path
p=Path('src/lib/jobPreflight.ts')
s=p.read_text()
dup="export type JobPreflightSpindleHead={level:JobPreflightLevel;checkedFixtures:number;checkedMotions:number;hits:number;kinds:SpindleHeadCollisionKind[];errors:string[];warnings:string[]}|null;\n"
if s.count(dup)!=2: raise SystemExit(f'unexpected JobPreflightSpindleHead count {s.count(dup)}')
s=s.replace(dup+dup,dup,1)
old="validateSpindleHeadAgainstFixtures({toolpath:canonicalToolpath,fixtures,geometry:spindleHeadConfig})"
new="validateSpindleHeadAgainstFixtures({toolpath:canonicalToolpath,fixtures,head:spindleHeadConfig})"
if old not in s: raise SystemExit('004U geometry call anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
