from pathlib import Path
p=Path('src/App.svelte')
s=p.read_text()
old='<button class="primary" onclick={importPart}>Bauteil öffnen</button><button class="secondary" onclick={loadCamProject}>Projekt öffnen</button></div>{/if}'
new='<button class="primary" onclick={importPart}>Bauteil öffnen</button></div>{/if}'
if old not in s:
    raise SystemExit('004V empty-state anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
