from pathlib import Path
p=Path('src/App.svelte')
s=p.read_text()
old='''{:else}<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><div class="project-open-actions"><button class="primary" onclick={importPart}>Bauteil öffnen</button></div>{/if}'''
new='''{:else}<p>Das CAD-Modell ist die Quelle für alle späteren Bearbeitungen.</p><div class="project-open-actions"><button class="primary" onclick={importPart}>Bauteil öffnen</button><button class="secondary" onclick={loadCamProject}>Projekt öffnen</button></div>{/if}'''
if old not in s:
    raise SystemExit('empty inspector project action anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
