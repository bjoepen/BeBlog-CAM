import { writable } from 'svelte/store';

export type DxfEditViewMode='top'|'25d';
export type DxfEditViewState={mode:DxfEditViewMode;yawDeg:number;tiltDeg:number};

export const defaultDxfEditView:DxfEditViewState={mode:'top',yawDeg:-12,tiltDeg:38};
export const dxfEditView=writable<DxfEditViewState>({...defaultDxfEditView});

function syncDxfEditViewDom(state:DxfEditViewState){
  if(typeof document==='undefined')return;
  document.documentElement.dataset.dxfEditView=state.mode;
  if(document.getElementById('beblog-dxf-edit-view-style'))return;
  const style=document.createElement('style');
  style.id='beblog-dxf-edit-view-style';
  style.textContent='html[data-dxf-edit-view="25d"] .contour-overlay{display:none!important}';
  document.head.appendChild(style);
}

if(typeof document!=='undefined')dxfEditView.subscribe(syncDxfEditViewDom);

export function resetDxfEditView(){dxfEditView.set({...defaultDxfEditView});}
