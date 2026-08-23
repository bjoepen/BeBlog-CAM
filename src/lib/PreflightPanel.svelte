<script lang="ts">
  import type { ImportSummary, StockDefinition, StockMode, ContourOperation, PocketOperation } from './types';
  import ClosedPreflightPanel from './ClosedPreflightPanel.svelte';
  import OpenContourPreflightPanel from './OpenContourPreflightPanel.svelte';
  import BrokenContourPreflightPanel from './BrokenContourPreflightPanel.svelte';
  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let operation:ContourOperation|PocketOperation;
</script>

{#if operation.kind==='contour'&&operation.topology==='open'}
  <OpenContourPreflightPanel {summary} {stock} {stockMode} operation={operation}/>
{:else if operation.kind==='contour'&&(operation.excludedSegmentIds??[]).length}
  <BrokenContourPreflightPanel {summary} {stock} {stockMode} operation={operation}/>
{:else}
  <ClosedPreflightPanel {summary} {stock} {stockMode} {operation}/>
{/if}
