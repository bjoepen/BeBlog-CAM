import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const persistence=read('src/lib/projectPersistence.ts');
const pkg=read('package.json');
const checks=[
  ['versioned BeBlog CAM project format exists',persistence.includes("CAM_PROJECT_FORMAT='beblog-cam-project'")&&persistence.includes('CAM_PROJECT_VERSION=1')],
  ['project persists source reference instead of embedding geometry',persistence.includes('source:{path:string;fileName:string}')&&!persistence.includes('ImportSummary')],
  ['project persists stock placement orientation and WCS',persistence.includes('stock:StockDefinition')&&persistence.includes('placement:PartPlacement')&&persistence.includes('orientation:PartOrientation')&&persistence.includes('wcs:WorkCoordinateSystem')],
  ['project persists fixtures machine envelope and spindle head',persistence.includes('fixtures:FixtureVolume[]')&&persistence.includes('machineEnvelopeEnabled:boolean')&&persistence.includes('spindleHeadEnabled:boolean')],
  ['project persists complete operations project',persistence.includes('operationsProject:OperationsProject')],
  ['serialization is deterministic JSON text',persistence.includes("JSON.stringify(project,null,2)+'\\n'")],
  ['parser rejects foreign or future project formats',persistence.includes("Datei ist kein BeBlog-CAM-Projekt")&&persistence.includes('ist neuer als diese BeBlog-CAM-Version unterstützt')],
  ['migration entry point exists',persistence.includes('export function migrateCamProject')],
  ['package exposes local-first 004V gate',pkg.includes('"check:004v": "node scripts/check-004v-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004V: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
