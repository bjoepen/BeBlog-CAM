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
const duplicateAdvice=buildStepAdvisorFeatureDetails('hole-A',[match],[...advice,{...advice[0],spindleRpm:3100}],[proposal],[review]);
assert.equal(duplicateAdvice.matchRows[0].rows[0].spindleRpm,null,'duplicate advice remains fail-closed');
assert.equal(duplicateAdvice.matchRows[0].rows[0].proposal,null,'proposal cannot attach to ambiguous advice');
assert.equal(duplicateAdvice.unresolvedAdvice.length,2,'every ambiguous advice item remains diagnosed');
const duplicateReviews=buildStepAdvisorFeatureDetails('hole-A',[match],advice,[proposal],[review,{...review,checks:[{label:'Alternative',status:'open',reason:'zweite Prüfung'}]}]);
assert.equal(duplicateReviews.matchRows[0].rows[0].proposal.toolId,'drill-6','unique proposal remains visible with ambiguous review');
assert.equal(duplicateReviews.matchRows[0].rows[0].review,null,'duplicate reviews are never chosen by position');
assert.equal(duplicateReviews.matchRows[0].rows[0].proposalAmbiguous,true);
assert.equal(duplicateReviews.unmatchedProposals.length,1,'proposal/review ambiguity is retained in diagnostics');

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

const bulkSize=90;
const bulkMatches=Array.from({length:bulkSize},(_,i)=>({featureId:`bulk-${i}`,status:'conditional',reasons:[],candidates:[
  {toolId:'drill-shared',toolName:'Bohrer gemeinsam',method:'drill',reasons:[]},
  {toolId:'mill-shared',toolName:'Fräser gemeinsam',method:'helical-mill',reasons:[]}
]}));
const bulkAdvice=bulkMatches.flatMap(item=>[
  {featureId:item.featureId,toolId:'drill-shared',toolName:'Bohrer gemeinsam',method:'drill',status:'conditional',spindleRpm:3000,feedMmMin:120,notes:[]},
  {featureId:item.featureId,toolId:'mill-shared',toolName:'Fräser gemeinsam',method:'helical-mill',status:'conditional',spindleRpm:8000,feedMmMin:300,notes:[]}
]);
const bulkProposals=bulkMatches.map(item=>({...proposal,featureId:item.featureId,toolId:'drill-shared',toolName:'Bohrer gemeinsam'}));
const bulkReviews=bulkMatches.map(item=>({...review,featureId:item.featureId,toolId:'drill-shared'}));
const bulkOverview={ok:true,overview:{features:bulkMatches.map(item=>({featureId:item.featureId,classification:{geometryKind:'hole'},feasibility:{status:'assessed',assessment:{coverage:'CONDITIONAL'}}}))}};
const traversals={matches:0,advice:0,proposals:0,reviews:0,globalFilters:0};
const tracked=(values,key)=>new Proxy(values,{get(target,property,receiver){if(property===Symbol.iterator)return function*(){traversals[key]++;yield* target;};if(property==='filter')return()=>{traversals.globalFilters++;throw new Error(`Repeated whole-list filter on ${key}`);};return Reflect.get(target,property,receiver);}});
const immutableBulk=JSON.stringify([bulkMatches,bulkAdvice,bulkProposals,bulkReviews]);
const bulkCards=buildStepAdvisorFeatureCards(bulkOverview,tracked(bulkMatches,'matches'),tracked(bulkAdvice,'advice'),tracked(bulkProposals,'proposals'),tracked(bulkReviews,'reviews'));
assert.deepEqual(traversals,{matches:1,advice:1,proposals:1,reviews:1,globalFilters:0},'each shared input list is indexed once per presentation update');
assert.equal(bulkCards.length,bulkSize);
assert.equal(JSON.stringify([bulkMatches,bulkAdvice,bulkProposals,bulkReviews]),immutableBulk,'indexing does not mutate its inputs');
for(const index of [0,17,bulkSize-1]){
  const expected=buildStepAdvisorFeatureDetails(`bulk-${index}`,bulkMatches,bulkAdvice,bulkProposals,bulkReviews);
  assert.equal(JSON.stringify(bulkCards[index].details),JSON.stringify(expected),`bulk display output remains identical for feature ${index}`);
}

assert.equal((panel.match(/\{#each featureCards as card \(card\.featureId\)\}/g)??[]).length,1,'one feature-ID-keyed leading list');
assert.ok(panel.includes('data-feature-id={entry.featureId}'),'stable internal feature identity remains on its card');
assert.ok(panel.includes('Noch keine Bearbeitungsempfehlung verfügbar.'),'unassessed state is explicit and non-prescriptive');
assert.ok(panel.includes('Werkzeugkandidat · bedingt')&&panel.includes('Operationsvorschlag · bedingt, nicht übernommen'));
assert.ok(panel.includes('Geometrische Details und Einschränkungen')&&panel.includes('Native Referenzen:'));
assert.ok(panel.includes('<details class="geometry-details">')&&panel.includes('<details class="option-details">'));
assert.ok(panel.includes('container-type:inline-size;container-name:advisor-inspector'),'responsive breakpoint is based on actual inspector/container width');
assert.ok(panel.includes('@container advisor-inspector (max-width:38rem)'),'narrow tool rows reflow at compact inspector widths');
assert.ok(panel.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)')&&panel.includes('overflow-wrap:anywhere'),'tool name, method and cut values can wrap without horizontal clipping');
assert.ok(!panel.includes('@media(max-width:36rem)'),'tool-row layout does not depend on the application window width');
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
