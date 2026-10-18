import { writable } from 'svelte/store';
import { isMillingTool, type MillingTool } from './toolTypes';

/** 011-E5C: published snapshot of the existing local tool library.
 * Only the library editor publishes; operation assignments never become evidence.
 * The revision changes with every publish, including same-content replacements.
 */
export type AdvisorToolLibrarySnapshot = {
  source: 'local-tool-library-v1';
  revision: number;
  ready: boolean;
  tools: readonly MillingTool[];
};

const initial: AdvisorToolLibrarySnapshot = {
  source: 'local-tool-library-v1', revision: 0, ready: false, tools: []
};
export const advisorToolLibrary = writable<AdvisorToolLibrarySnapshot>(initial);
let revision = 0;

export function publishAdvisorToolLibrary(entries: readonly MillingTool[]): void {
  // Reject the whole publication instead of silently treating invalid entries
  // as complete capabilities. The editor remains the source of truth.
  if (!Array.isArray(entries) || !entries.every(isMillingTool) ||
      new Set(entries.map(tool => tool.id)).size !== entries.length) {
    revision++;
    advisorToolLibrary.set({ source: 'local-tool-library-v1', revision, ready: false, tools: [] });
    return;
  }
  revision++;
  advisorToolLibrary.set({
    source: 'local-tool-library-v1', revision, ready: true,
    tools: entries.map(tool => ({ ...tool }))
  });
}

/** Explicitly revoke a previously published snapshot on failed initialization. */
export function invalidateAdvisorToolLibrary(): void {
  revision++;
  advisorToolLibrary.set({ source: 'local-tool-library-v1', revision, ready: false, tools: [] });
}
