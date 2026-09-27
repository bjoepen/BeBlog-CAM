import { isMillingTool, migrateMillingTool, type MillingTool } from './toolTypes';

export const TOOL_LIBRARY_SCHEMA = 'beblog-cam-tool-library' as const;
export const TOOL_LIBRARY_VERSION = 1 as const;

export interface PortableToolLibraryV1 {
  schema: typeof TOOL_LIBRARY_SCHEMA;
  version: typeof TOOL_LIBRARY_VERSION;
  tools: MillingTool[];
}

export function createPortableToolLibrary(tools: readonly MillingTool[]): PortableToolLibraryV1 {
  return {
    schema: TOOL_LIBRARY_SCHEMA,
    version: TOOL_LIBRARY_VERSION,
    tools: tools.map((tool) => ({ ...tool }))
  };
}

export function serializePortableToolLibrary(tools: readonly MillingTool[]): string {
  return JSON.stringify(createPortableToolLibrary(tools), null, 2);
}

export function portableToolLibraryFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `beblog-cam-tool-library-${yyyy}-${mm}-${dd}.json`;
}

export type PortableToolLibraryParseResult =
  | { ok: true; tools: MillingTool[] }
  | { ok: false; error: string };

export function parsePortableToolLibrary(text: string): PortableToolLibraryParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei enthält kein gültiges JSON.' };
  }
  if (!value || typeof value !== 'object') return { ok: false, error: 'Ungültige Werkzeugbibliothek.' };
  const envelope = value as Record<string, unknown>;
  if (envelope.schema !== TOOL_LIBRARY_SCHEMA) return { ok: false, error: 'Unbekanntes Werkzeugbibliothek-Schema.' };
  if (envelope.version !== TOOL_LIBRARY_VERSION) return { ok: false, error: `Werkzeugbibliothek-Version ${String(envelope.version)} wird nicht unterstützt.` };
  if (!Array.isArray(envelope.tools)) return { ok: false, error: 'Werkzeugliste fehlt oder ist ungültig.' };

  const tools: MillingTool[] = [];
  const ids = new Set<string>();
  for (const raw of envelope.tools) {
    const migrated = migrateMillingTool(raw);
    if (!migrated || !isMillingTool(migrated)) return { ok: false, error: 'Mindestens ein Werkzeug ist ungültig.' };
    if (ids.has(migrated.id)) return { ok: false, error: `Werkzeug-ID ${migrated.id} ist in der Importdatei doppelt vorhanden.` };
    ids.add(migrated.id);
    tools.push({ ...migrated });
  }
  return { ok: true, tools };
}
