import { mount, unmount } from 'svelte';
import App from './App.svelte';
import CamMascot from './lib/CamMascot.svelte';
import StockMaterialSelector from './lib/StockMaterialSelector.svelte';
import { syncToolpath25dControl } from './lib/toolpath25dControl';
import { syncDxfNoStockDrillGuard } from './lib/dxfNoStockDrillGuard';
import './app.css';
import './floh.css';
import './overlay-fix.css';
import './bearbeiten-inspector.css';

mount(App, { target: document.getElementById('app')! });

let materialSelector: ReturnType<typeof mount> | null = null;
let materialHost: HTMLElement | null = null;

const retiredStepProofControls = new Set([
  'Gekrümmte Zielfläche',
  'Hohlkehle Schruppen',
  'Ballnose Kontakt',
  'Modellregionen',
  'Stock − Model',
  'Modell-Schruppbahn',
]);

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

function syncRetiredExperimentalControls() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('.geometry-caption .help button')) {
    const label = button.textContent?.trim() ?? '';
    if (!retiredStepProofControls.has(label)) continue;
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
    button.tabIndex = -1;
  }
}

function syncUiExtensions() {
  syncMaterialSelector();
  syncToolpath25dControl();
  syncDxfNoStockDrillGuard();
  syncRetiredExperimentalControls();
}

requestAnimationFrame(() => {
  const build = document.querySelector<HTMLElement>('.build');
  if (build && build.textContent !== '001Y') build.textContent = '001Y';

  const rail = document.querySelector<HTMLElement>('.rail');
  if (rail && !rail.querySelector('.cam-mascot')) {
    mount(CamMascot, { target: rail });
  }

  syncUiExtensions();

  const root = document.getElementById('app');
  if (!root) return;
  const observer = new MutationObserver(syncUiExtensions);
  observer.observe(root, { childList: true, subtree: true });
});
