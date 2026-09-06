import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const persistence=read('src/lib/projectPersistence.ts');
const pkg=read('package.json');
const app=read('src/App.svelte');
const tauri=read('src-tauri/src/lib.rs');
const checks=[
  ['versioned BeBlog CAM project format exists',persistence.includes("CAM_PROJECT_FORMAT='beblog-cam-project'")&&persistence.includes('CAM_PROJECT_VERSION=1')],
  ['project persists source reference instead of embedding geometry',persistence.includes('source:{path:string;fileName:string}')&&!persistence.includes('ImportSummary')],
  ['project persists stock placement orientation and WCS',persistence.includes('stock:StockDefinition')&&persistence.includes('placement:PartPlacement')&&persistence.includes('orientation:PartOrientation')&&persistence.includes('wcs:WorkCoordinateSystem')],
  ['project persists fixtures machine envelope and spindle head',persistence.includes('fixtures:FixtureVolume[]')&&persistence.includes('machineEnvelopeEnabled:boolean')&&persistence.includes('spindleHeadEnabled:boolean')],
  ['project persists complete operations project',persistence.includes('operationsProject:OperationsProject')],
  ['serialization is deterministic JSON text',persistence.includes("JSON.stringify(project,null,2)+'\\n'")],
  ['parser rejects foreign or future project formats',persistence.includes('Datei ist kein BeBlog-CAM-Projekt')&&persistence.includes('ist neuer als diese BeBlog-CAM-Version unterstützt')],
  ['migration entry point exists',persistence.includes('export function migrateCamProject')],
  ['native project IO enforces beblogcam extension',tauri.includes('save_project_file')&&tauri.includes('load_project_file')&&tauri.includes('eq_ignore_ascii_case("beblogcam")')],
  ['app remembers CAD source path for project persistence',app.includes('let sourcePath:string|null=null')&&app.includes('sourcePath=path')],
  ['app saves complete versioned project through Tauri',app.includes('createCamProjectV1({sourcePath')&&app.includes('save_project_file')&&app.includes('serializeCamProject(project)')],
  ['project load validates JSON and reimports referenced CAD before state restore',app.includes('parseCamProject(text)')&&app.includes('project.source.path')&&app.includes('const restoredSummary=')&&app.indexOf('const restoredSummary=')<app.indexOf('stock={...project.setup.stock}')],
  ['project load restores safety setup and operations',app.includes('fixtures=project.setup.fixtures.map')&&app.includes('machineEnvelopeEnabled=project.setup.machineEnvelopeEnabled')&&app.includes('spindleHeadEnabled=project.setup.spindleHeadEnabled')&&app.includes('operationsProject={operations:project.operationsProject.operations.map(cloneOperation)')],
  ['project open and save actions are visible in app',app.includes('onclick={loadCamProject}>Projekt öffnen')&&app.includes('onclick={saveCamProject}>Projekt speichern')],
  ['package exposes local-first 004V gate',pkg.includes('"check:004v": "node scripts/check-004v-contracts.mjs"')],
];
let failed=false;
for(const [label,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'} 004V: ${label}`);
  if(!ok)failed=true;
}
if(failed)process.exit(1);
