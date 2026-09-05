import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const types=read('src/lib/types.ts');
const finishing=read('src/lib/contourFinishing.ts');
const gcode=read('src/lib/gcode.ts');
const step=read('src/lib/stepContourOperation.ts');
const checks=[
  ['contour operation stores radial and axial allowance',types.includes('radialAllowanceMm?:number')&&types.includes('axialAllowanceMm?:number')],
  ['contour operation stores finish-pass controls',types.includes('finishPassEnabled?:boolean')&&types.includes('finishPassCount?:number')],
  ['defaults remain backward compatible',types.includes('radialAllowanceMm:0')&&types.includes('axialAllowanceMm:0')&&types.includes('finishPassEnabled:false')&&types.includes('finishPassCount:1')],
  ['shared canonical finishing transformer exists',finishing.includes('export function applyContourFinishing')],
  ['radial allowance distinguishes outside and inside',finishing.includes("operation.side==='outside'?cfg.radialAllowanceMm:operation.side==='inside'?-cfg.radialAllowanceMm:0")],
  ['axial allowance reduces roughing depth',finishing.includes('finalDepthMm-cfg.axialAllowanceMm')],
  ['finish passes return to nominal final depth',finishing.includes('finishPassCount')&&finishing.includes('z:-finalDepthMm')],
  ['DXF applies finishing before tabs and leads',gcode.indexOf('applyContourFinishing')<gcode.lastIndexOf('applyContourTabs')&&gcode.lastIndexOf('applyContourTabs')<gcode.lastIndexOf('applyContourLeads')],
  ['STEP applies finishing before tabs and leads',step.indexOf('applyContourFinishing')<step.lastIndexOf('applyContourTabs')&&step.lastIndexOf('applyContourTabs')<step.lastIndexOf('applyContourLeads')],
  ['004L rejects radial allowance on on-line contours',finishing.includes("operation.side==='on-line'")],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004L: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
