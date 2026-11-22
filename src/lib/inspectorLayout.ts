export const INSPECTOR_LAYOUT_STORAGE_KEY = 'beblog-cam.inspector-layout.v1';
export const INSPECTOR_COMPACT_WIDTH = 330;
export const INSPECTOR_EXPANDED_WIDTH = 520;
export const INSPECTOR_MIN_WIDTH = 330;
export const INSPECTOR_MAX_WIDTH = 650;
export const VIEWPORT_MIN_WIDTH = 450;

export type InspectorMode = 'compact' | 'expanded' | 'custom';
export type InspectorLayoutPreference = { mode: InspectorMode; width: number };

const defaultPreference: InspectorLayoutPreference = { mode: 'compact', width: INSPECTOR_COMPACT_WIDTH };

export function normalizeInspectorLayoutPreference(value: unknown): InspectorLayoutPreference {
  if (!value || typeof value !== 'object') return { ...defaultPreference };
  const candidate = value as { mode?: unknown; width?: unknown };
  if (candidate.mode !== 'compact' && candidate.mode !== 'expanded' && candidate.mode !== 'custom') {
    return { ...defaultPreference };
  }
  if (candidate.mode === 'compact') return { mode: 'compact', width: INSPECTOR_COMPACT_WIDTH };
  if (candidate.mode === 'expanded') return { mode: 'expanded', width: INSPECTOR_EXPANDED_WIDTH };
  if (typeof candidate.width !== 'number' || !Number.isFinite(candidate.width)) return { ...defaultPreference };
  return { mode: 'custom', width: Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, Math.round(candidate.width))) };
}

export function loadInspectorLayoutPreference(storage: Pick<Storage, 'getItem'>): InspectorLayoutPreference {
  try {
    const stored = storage.getItem(INSPECTOR_LAYOUT_STORAGE_KEY);
    return stored ? normalizeInspectorLayoutPreference(JSON.parse(stored)) : { ...defaultPreference };
  } catch {
    return { ...defaultPreference };
  }
}

export function saveInspectorLayoutPreference(
  storage: Pick<Storage, 'setItem'>,
  preference: InspectorLayoutPreference,
): boolean {
  try {
    storage.setItem(INSPECTOR_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeInspectorLayoutPreference(preference)));
    return true;
  } catch {
    return false;
  }
}

export function clampInspectorWidth(requestedWidth: number, workspaceWidth: number): number {
  const upper = Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, Math.floor(workspaceWidth - VIEWPORT_MIN_WIDTH)));
  const safeRequested = Number.isFinite(requestedWidth) ? requestedWidth : INSPECTOR_COMPACT_WIDTH;
  return Math.min(upper, Math.max(INSPECTOR_MIN_WIDTH, Math.round(safeRequested)));
}

export function resizeInspectorWidth(currentWidth: number, delta: number, workspaceWidth: number): number {
  return clampInspectorWidth(currentWidth + delta, workspaceWidth);
}

export function inspectorWidthFromDrag(startWidth: number, startX: number, currentX: number, workspaceWidth: number): number {
  return resizeInspectorWidth(startWidth, startX - currentX, workspaceWidth);
}

export function keyboardInspectorResizeDelta(key: string, shiftKey: boolean): number | null {
  const step = shiftKey ? 64 : 16;
  if (key === 'ArrowRight') return step;
  if (key === 'ArrowLeft') return -step;
  return null;
}
