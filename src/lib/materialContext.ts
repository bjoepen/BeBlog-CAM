import { writable } from 'svelte/store';

export type MaterialKind = 'wood-mdf' | 'plastic' | 'aluminium' | 'steel';

export interface MaterialProfile {
  id: MaterialKind;
  label: string;
  shortLabel: string;
  cuttingSpeedMMin: number;
  chipLoadFactor: number;
  note: string;
}

export const materialProfiles: Record<MaterialKind, MaterialProfile> = {
  'wood-mdf': {
    id: 'wood-mdf',
    label: 'Holz / MDF',
    shortLabel: 'Holz / MDF',
    cuttingSpeedMMin: 250,
    chipLoadFactor: 1,
    note: 'Startprofil für Holzwerkstoffe und MDF.'
  },
  plastic: {
    id: 'plastic',
    label: 'Kunststoff',
    shortLabel: 'Kunststoff',
    cuttingSpeedMMin: 180,
    chipLoadFactor: 0.8,
    note: 'Konservatives Startprofil für thermoplastische Kunststoffe.'
  },
  aluminium: {
    id: 'aluminium',
    label: 'Aluminium',
    shortLabel: 'Aluminium',
    cuttingSpeedMMin: 120,
    chipLoadFactor: 0.65,
    note: 'Konservatives Startprofil für Aluminium auf Hobby-CNCs.'
  },
  steel: {
    id: 'steel',
    label: 'Stahl',
    shortLabel: 'Stahl',
    cuttingSpeedMMin: 50,
    chipLoadFactor: 0.35,
    note: 'Sehr konservatives Startprofil. Maschinensteifigkeit und Werkzeugfreigabe prüfen.'
  }
};

export const materialKinds = Object.keys(materialProfiles) as MaterialKind[];

const STORAGE_KEY = 'beblog-cam.stock-material.v1';
const DEFAULT_MATERIAL: MaterialKind = 'wood-mdf';

function isMaterialKind(value: unknown): value is MaterialKind {
  return typeof value === 'string' && value in materialProfiles;
}

function initialMaterial(): MaterialKind {
  if (typeof localStorage === 'undefined') return DEFAULT_MATERIAL;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMaterialKind(stored) ? stored : DEFAULT_MATERIAL;
  } catch {
    return DEFAULT_MATERIAL;
  }
}

export const stockMaterial = writable<MaterialKind>(initialMaterial());

export function setStockMaterial(material: MaterialKind): void {
  stockMaterial.set(material);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, material);
  } catch {
    // Persistenz ist hilfreich, aber nicht Voraussetzung für die CAM-Berechnung.
  }
}
