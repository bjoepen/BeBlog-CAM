import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compile } from 'svelte/compiler';

const panelPath='src/lib/StepAdvisorPanel.svelte';
const preflightPath='src/lib/JobPreflightPanel.svelte';
const appPath='src/App.svelte';
const panel=fs.readFileSync(panelPath,'utf8');
const preflight=fs.readFileSync(preflightPath,'utf8');
const app=fs.readFileSync(appPath,'utf8');
assert.ok(compile(panel,{filename:panelPath,generate:'client'}).js.code.length>0,'consolidated Advisor panel compiles');
assert.ok(compile(preflight,{filename:preflightPath,generate:'client'}).js.code.length>0,'collapsed preflight diagnostics compile');

const loadTs=file=>{
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(output,{exports,require:name=>{throw new Error(`Unexpected runtime dependency ${name}`)},JSON,Number,Math,String,Object,Array,Set,Map});return exports;
};
const {buildStepAdvisorCandidateRows,buildStepAdvisorFeatureDetails,buildStepAdvisorFeatureCards}=loadTs('src/lib/stepAdvisorInspector.ts');
const match={featureId:'hole-A',status:'conditional',candidates:[
  {toolId:'drill-6',toolName:'Bohrer 6',method:'drill',reasons:['Bohrerhinweis']},
  {toolId:'mill-6',toolName:'Fräser 6',method:'helical-mill',reasons:['Helixhinweis']},
  {toolId:'drill-4',toolName:'Bohrer 4',method:'drill',reasons:[]}
],reasons:[]};
const advice=[
  {featureId:'hole-A',toolId:'drill-6',toolName:'Bohrer 6',method:'drill',status:'conditional',spindleRpm:3000,feedMmMin:120,notes:['Drehzahlhinweis']},
  {featureId:'hole-A',toolId:'mill-6',toolName:'Fräser 6',method:'helical-mill',status:'conditional',spindleRpm:8200,feedMmMin:360,notes:['Helixhinweis']}
];
const proposal={featureId:'hole-A',kind:'drill',method:'drill',toolId:'drill-6',toolName:'Bohrer 6',diameterMm:6,depthMm:8,status:'conditional',spindleRpm:3000,feedMmMin:120,cautions:['Nicht freigegeben']};
const review={featureId:'hole-A',toolId:'drill-6',method:'drill',status:'requires-review',checks:[{label:'Maschine',status:'open',reason:'Maschine noch nicht geprüft.'},{label:'Preflight',status:'open',reason:'Kein Produktionswerkzeugweg geprüft.'}]};

const rows=buildStepAdvisorCandidateRows(match,advice,[proposal],[review]);
assert.equal(rows.length,3,'all matching tool candidates remain present');
assert.deepEqual([rows[0].toolId,rows[0].method,rows[0].spindleRpm,rows[0].feedMmMin,rows[0].proposal?.toolId,rows[0].review?.checks.length],['drill-6','drill',3000,120,'drill-6',2]);
assert.deepEqual([rows[1].toolId,rows[1].spindleRpm,rows[1].feedMmMin,rows[1].proposal],['mill-6',8200,360,null]);
assert.deepEqual([rows[2].toolId,rows[2].spindleRpm,rows[2].feedMmMin,rows[2].proposal],['drill-4',null,null,null]);
assert.equal(rows[2].proposalAmbiguous,false,'candidate with no full proposal remains a candidate');

const staleProposal={...proposal,spindleRpm:9999};
const mismatched=buildStepAdvisorCandidateRows(match,advice,[staleProposal],[review]);
assert.equal(mismatched[0].proposal,null,'proposal values inconsistent with verified advice are not joined');
assert.equal(mismatched[0].proposalAmbiguous,true,'inconsistent proposal remains a visible diagnostic');
assert.equal(buildStepAdvisorFeatureDetails('hole-A',[match],advice,[staleProposal],[review]).unmatchedProposals.length,1);
const duplicateProposals=buildStepAdvisorCandidateRows(match,advice,[proposal,{...proposal,feedMmMin:121}],[review]);
assert.equal(duplicateProposals[0].proposal,null,'duplicate feature/tool/method proposals are not selected by position');
assert.equal(duplicateProposals[0].proposalAmbiguous,true);
const wrongFeature=buildStepAdvisorCandidateRows(match,advice,[{...proposal,featureId:'hole-B'}],[review]);
assert.equal(wrongFeature[0].proposal,null,'proposal association requires matching feature identity');

