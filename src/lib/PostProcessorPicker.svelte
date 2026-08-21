<script lang="ts">
  import { postProcessorStore } from './postProcessorStore';
</script>

<div class="postprocessor">
  <div>
    <strong>Postprozessor</strong>
    <span>Die Werkzeugwege bleiben unverändert; nur die Controller-Ausgabe wird angepasst.</span>
  </div>
  <div class="choices" role="group" aria-label="Postprozessor wählen">
    <button class:active={$postProcessorStore==='generic'} onclick={()=>postProcessorStore.set('generic')}>Standard</button>
    <button class:active={$postProcessorStore==='estlcam'} onclick={()=>postProcessorStore.set('estlcam')}>Estlcam</button>
  </div>
</div>

<style>
.postprocessor{display:grid;gap:8px;padding:11px 12px;margin:12px 0;background:#f3f3f0;border-left:2px solid #727b75}.postprocessor>div:first-child{display:grid;gap:3px}.postprocessor strong{font-size:.82rem;color:#333b37}.postprocessor span{font-size:.75rem;color:#6a706c;line-height:1.35}.choices{display:grid;grid-template-columns:1fr 1fr;gap:6px}.choices button{border:1px solid #d5d7d2;border-radius:7px;background:#fff;padding:7px 9px;color:#4e5651;cursor:pointer;font-size:.75rem}.choices button.active{background:#e6ebe7;border-color:#9aa49e;color:#303a34;font-weight:600}
</style>
