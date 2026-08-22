import { mount } from 'svelte';
import App from './App.svelte';
import CamMascot from './lib/CamMascot.svelte';
import './app.css';
import './floh.css';

mount(App, { target: document.getElementById('app')! });

requestAnimationFrame(() => {
  const rail = document.querySelector<HTMLElement>('.rail');
  if (rail && !rail.querySelector('.cam-mascot')) {
    mount(CamMascot, { target: rail });
  }
});
