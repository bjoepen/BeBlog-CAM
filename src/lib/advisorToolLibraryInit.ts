import { get } from 'svelte/store';
import { advisorToolLibrary, invalidateAdvisorToolLibrary, publishAdvisorToolLibrary } from './advisorToolLibrary';
import { migrateMillingTool, type MillingTool } from './toolTypes';

export const TOOL_LIBRARY_STORAGE_KEY = 'beblog-cam.tool-library.v1';

/** 011-E5D: one central, fail-closed startup read; never rewrites stored data. */
export function initializeAdvisorToolLibrary(storage: { getItem(key: string): string | null }): boolean {
  // Avoid replacing a library already published by the editor.
  if (get(advisorToolLibrary).ready) return true;
  try {
    const raw = storage.getItem(TOOL_LIBRARY_STORAGE_KEY);
    if (raw === null) {
      publishAdvisorToolLibrary([]);
      return true;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) { invalidateAdvisorToolLibrary(); return false; }
    const migrated = parsed.map(migrateMillingTool);
    if (migrated.some(tool => tool === null)) { invalidateAdvisorToolLibrary(); return false; }
    const tools = migrated as MillingTool[];
    if (new Set(tools.map(tool => tool.id)).size !== tools.length) { invalidateAdvisorToolLibrary(); return false; }
    publishAdvisorToolLibrary(tools);
    return get(advisorToolLibrary).ready;
  } catch {
    invalidateAdvisorToolLibrary();
    return false;
  }
}

/** Another window changed or cleared the persistent library. Never continue
 * screening against a potentially stale snapshot; a restart reloads storage. */
export function invalidateAdvisorOnExternalLibraryChange(key: string | null): boolean {
  if (key !== null && key !== TOOL_LIBRARY_STORAGE_KEY) return false;
  invalidateAdvisorToolLibrary();
  return true;
}

/** 011-E5F: explicit, read-only reload. Never trust the old in-memory snapshot.
 * Invalid storage stays untouched and the Advisor remains blocked. */
export function reloadAdvisorToolLibrary(storage: { getItem(key: string): string | null }): boolean {
  invalidateAdvisorToolLibrary();
  return initializeAdvisorToolLibrary(storage) && get(advisorToolLibrary).ready;
}
