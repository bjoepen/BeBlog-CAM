import { writable } from 'svelte/store';

export type DxfEditViewMode='top'|'25d';
export type DxfEditViewState={mode:DxfEditViewMode;yawDeg:number;tiltDeg:number};

export const defaultDxfEditView:DxfEditViewState={mode:'top',yawDeg:-12,tiltDeg:38};
export const dxfEditView=writable<DxfEditViewState>({...defaultDxfEditView});

export function resetDxfEditView(){dxfEditView.set({...defaultDxfEditView});}
