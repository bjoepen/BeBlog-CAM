import type { MillingTool } from './toolTypes';

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
