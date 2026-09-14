import { run008a5 } from './008a5-estlcam';

export function build008c2Reference(source: string, operationIds: string[], expectedToolChanges: number) {
  const posted = run008a5(source);
  if (!posted.ok) throw new Error(posted.errors.join(' | '));
  const code = posted.code.endsWith('\n') ? posted.code : `${posted.code}\n`;
  const lines = code.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const manifest = {
    qualification: '008C2',
    controller: 'Estlcam 11 build 11245',
    workflow: '3-axis milling / millimetres / manual tool change',
    sourceFixture: '008A4 synthetic multi-operation production job',
    operationIds,
    expectedToolChanges,
    actualToolChanges: lines.filter((line) => /^M6$/i.test(line)).length,
    lineCount: lines.length,
    terminalCommand: lines.at(-1) ?? null,
    removedLines: posted.removedLines,
    transformedLines: posted.transformedLines,
  };
  return { code, manifest };
}
