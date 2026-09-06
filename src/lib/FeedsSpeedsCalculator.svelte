<script lang="ts">
  import FeedsSpeedsCalculatorCore from './FeedsSpeedsCalculatorCore.svelte';
  import type { MillingToolKind } from './toolTypes';

  type ToolOperationChoice={id:string;label:string;name:string;summary:string};
  type ToolOperationTransfer={operationId:string;toolId:string;toolName:string;toolKind:MillingToolKind;diameterMm:number;feedMmMin:number;spindleRpm:number;cuttingLengthMm:number;stickoutMm:number;shaftDiameterMm:number;holderDiameterMm:number};

  export let selectedToolId:string|null=null;
  export let selectedToolKind:MillingToolKind|null=null;
  export let selectedToolName:string|null=null;
  export let selectedToolDiameterMm:number|null=null;
  export let selectedToolCuttingLengthMm:number|null=null;
  export let selectedToolStickoutMm:number|null=null;
  export let selectedToolShaftDiameterMm:number|null=null;
  export let selectedToolHolderDiameterMm:number|null=null;
  export let operationId:string|null=null;
  export let operationLabel:string|null=null;
  export let operationChoices:ToolOperationChoice[]=[];
  export let onOperationSelect:((id:string)=>void)|undefined=undefined;
  export let onTransfer:((transfer:ToolOperationTransfer)=>void)|undefined=undefined;

  // The approved App UI currently supplies the assigned-tool fields separately.
  // Keep accepting them here while the calculator core owns the actual tool editor/library state.
  $: assignedToolSummary = selectedToolId||selectedToolKind||selectedToolName||selectedToolDiameterMm||selectedToolCuttingLengthMm||selectedToolStickoutMm||selectedToolShaftDiameterMm||selectedToolHolderDiameterMm;
</script>

<FeedsSpeedsCalculatorCore
  activeOperationName={operationLabel??'Aktive Bearbeitung'}
  {operationChoices}
  targetOperationId={operationId}
  targetOperation={null}
  onTargetOperationChange={onOperationSelect}
  onApplyToOperation={onTransfer}
/>

{#if false && assignedToolSummary}<span>{assignedToolSummary}</span>{/if}