const kinds=['hole','unclassified-cylinder','planar-face','contour-wire','planar-region','unresolved-boundary'];
const features=kinds.map((geometryKind,index)=>({
  featureId:`feature-${index}`,classification:{geometryKind},
  feasibility:index===0?{status:'assessed',assessment:{coverage:'CONDITIONAL'}}:{status:'not-assessed',reason:'No exact assessed association.'}
}));
const overview={ok:true,overview:{features}};
const cards=buildStepAdvisorFeatureCards(overview,[{...match,featureId:'feature-0'}],advice.map(item=>({...item,featureId:'feature-0'})),[{...proposal,featureId:'feature-0'}],[{...review,featureId:'feature-0'}]);
assert.equal(cards.length,6,'exactly one leading card is produced for each of the six G1/G2 feature kinds');
assert.deepEqual(Array.from(cards,item=>item.featureId),features.map(item=>item.featureId));
assert.equal(cards[0].details.matchRows[0].rows[0].proposal.toolId,'drill-6');
for(const card of cards.slice(1))assert.equal(card.details,null,'unassessed features get no recommendation join');
assert.equal(buildStepAdvisorFeatureCards({ok:false,overview:null,errors:['stale context']},[match],advice,[proposal],[review]).length,0,'failed or stale overview cannot retain previous cards');

assert.equal((panel.match(/\{#each featureCards as card \(card\.featureId\)\}/g)??[]).length,1,'one feature-ID-keyed leading list');
assert.ok(panel.includes('data-feature-id={entry.featureId}'),'stable internal feature identity remains on its card');
assert.ok(panel.includes('Noch keine Bearbeitungsempfehlung verfügbar.'),'unassessed state is explicit and non-prescriptive');
assert.ok(panel.includes('Werkzeugkandidat · bedingt')&&panel.includes('Operationsvorschlag · bedingt, nicht übernommen'));
assert.ok(panel.includes('Geometrische Details und Einschränkungen')&&panel.includes('Native Referenzen:'));
assert.ok(panel.includes('<details class="geometry-details">')&&panel.includes('<details class="option-details">'));
assert.ok(!panel.includes('{#each report.features'),'separate duplicate feasibility feature list removed');
assert.ok(!/onclick=|Operation\s+(?:übernehmen|erzeugen)|NC\s+(?:erzeugen|exportieren)/i.test(panel),'no selection, operation adoption or NC actions are introduced');
assert.ok(panel.includes('CONDITIONAL')&&panel.includes('NOT_COVERED'),'coverage values are only translated for display');
assert.ok(!panel.includes('NOT_COVERED</span>'),'coverage is not rendered as a job failure');

const prüfStart=app.indexOf("{:else if activeStep==='Prüfen'}");
const fräsenStart=app.indexOf("{:else if activeStep==='Fräsen'}",prüfStart);
const prüfMarkup=app.slice(prüfStart,fräsenStart);
assert.ok(prüfMarkup.indexOf('<JobPreflightPanel')>=0&&prüfMarkup.indexOf('<JobPreflightPanel')<prüfMarkup.indexOf('<StepAdvisorPanel'),'job preflight precedes the Advisor');
assert.ok(preflight.includes('class="overall"')&&preflight.includes('{result.level.toUpperCase()}'),'overall PASS/WARN/FAIL remains prominent');
assert.ok(preflight.includes('<details class="op">')&&preflight.includes('<summary class="op-summary">'),'operation diagnostics are closed by default');
assert.ok(preflight.includes('op.errors[0]')&&preflight.includes('op.warnings[0]'),'first blocker or warning remains visible in the collapsed summary');
assert.ok(preflight.includes('op.errors as message')&&preflight.includes('op.warnings as message'),'complete diagnostics remain available when expanded');
assert.ok(app.includes('validateJob({summary:importSummary')&&app.includes('operations:operationsProject.operations'),'job preflight still consumes actual project operations');
assert.ok(app.includes('screenStepFeasibility(')&&app.includes('proposeStepOperations('),'existing Advisor calculation pipeline remains the source');

console.log('011-G4-C3 Advisor consolidation PASS');
