import { mount, unmount } from 'svelte';
import App from './App.svelte';
import CamMascot from './lib/CamMascot.svelte';
import StockMaterialSelector from './lib/StockMaterialSelector.svelte';
import './app.css';
import './floh.css';

mount(App, { target: document.getElementById('app')! });

let materialSelector: ReturnType<typeof mount> | null = null;
let materialHost: HTMLElement | null = null;

function syncMaterialSelector() {
  const inspector = document.querySelector<HTMLElement>('.inspector');
  const eyebrow = inspector?.querySelector<HTMLElement>('.eyebrow');
  const isStockStep = eyebrow?.textContent?.trim().startsWith('02 · Rohling') ?? false;

  if (isStockStep && inspector) {
    if (!materialHost || !materialHost.isConnected) {
      materialHost = document.createElement('div');
      materialHost.className = 'stock-material-host';
      const heading = inspector.querySelector('h2');
      if (heading) heading.insertAdjacentElement('afterend', materialHost);
      else inspector.prepend(materialHost);
      materialSelector = mount(StockMaterialSelector, { target: materialHost });
    }
  } else if (materialSelector && materialHost) {
    unmount(materialSelector);
    materialSelector = null;
    materialHost.remove();
    materialHost = null;
  }
}

requestAnimationFrame(() => {
  const build = document.querySelector<HTMLElement>('.build');
  if (build && build.textContent !== '001X') build.textContent = '001X';

  const rail = document.querySelector<HTMLElement>('.rail');
  if (rail && !rail.querySelector('.cam-mascot')) {
    mount(CamMascot, { target: rail });
  }

  syncMaterialSelector();

  const root = document.getElementById('app');
  if (!root) return;
  const observer = new MutationObserver(syncMaterialSelector);
  observer.observe(root, { childList: true, subtree: true });
});
