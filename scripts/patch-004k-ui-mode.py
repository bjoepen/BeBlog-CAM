from pathlib import Path
p=Path('src/App.svelte')
s=p.read_text()
old="'tangent-line'"
if old not in s:
    raise SystemExit('004K UI mode anchor missing')
p.write_text(s.replace(old,"'line'"))
