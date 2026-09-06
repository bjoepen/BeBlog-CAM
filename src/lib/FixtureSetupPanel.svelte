<script lang="ts">
  import type { FixtureVolume } from './fixtureCollision';
  export let fixtures:FixtureVolume[]=[];
  export let onChange:(fixtures:FixtureVolume[])=>void=()=>{};
  const emit=(next:FixtureVolume[])=>onChange(next.map(f=>({...f})));
  function addFixture(){
    const n=fixtures.length+1;
    emit([...fixtures,{id:`fixture-${Date.now()}`,name:`Spannmittel ${n}`,enabled:false,minX:0,maxX:20,minY:0,maxY:20,bottomZ:0,topZ:10}]);
  }
  function removeFixture(id:string){emit(fixtures.filter(f=>f.id!==id));}
  function patch(id:string,patch:Partial<FixtureVolume>){emit(fixtures.map(f=>f.id===id?{...f,...patch}:f));}
  function numberPatch(id:string,key:'minX'|'maxX'|'minY'|'maxY'|'bottomZ'|'topZ',event:Event){const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value))patch(id,{[key]:value});}
</script>
<div class="fixture-panel">
  <div class="head"><div><strong>Spannmittel · 004R</strong><p>Rechteckige 2.5D-Sperrvolumen im aktuellen WCS. Neue Spannmittel sind zunächst deaktiviert.</p></div><button type="button" onclick={addFixture}>+ Spannmittel</button></div>
  {#if fixtures.length===0}<p class="empty">Noch keine Spannmittel definiert.</p>{/if}
  {#each fixtures as fixture}
    <div class="fixture">
      <div class="fixture-head"><label class="toggle"><input type="checkbox" checked={fixture.enabled} onchange={e=>patch(fixture.id,{enabled:(e.currentTarget as HTMLInputElement).checked})}/> aktiv</label><input class="name" value={fixture.name} oninput={e=>patch(fixture.id,{name:(e.currentTarget as HTMLInputElement).value})}/><button class="remove" type="button" onclick={()=>removeFixture(fixture.id)}>Entfernen</button></div>
      <div class="grid">
        <label>X min <input type="number" step="0.1" value={fixture.minX} oninput={e=>numberPatch(fixture.id,'minX',e)}/> mm</label>
        <label>X max <input type="number" step="0.1" value={fixture.maxX} oninput={e=>numberPatch(fixture.id,'maxX',e)}/> mm</label>
        <label>Y min <input type="number" step="0.1" value={fixture.minY} oninput={e=>numberPatch(fixture.id,'minY',e)}/> mm</label>
        <label>Y max <input type="number" step="0.1" value={fixture.maxY} oninput={e=>numberPatch(fixture.id,'maxY',e)}/> mm</label>
        <label>Z unten <input type="number" step="0.1" value={fixture.bottomZ} oninput={e=>numberPatch(fixture.id,'bottomZ',e)}/> mm</label>
        <label>Z oben <input type="number" step="0.1" value={fixture.topZ} oninput={e=>numberPatch(fixture.id,'topZ',e)}/> mm</label>
      </div>
    </div>
  {/each}
</div>
<style>.fixture-panel{margin-top:16px;padding:12px;border:1px solid #deded8;border-radius:8px;background:#fafaf8}.head,.fixture-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.head p{margin:3px 0 0;font-size:.76rem;color:#6b716d}.head button,.remove{border:1px solid #d1d3ce;border-radius:6px;background:#fff;padding:6px 9px;cursor:pointer}.empty{font-size:.78rem;color:#777d78}.fixture{margin-top:10px;padding:10px;background:#f3f3f0;border-radius:7px}.fixture-head{margin-bottom:8px}.toggle{display:flex;align-items:center;gap:5px;font-size:.76rem}.name{flex:1;min-width:120px}.remove{font-size:.72rem}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.grid label{display:grid;gap:3px;font-size:.72rem;color:#626863}.grid input,.name{border:1px solid #d2d4cf;border-radius:5px;background:#fff;padding:6px 7px;font:inherit}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
