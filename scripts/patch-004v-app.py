from pathlib import Path

def once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'{label} anchor missing')
    return s.replace(old,new,1)

p=Path('src/App.svelte'); s=p.read_text()
s=once(s,"  import { open } from '@tauri-apps/plugin-dialog';\n","  import { open, save } from '@tauri-apps/plugin-dialog';\n",'dialog import')
s=once(s,"  import { resolveContourDepth } from './lib/contourDepth';\n","  import { resolveContourDepth } from './lib/contourDepth';\n  import { createCamProjectV1, parseCamProject, serializeCamProject } from './lib/projectPersistence';\n",'persistence import')
s=once(s,"  let importSummary: ImportSummary | null = null;\n","  let importSummary: ImportSummary | null = null;\n  let sourcePath:string|null=null;\n",'source state')
old="  async function importPart(){error='';const path=await open({multiple:false,directory:false,filters:[{name:'CAD',extensions:['step','stp','dxf']}]});if(!path||Array.isArray(path))return;try{importSummary=await invoke<ImportSummary>('inspect_import',{path});stockMode='manual';placement={...defaultPartPlacement};orientation={...defaultPartOrientation};wcs={...defaultWcs};resetOperations()}catch(e){error=String(e)}}\n"
new="""  async function importPart(){error='';const path=await open({multiple:false,directory:false,filters:[{name:'CAD',extensions:['step','stp','dxf']}]});if(!path||Array.isArray(path))return;try{const summary=await invoke<ImportSummary>('inspect_import',{path});importSummary=summary;sourcePath=path;stockMode='manual';placement={...defaultPartPlacement};orientation={...defaultPartOrientation};wcs={...defaultWcs};resetOperations()}catch(e){error=String(e)}}
  async function saveCamProject(){
    error='';
    if(!importSummary||!sourcePath){error='Projekt kann erst gespeichert werden, wenn eine CAD-Quelldatei geladen ist.';return;}
    try{
      const path=await save({filters:[{name:'BeBlog CAM Projekt',extensions:['beblogcam']}],defaultPath:`${importSummary.fileName.replace(/\\.[^.]+$/,'')}.beblogcam`});
      if(!path)return;
      const project=createCamProjectV1({sourcePath,sourceFileName:importSummary.fileName,stock,stockMode,placement,orientation,wcs,fixtures,machineEnvelopeEnabled,machineEnvelope,machineWcsOrigin,spindleHeadEnabled,spindleHead,operationsProject});
      await invoke('save_project_file',{path,content:serializeCamProject(project)});
    }catch(e){error=String(e)}
  }
  async function loadCamProject(){
    error='';
    const path=await open({multiple:false,directory:false,filters:[{name:'BeBlog CAM Projekt',extensions:['beblogcam']}]});
    if(!path||Array.isArray(path))return;
    try{
      const text=await invoke<string>('load_project_file',{path});
      const project=parseCamProject(text);
      const restoredSummary=await invoke<ImportSummary>('inspect_import',{path:project.source.path});
      importSummary=restoredSummary;
      sourcePath=project.source.path;
      stock={...project.setup.stock};
      stockMode=project.setup.stockMode;
      placement={...project.setup.placement};
      orientation={...project.setup.orientation};
      wcs={...project.setup.wcs};
      fixtures=project.setup.fixtures.map(fixture=>({...fixture}));
      machineEnvelopeEnabled=project.setup.machineEnvelopeEnabled;
      machineEnvelope={...project.setup.machineEnvelope};
      machineWcsOrigin={...project.setup.machineWcsOrigin};
      spindleHeadEnabled=project.setup.spindleHeadEnabled;
      spindleHead={...project.setup.spindleHead};
      operationsProject={operations:project.operationsProject.operations.map(cloneOperation),activeOperationId:project.operationsProject.activeOperationId};
      const restoredOperation=activeOperation(operationsProject)??operationsProject.operations[0]??defaultContourOperation;
      operation=cloneOperation(restoredOperation);
      toolTargetOperationId=operationsProject.activeOperationId??restoredOperation.id;
      activeStep='Bauteil';
    }catch(e){error=String(e)}
  }
"""
s=once(s,old,new,'import function')
old_empty='<button class="primary" onclick={importPart}>Bauteil öffnen</button></div>{/if}'
new_empty='<button class="primary" onclick={importPart}>Bauteil öffnen</button><button class="secondary" onclick={loadCamProject}>Projekt öffnen</button></div>{/if}'
s=once(s,old_empty,new_empty,'empty project open')
old_loaded='<button class="secondary" onclick={importPart}>Anderes Bauteil öffnen</button>{:else}'
new_loaded='<div class="placement-grid two"><button class="secondary" onclick={loadCamProject}>Projekt öffnen</button><button class="secondary" onclick={saveCamProject}>Projekt speichern</button></div><button class="secondary" onclick={importPart}>Anderes Bauteil öffnen</button>{:else}'
s=once(s,old_loaded,new_loaded,'loaded project actions')
old_none='<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><button class="primary" onclick={importPart}>Bauteil öffnen</button>{/if}'
new_none='<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><button class="primary" onclick={importPart}>Bauteil öffnen</button><button class="secondary" onclick={loadCamProject}>Projekt öffnen</button>{/if}'
s=once(s,old_none,new_none,'inspector project open')
p.write_text(s)

p=Path('scripts/check-004v-contracts.mjs'); s=p.read_text()
s=once(s,"const pkg=read('package.json');\n","const pkg=read('package.json');\nconst app=read('src/App.svelte');\nconst tauri=read('src-tauri/src/lib.rs');\n",'gate inputs')
marker="  ['package exposes local-first 004V gate',pkg.includes('\"check:004v\": \"node scripts/check-004v-contracts.mjs\"')],\n"
extra="""  ['native project IO enforces beblogcam extension',tauri.includes('save_project_file')&&tauri.includes('load_project_file')&&tauri.includes('eq_ignore_ascii_case(\"beblogcam\")')],
  ['app remembers CAD source path for project persistence',app.includes('let sourcePath:string|null=null')&&app.includes('sourcePath=path')],
  ['app saves complete versioned project through Tauri',app.includes('createCamProjectV1({sourcePath')&&app.includes("invoke('save_project_file'")&&app.includes('serializeCamProject(project)')],
  ['project load validates JSON and reimports referenced CAD before state restore',app.includes('parseCamProject(text)')&&app.includes("invoke<ImportSummary>('inspect_import',{path:project.source.path})")&&app.indexOf('const restoredSummary=')<app.indexOf('stock={...project.setup.stock}')),
  ['project load restores safety setup and operations',app.includes('fixtures=project.setup.fixtures.map')&&app.includes('machineEnvelopeEnabled=project.setup.machineEnvelopeEnabled')&&app.includes('spindleHeadEnabled=project.setup.spindleHeadEnabled')&&app.includes('operationsProject={operations:project.operationsProject.operations.map(cloneOperation)')],
  ['project open and save actions are visible in app',app.includes('onclick={loadCamProject}>Projekt öffnen')&&app.includes('onclick={saveCamProject}>Projekt speichern')],
"""
s=once(s,marker,extra+marker,'gate checks')
p.write_text(s)
