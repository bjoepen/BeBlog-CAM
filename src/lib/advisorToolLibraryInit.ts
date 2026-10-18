import { get } from 'svelte/store';
import { advisorToolLibrary, publishAdvisorToolLibrary } from './advisorToolLibrary';
import { migrateMillingTool, type MillingTool } from './toolTypes';

export const TOOL_LIBRARY_STORAGE_KEY = 'beblog-cam.tool-library.v1';

/** 011-E5D: one central, fail-closed startup read; never rewrites stored data. */
export function initializeAdvisorToolLibrary(storage: Pick<Storage, 'getItem'>): boolean {
  // Avoid replacing a library already published by the editor.
  if (get(advisorToolLibrary).ready) return true;
  try {
    const raw = storage.getItem(TOOL_LIBRARY_STORAGE_KEY);
    if (raw === null) {
      publishAdvisorToolLibrary([]);
      return true;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    const migrated = parsed.map(migrateMillingTool);
    if (migrated.some(tool => tool === null)) return false;
    const tools = migrated as MillingTool[];
    if (new Set(tools.map(tool => tool.id)).size !== tools.length) return false;
    publishAdvisorToolLibrary(tools);
    return true;
  } catch {
    return false;
  }
}
