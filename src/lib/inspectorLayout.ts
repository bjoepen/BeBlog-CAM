export const INSPECTOR_LAYOUT_STORAGE_KEY = 'beblog-cam.inspector-layout.v1';
export const INSPECTOR_DEFAULT_WIDTH = 330;
export const INSPECTOR_MIN_WIDTH = 330;
export const INSPECTOR_MAX_WIDTH = 650;
export const VIEWPORT_MIN_WIDTH = 450;

export type InspectorLayoutPreference = { width: number };

const defaultPreference: InspectorLayoutPreference = { width: INSPECTOR_DEFAULT_WIDTH };

export function normalizeInspectorLayoutPreference(value: unknown): InspectorLayoutPreference {
  if (!value || typeof value !== 'object') return { ...defaultPreference };
  const candidate = value as { mode?: unknown; width?: unknown };
  if (candidate.mode !== undefined && candidate.mode !== 'compact' && candidate.mode !== 'expanded' && candidate.mode !== 'custom') {
    return { ...defaultPreference };
  }
  let requestedWidth = candidate.width;
  // Read the previous version's mode-tagged values without requiring a
  // project migration. Its stored width remains the authoritative preference.
  if (requestedWidth === undefined && candidate.mode === 'compact') requestedWidth = INSPECTOR_DEFAULT_WIDTH;
  if (requestedWidth === undefined && candidate.mode === 'expanded') requestedWidth = 520;
  if (typeof requestedWidth !== 'number' || !Number.isFinite(requestedWidth)) return { ...defaultPreference };
  return { width: Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, Math.round(requestedWidth))) };
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
  const safeRequested = Number.isFinite(requestedWidth) ? requestedWidth : INSPECTOR_DEFAULT_WIDTH;
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
