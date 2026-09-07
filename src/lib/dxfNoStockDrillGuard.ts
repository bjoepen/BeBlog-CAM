function textOf(element:Element|null){return element?.textContent?.trim()??'';}

export function syncDxfNoStockDrillGuard(){
  const inspector=document.querySelector<HTMLElement>('.inspector');
  if(!inspector)return;
  const eyebrow=textOf(inspector.querySelector('.eyebrow'));
  if(!eyebrow.startsWith('04 · Bearbeiten'))return;

  const viewLabel=textOf(document.querySelector('.view-label'));
  const noStock=viewLabel.includes('Aufspannebene → Bauteil → WCS');
  if(!noStock)return;

  const sections=[...inspector.querySelectorAll<HTMLElement>('.placement-section')];
  const depthSection=sections.find(section=>textOf(section.querySelector('.placement-title'))==='Bohrtiefe');
  if(!depthSection)return;

  const buttons=[...depthSection.querySelectorAll<HTMLButtonElement>('button')];
  const manual=buttons.find(button=>textOf(button)==='Manuell');
  const through=buttons.find(button=>textOf(button)==='Durch Rohling');
  if(!manual||!through)return;

  through.disabled=true;
  through.title='„Durch Rohling“ benötigt einen definierten Rohling.';

  if(through.classList.contains('active')&&!manual.classList.contains('active')){
    manual.click();
  }
}
