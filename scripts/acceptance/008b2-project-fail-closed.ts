import { CAM_PROJECT_FORMAT, CAM_PROJECT_VERSION, parseCamProject } from '../../src/lib/projectPersistence';

type FailureCase = {
  id: string;
  text: string;
  expected: string;
};

const validShell = {
  format: CAM_PROJECT_FORMAT,
  version: CAM_PROJECT_VERSION,
  source: { path: '/fixtures/008b2-reference.dxf', fileName: '008b2-reference.dxf' },
  setup: {},
  operationsProject: { operations: [], activeOperationId: null },
};

const cases: FailureCase[] = [
  { id: 'malformed-json', text: '{"format":', expected: 'Projektdatei ist kein gültiges JSON:' },
  { id: 'non-object-root', text: '[]', expected: 'Projektdatei besitzt kein gültiges Objektformat.' },
  { id: 'wrong-format', text: JSON.stringify({ ...validShell, format: 'other-project' }), expected: 'Datei ist kein BeBlog-CAM-Projekt.' },
  { id: 'missing-version', text: JSON.stringify({ ...validShell, version: undefined }), expected: 'Projektdatei enthält keine Formatversion.' },
  { id: 'newer-version', text: JSON.stringify({ ...validShell, version: CAM_PROJECT_VERSION + 1 }), expected: `Projektversion ${CAM_PROJECT_VERSION + 1} ist neuer als diese BeBlog-CAM-Version unterstützt.` },
  { id: 'older-version', text: JSON.stringify({ ...validShell, version: 0 }), expected: 'Projektversion 0 wird nicht unterstützt.' },
  { id: 'missing-source', text: JSON.stringify({ ...validShell, source: { path: '', fileName: '008b2-reference.dxf' } }), expected: 'Projektdatei enthält keine gültige Quelldatei-Referenz.' },
  { id: 'missing-setup', text: JSON.stringify({ ...validShell, setup: null }), expected: 'Projektdatei enthält kein gültiges Setup.' },
  { id: 'missing-operations', text: JSON.stringify({ ...validShell, operationsProject: { operations: null, activeOperationId: null } }), expected: 'Projektdatei enthält kein gültiges Operationsprojekt.' },
];

export function run008b2() {
  return cases.map(testCase => {
    try {
      parseCamProject(testCase.text);
      return { id: testCase.id, rejected: false, expected: testCase.expected, error: null };
    } catch (error) {
      return {
        id: testCase.id,
        rejected: true,
        expected: testCase.expected,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

console.log(JSON.stringify(run008b2()));
