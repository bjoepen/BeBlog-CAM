type ViewState={
  yawDeg:number;
  tiltDeg:number;
  dragging:boolean;
  lastX:number;
  lastY:number;
};

const state:ViewState={yawDeg:0,tiltDeg:0,dragging:false,lastX:0,lastY:0};
let boundSvg:SVGSVGElement|null=null;

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

function parseNumber(value:string|undefined|null):number|null{
  if(!value)return null;
  const parsed=Number(value.replace(',','.'));
  return Number.isFinite(parsed)?parsed:null;
}

function inspectorNumber(labelPrefix:string):number|null{
  const labels=[...document.querySelectorAll<HTMLLabelElement>('.inspector label')];
  const label=labels.find(item=>item.textContent?.trim().startsWith(labelPrefix));
  return parseNumber(label?.querySelector<HTMLInputElement>('input')?.value);
}

function stockWidthMm():number|null{
  const note=[...document.querySelectorAll<HTMLElement>('.inspector .note')]
    .map(item=>item.textContent??'')
    .find(text=>text.includes('Rohlingfläche'));
  const match=note?.match(/([\d.,]+)\s*×\s*([\d.,]+)\s*mm\s*Rohlingfläche/i);
  return parseNumber(match?.[1]);
}

function cuttingDepths(count:number):number[]{
  const total=inspectorNumber('Planabtrag');
  const step=inspectorNumber('Zustellung');
  if(total&&step&&total>0&&step>0){
    return Array.from({length:count},(_,index)=>Math.min((index+1)*step,total));
  }
  if(total&&total>0)return Array.from({length:count},(_,index)=>total*(index+1)/count);
  return Array.from({length:count},(_,index)=>index+1);
}

function ensureStyles(){
  if(document.getElementById('toolpath-25d-style'))return;
  const style=document.createElement('style');
  style.id='toolpath-25d-style';
  style.textContent=`
    .toolpath-25d-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .toolpath-25d-controls button{min-width:28px;border:1px solid rgba(52,66,60,.22);border-radius:7px;background:rgba(255,255,255,.72);padding:3px 7px;color:#34423c;cursor:pointer;font:inherit}
    .toolpath-25d-controls button:hover{background:#fff}
    .toolpath-25d-controls button.active{background:#e5f0f2;border-color:rgba(50,123,141,.45);color:#285f6d}
    .toolpath-25d-controls .toolpath-25d-status{color:#65706b;white-space:nowrap}
    .geometry-view.toolpath-25d-active svg{cursor:grab}
    .geometry-view.toolpath-25d-active svg:active{cursor:grabbing}
  `;
  document.head.append(style);
}

function clearTransforms(svg:SVGSVGElement){
  svg.style.transform='';
  svg.style.transformOrigin='';
  svg.style.overflow='';
  svg.querySelectorAll<SVGPathElement>('.toolpath-preview').forEach(path=>{
    path.style.transform='';
    path.style.transformBox='';
  });
}

function applyView(svg:SVGSVGElement,status:HTMLElement|null){
  const paths=[...svg.querySelectorAll<SVGPathElement>('.toolpath-preview')];
  if(!paths.length)return;

  const tiltRad=state.tiltDeg*Math.PI/180;
  const scaleY=Math.max(.56,Math.cos(tiltRad));
  svg.style.transformOrigin='50% 50%';
  svg.style.transform=`rotate(${state.yawDeg.toFixed(2)}deg) scaleY(${scaleY.toFixed(4)})`;
  svg.style.overflow='visible';

  const stock=svg.querySelector<SVGPathElement>('path.stock');
  const stockMm=stockWidthMm();
  const stockPx=stock?.getBoundingClientRect().width??0;
  const pxPerMm=stockMm&&stockMm>0&&stockPx>0?stockPx/stockMm:8;
  const depths=cuttingDepths(paths.length);
  const separation=Math.sin(tiltRad);

  paths.forEach((path,index)=>{
    const shift=depths[index]*pxPerMm*separation;
    path.style.transformBox='view-box';
    path.style.transform=`translateY(${shift.toFixed(2)}px)`;
  });

  if(status){
    const text=state.tiltDeg>0
      ?`${paths.length} Ebene${paths.length===1?'':'n'} · Neigung ${Math.round(state.tiltDeg)}°`
      :`${paths.length} Ebene${paths.length===1?'':'n'} · Draufsicht`;
    if(status.textContent!==text)status.textContent=text;
  }
}

function setPreset(svg:SVGSVGElement,status:HTMLElement|null){
  state.yawDeg=-12;
  state.tiltDeg=38;
  applyView(svg,status);
}

function setTop(svg:SVGSVGElement,status:HTMLElement|null){
  state.yawDeg=0;
  state.tiltDeg=0;
  applyView(svg,status);
}

function bindDrag(svg:SVGSVGElement,status:HTMLElement|null){
  if(boundSvg===svg)return;
  boundSvg=svg;

  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.shiftKey)return;
    state.dragging=true;
    state.lastX=event.clientX;
    state.lastY=event.clientY;
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    if(!state.dragging)return;
    const dx=event.clientX-state.lastX;
    const dy=event.clientY-state.lastY;
    state.lastX=event.clientX;
    state.lastY=event.clientY;
    state.yawDeg=clamp(state.yawDeg+dx*.22,-35,35);
    state.tiltDeg=clamp(state.tiltDeg+dy*.22,0,55);
    applyView(svg,status);
  });
  const stop=()=>{state.dragging=false};
  svg.addEventListener('pointerup',stop);
  svg.addEventListener('pointercancel',stop);
}

export function syncToolpath25dControl(){
  ensureStyles();
  const view=document.querySelector<HTMLElement>('.geometry-view');
  const svg=view?.querySelector<SVGSVGElement>('svg');
  const caption=view?.querySelector<HTMLElement>('.geometry-caption');
  const captionTitle=caption?.querySelector('strong')?.textContent??'';
  const inspectorTitle=document.querySelector<HTMLElement>('.inspector h2')?.textContent?.trim()??'';
  const isFacing2d=captionTitle.startsWith('2D-Geometrie')&&inspectorTitle==='Planen';
  const toolpaths=svg?.querySelectorAll('.toolpath-preview').length??0;
  const existing=caption?.querySelector<HTMLElement>('.toolpath-25d-controls');

  if(!view||!svg||!caption||!isFacing2d||toolpaths===0){
    existing?.remove();
    view?.classList.remove('toolpath-25d-active');
    if(svg)clearTransforms(svg);
    return;
  }

  view.classList.add('toolpath-25d-active');
  let controls=existing;
  if(!controls){
    controls=document.createElement('span');
    controls.className='toolpath-25d-controls';
    const preset=document.createElement('button');
    preset.type='button';
    preset.textContent='2.5D';
    preset.title='Leicht geneigte Kontrollansicht der realen Z-Ebenen';
    const top=document.createElement('button');
    top.type='button';
    top.textContent='Draufsicht';
    top.title='Zur planaren Draufsicht zurückkehren';
    const status=document.createElement('span');
    status.className='toolpath-25d-status';
    controls.append(preset,top,status);
    caption.append(controls);
    preset.addEventListener('click',()=>{setPreset(svg,status);preset.classList.add('active');top.classList.remove('active')});
    top.addEventListener('click',()=>{setTop(svg,status);top.classList.add('active');preset.classList.remove('active')});
    bindDrag(svg,status);
  }

  const status=controls.querySelector<HTMLElement>('.toolpath-25d-status');
  applyView(svg,status);
}
