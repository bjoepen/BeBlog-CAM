type ViewState={
  yawDeg:number;
  tiltDeg:number;
  dragging:boolean;
  lastX:number;
  lastY:number;
};

type ViewContext={
  svgs:SVGSVGElement[];
  paths:SVGPathElement[];
  status:HTMLElement|null;
  overlay:HTMLElement|null;
};

const state:ViewState={yawDeg:0,tiltDeg:0,dragging:false,lastX:0,lastY:0};
const boundSvgs=new WeakSet<SVGSVGElement>();

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

function stockWidthMm(overlay:HTMLElement|null):number|null{
  const fromOverlay=parseNumber(overlay?.dataset.stockWidth);
  if(fromOverlay&&fromOverlay>0)return fromOverlay;
  const note=[...document.querySelectorAll<HTMLElement>('.inspector .note')]
    .map(item=>item.textContent??'')
    .find(text=>text.includes('Rohlingfläche'));
  const match=note?.match(/([\d.,]+)\s*×\s*([\d.,]+)\s*mm\s*Rohlingfläche/i);
  return parseNumber(match?.[1]);
}

function cuttingDepths(count:number):number[]{
  const total=inspectorNumber('Planabtrag')??inspectorNumber('Gesamttiefe');
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
    .geometry-view.toolpath-25d-active svg,.contour-overlay.toolpath-25d-active svg{cursor:grab}
    .geometry-view.toolpath-25d-active svg:active,.contour-overlay.toolpath-25d-active svg:active{cursor:grabbing}
  `;
  document.head.append(style);
}

function clearTransforms(svgs:SVGSVGElement[]){
  for(const svg of svgs){
    svg.style.transform='';
    svg.style.transformOrigin='';
    svg.style.overflow='';
    svg.querySelectorAll<SVGPathElement>('.toolpath-preview').forEach(path=>{
      path.style.transform='';
      path.style.transformBox='';
    });
  }
}

function exactDepth(path:SVGPathElement,index:number,fallback:number[]):number{
  const z=parseNumber(path.dataset.toolpathZ);
  return z===null?(fallback[index]??0):Math.abs(z);
}

function applyView(context:ViewContext){
  const {svgs,paths,status,overlay}=context;
  if(!paths.length)return;
  const tiltRad=state.tiltDeg*Math.PI/180;
  const scaleY=Math.max(.56,Math.cos(tiltRad));
  for(const svg of svgs){
    svg.style.transformOrigin='50% 50%';
    svg.style.transform=`rotate(${state.yawDeg.toFixed(2)}deg) scaleY(${scaleY.toFixed(4)})`;
    svg.style.overflow='visible';
  }

  const baseSvg=svgs[0];
  const stock=baseSvg?.querySelector<SVGGraphicsElement>('path.stock');
  const stockMm=stockWidthMm(overlay);
  const stockUnits=stock?.getBBox().width??0;
  const pxPerMm=stockMm&&stockMm>0&&stockUnits>0?stockUnits/stockMm:8;
  const fallback=cuttingDepths(paths.length);
  const separation=Math.sin(tiltRad);

  paths.forEach((path,index)=>{
    const shift=exactDepth(path,index,fallback)*pxPerMm*separation;
    path.style.transformBox='view-box';
    path.style.transform=`translateY(${shift.toFixed(2)}px)`;
  });

  if(status){
    const explicit=[...new Set(paths.map(path=>parseNumber(path.dataset.toolpathZ)).filter((value):value is number=>value!==null).map(value=>value.toFixed(6)))];
    const levels=explicit.length||paths.length;
    const text=state.tiltDeg>0
      ?`${levels} Ebene${levels===1?'':'n'} · Neigung ${Math.round(state.tiltDeg)}°`
      :`${levels} Ebene${levels===1?'':'n'} · Draufsicht`;
    if(status.textContent!==text)status.textContent=text;
  }
}

function currentContext(status:HTMLElement|null):ViewContext{
  const view=document.querySelector<HTMLElement>('.geometry-view');
  const baseSvg=view?.querySelector<SVGSVGElement>('svg')??null;
  const overlay=document.querySelector<HTMLElement>('.contour-overlay');
  const overlaySvg=overlay?.querySelector<SVGSVGElement>('svg')??null;
  const inspectorTitle=document.querySelector<HTMLElement>('.inspector h2')?.textContent?.trim()??'';
  const root=inspectorTitle==='Kontur'||inspectorTitle==='Tasche'?overlaySvg:baseSvg;
  return{
    svgs:[baseSvg,overlaySvg].filter((svg):svg is SVGSVGElement=>!!svg),
    paths:root?[...root.querySelectorAll<SVGPathElement>('.toolpath-preview')]:[],
    status,
    overlay,
  };
}

function setPreset(status:HTMLElement|null){
  state.yawDeg=-12;
  state.tiltDeg=38;
  applyView(currentContext(status));
}

function setTop(status:HTMLElement|null){
  state.yawDeg=0;
  state.tiltDeg=0;
  applyView(currentContext(status));
}

function bindDrag(svg:SVGSVGElement,status:HTMLElement|null){
  if(boundSvgs.has(svg))return;
  boundSvgs.add(svg);
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.shiftKey||event.target!==svg)return;
    state.dragging=true;
    state.lastX=event.clientX;
    state.lastY=event.clientY;
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    if(!state.dragging)return;
    const dx=event.clientX-state.lastX,dy=event.clientY-state.lastY;
    state.lastX=event.clientX;state.lastY=event.clientY;
    state.yawDeg=clamp(state.yawDeg+dx*.22,-35,35);
    state.tiltDeg=clamp(state.tiltDeg+dy*.22,0,55);
    applyView(currentContext(status));
  });
  const stop=()=>{state.dragging=false};
  svg.addEventListener('pointerup',stop);
  svg.addEventListener('pointercancel',stop);
}

export function syncToolpath25dControl(){
  ensureStyles();
  const view=document.querySelector<HTMLElement>('.geometry-view');
  const baseSvg=view?.querySelector<SVGSVGElement>('svg')??null;
  const caption=view?.querySelector<HTMLElement>('.geometry-caption')??null;
  const overlay=document.querySelector<HTMLElement>('.contour-overlay');
  const overlaySvg=overlay?.querySelector<SVGSVGElement>('svg')??null;
  const captionTitle=caption?.querySelector('strong')?.textContent??'';
  const inspectorTitle=document.querySelector<HTMLElement>('.inspector h2')?.textContent?.trim()??'';
  const isSupported2d=captionTitle.startsWith('2D-Geometrie')&&(inspectorTitle==='Planen'||inspectorTitle==='Kontur'||inspectorTitle==='Tasche');
  const root=inspectorTitle==='Kontur'||inspectorTitle==='Tasche'?overlaySvg:baseSvg;
  const paths=root?[...root.querySelectorAll<SVGPathElement>('.toolpath-preview')]:[];
  const svgs=[baseSvg,overlaySvg].filter((svg):svg is SVGSVGElement=>!!svg);
  const existing=caption?.querySelector<HTMLElement>('.toolpath-25d-controls');

  if(!view||!baseSvg||!caption||!isSupported2d||paths.length===0){
    existing?.remove();
    view?.classList.remove('toolpath-25d-active');
    overlay?.classList.remove('toolpath-25d-active');
    clearTransforms(svgs);
    return;
  }

  view.classList.add('toolpath-25d-active');
  overlay?.classList.add('toolpath-25d-active');
  let controls=existing;
  if(!controls){
    controls=document.createElement('span');
    controls.className='toolpath-25d-controls';
    const preset=document.createElement('button');
    preset.type='button';preset.textContent='2.5D';preset.title='Leicht geneigte Kontrollansicht der realen Z-Ebenen';
    const top=document.createElement('button');
    top.type='button';top.textContent='Draufsicht';top.title='Zur planaren Draufsicht zurückkehren';
    const status=document.createElement('span');status.className='toolpath-25d-status';
    controls.append(preset,top,status);caption.append(controls);
    preset.addEventListener('click',()=>{setPreset(status);preset.classList.add('active');top.classList.remove('active')});
    top.addEventListener('click',()=>{setTop(status);top.classList.add('active');preset.classList.remove('active')});
    for(const svg of svgs)bindDrag(svg,status);
  }

  const status=controls.querySelector<HTMLElement>('.toolpath-25d-status');
  applyView({svgs,paths,status,overlay});
}
