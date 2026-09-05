from pathlib import Path

path = Path('src/App.svelte')
text = path.read_text()

anchor_handlers = "  function updateContourTabHeight(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({tabHeightMm:value});}\n"
insert_handlers = anchor_handlers + "  function updateContourLeadInLength(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({leadInLengthMm:value});}\n  function updateContourLeadOutLength(event:Event){if(operation.kind!=='contour')return;const value=Number((event.currentTarget as HTMLInputElement).value);if(Number.isFinite(value)&&value>0)updateContour({leadOutLengthMm:value});}\n"
if anchor_handlers not in text:
    raise SystemExit('004K handler anchor missing')
text = text.replace(anchor_handlers, insert_handlers, 1)

anchor_ui = "{/if}</div>{:else if operation.kind==='pocket'}<div class=\"placement-section\"><p class=\"placement-title\">Räumstrategie</p>"
lead_ui = "{/if}</div><div class=\"placement-section\"><p class=\"placement-title\">Ein-/Ausfahrt</p><div class=\"placement-grid two\"><button class:active={(operation.leadMode??'none')==='none'} onclick={()=>updateContour({leadMode:'none'})}>Aus</button><button class:active={(operation.leadMode??'none')==='tangent-line'} onclick={()=>updateContour({leadMode:'tangent-line'})}>Tangential</button></div>{#if (operation.leadMode??'none')==='tangent-line'}<label>Einfahrt <input type=\"number\" min=\"0.1\" step=\"0.5\" value={operation.leadInLengthMm??3} oninput={updateContourLeadInLength}/> mm</label><label>Ausfahrt <input type=\"number\" min=\"0.1\" step=\"0.5\" value={operation.leadOutLengthMm??3} oninput={updateContourLeadOutLength}/> mm</label><p class=\"note\">Der Fräser fährt linear tangential in die geschlossene Kontur ein und nach dem letzten Schnitt tangential wieder aus. Haltestege werden davor aufgelöst; die Ein-/Ausfahrt wird daher nicht an jedem Haltesteg wiederholt.</p>{/if}</div>{:else if operation.kind==='pocket'}<div class=\"placement-section\"><p class=\"placement-title\">Räumstrategie</p>"
if anchor_ui not in text:
    raise SystemExit('004K UI anchor missing')
text = text.replace(anchor_ui, lead_ui, 1)

path.write_text(text)
