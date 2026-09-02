<script lang="ts">
  import type { ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem, ZLevelRoughingOperation } from './types';
  import { validateOperationGrammar, type ValidationCheck } from './validationGrammar';
  import { validateCanonicalToolpath } from './canonicalPreflight';
  import { buildFaceTargetOperationState } from './faceTargetOperation';

  export let summary:ImportSummary;
  export let stock:StockDefinition;
  export let stockMode:StockMode;
  export let placement:PartPlacement;
  export let orientation:PartOrientation;
  export let wcs:WorkCoordinateSystem;
  export let operation:ZLevelRoughingOperation;

  type Check={level:'pass'|'warn'|'fail';title:string;detail:string};

  $: reconstructed=buildFaceTargetOperationState({summary,stock,placement,orientation,wcs,operation});
  $: grammar=validateOperationGrammar(operation,stock,stockMode,wcs);
  $: canonical=reconstructed?validateCanonicalToolpath(reconstructed.toolpath):null;
  $: checks=[
    ...grammar.map((check:ValidationCheck):Check=>({level:check.level,title:check.title,detail:check.detail})),
    operation.faceIds.length&&reconstructed
      ? {level:'pass' as const,title:'Zielfläche',detail:`${operation.faceIds.length} operation-owned STEP/BRep Face Target${operation.faceIds.length===1?'':'s'} aktiv · Ziel Z ${reconstructed.targetZ.toFixed(3)} mm · Schrupp-Endhöhe ${reconstructed.roughBottomZ.toFixed(3)} mm.`}
      : {level:'fail' as const,title:'Zielfläche',detail:'Keine gültige operation-owned STEP/BRep-Zielfläche gewählt. Ohne Face Target darf kein Z-Level-Werkzeugweg freigegeben werden.'},
    ...(canonical
      ? [
          ...(canonical.errors.map(detail=>({level:'fail' as const,title:'Kanonischer Werkzeugweg',detail}))),
          ...(canonical.warnings.map(detail=>({level:'warn' as const,title:'Kanonischer Werkzeugweg',detail}))),
          ...(canonical.ok?[{level:'pass' as const,title:'Kanonischer Werkzeugweg',detail:canonical.summary}]:[])
        ]
      : [])
  ];
  $: level=checks.some(check=>check.level==='fail')?'fail':checks.some(check=>check.level==='warn')?'warn':'pass';
</script>

<p class="eyebrow">05 · Prüfen</p>
<h2>Z-Level Schruppen</h2>

<div class:pass={level==='pass'} class:warn={level==='warn'} class:fail={level==='fail'} class="release">
  <strong>{level.toUpperCase()}</strong>
  <span>{level==='pass'?'Face Target, Werkzeug, Schnittdaten und kanonischer Werkzeugweg sind freigabefähig.':level==='warn'?'Bearbeitung ist grundsätzlich freigabefähig, enthält aber Hinweise.':'Bearbeitung ist noch nicht freigabefähig.'}</span>
</div>

<div class="facts">
  <span><b>Werkzeug</b> {operation.tool.name} · Ø {operation.tool.diameterMm.toFixed(3)} mm</span>
  <span><b>Zustellung</b> {operation.stepDownMm.toFixed(3)} mm</span>
  <span><b>Stepover</b> {operation.stepoverPercent.toFixed(1)} %</span>
  <span><b>Schlichtaufmaß</b> {operation.finishAllowanceMm.toFixed(3)} mm</span>
  <span><b>Schnittdaten</b> {operation.feedMmMin} / {operation.plungeMmMin} mm/min · {operation.spindleRpm} 1/min</span>
</div>

<div class="checks">
  {#each checks as check}
    <div class:check-pass={check.level==='pass'} class:check-warn={check.level==='warn'} class:check-fail={check.level==='fail'} class="check">
      <strong>{check.title}</strong>
      <span>{check.detail}</span>
    </div>
  {/each}
</div>

<style>
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#7a7d78;margin:0 0 .5rem}.release{display:grid;gap:4px;padding:12px 14px;margin:12px 0 14px;background:#f3f3f0;border-left:2px solid #999}.release strong{font-size:.72rem;letter-spacing:.08em}.release.pass{border-color:#5c8b70}.release.pass strong{color:#2f6b4d}.release.warn{border-color:#c59a4a}.release.warn strong{color:#805f20}.release.fail{border-color:#bb5c50}.release.fail strong{color:#9b3b33}.facts{display:grid;gap:5px;padding:11px 13px;margin:0 0 12px;background:#f7f7f4;font-size:.76rem;color:#59615d}.checks{display:grid;gap:7px}.check{display:grid;gap:3px;padding:9px 11px;border-left:2px solid #b5b8b3;background:#f7f7f4}.check strong{font-size:.76rem}.check span{font-size:.73rem;line-height:1.4;color:#646b67}.check-pass{border-color:#6d9b7e}.check-warn{border-color:#c59a4a}.check-fail{border-color:#bd655a}
</style>
