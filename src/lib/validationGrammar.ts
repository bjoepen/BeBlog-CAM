import type { CamOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import type { MillingToolKind } from './toolTypes';

export type ValidationLevel = 'pass' | 'warn' | 'fail';
export type ValidationCategory = 'geometry' | 'tool' | 'strategy' | 'depth' | 'cut-data' | 'setup' | 'stock' | 'toolpath';
export type ValidationCheck = { level: ValidationLevel; category: ValidationCategory; title: string; detail: string };

const toolLabel = (kind: MillingToolKind | undefined) => kind === 'face-mill' ? 'Planfräser' : kind === 'end-mill' ? 'Schaftfräser' : kind === 'ball-nose' ? 'Vollradiusfräser' : kind === 'v-bit' ? 'V-Fräser' : 'nicht typisiertes Werkzeug';

export function validationLevel(checks: ValidationCheck[]): ValidationLevel {
  return checks.some(c => c.level === 'fail') ? 'fail' : checks.some(c => c.level === 'warn') ? 'warn' : 'pass';
}

export function validateCommonOperation(operation: CamOperation, stock: StockDefinition, stockMode: StockMode, wcs: WorkCoordinateSystem): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  checks.push(operation.tool.diameterMm > 0
    ? { level: 'pass', category: 'tool', title: 'Werkzeugdurchmesser', detail: `Ø ${operation.tool.diameterMm.toFixed(3)} mm.` }
    : { level: 'fail', category: 'tool', title: 'Werkzeugdurchmesser', detail: 'Werkzeugdurchmesser muss größer als 0 sein.' });

  checks.push(operation.totalDepthMm > 0
    ? { level: 'pass', category: 'depth', title: operation.kind === 'facing' ? 'Planabtrag' : 'Tiefe', detail: `${operation.totalDepthMm.toFixed(3)} mm.` }
    : { level: 'fail', category: 'depth', title: operation.kind === 'facing' ? 'Planabtrag' : 'Tiefe', detail: 'Der Wert muss größer als 0 sein.' });

  checks.push(operation.stepDownMm > 0
    ? { level: 'pass', category: 'depth', title: operation.kind === 'drill' && operation.method === 'helical-mill' ? 'Helix-Zustellung' : 'Zustellung', detail: `${operation.stepDownMm.toFixed(3)} mm${operation.kind === 'drill' && operation.method === 'helical-mill' ? '/U' : ''}.` }
    : { level: 'fail', category: 'depth', title: 'Zustellung', detail: 'Zustellung muss größer als 0 sein.' });

  checks.push(operation.feedMmMin > 0 && operation.plungeMmMin > 0 && operation.spindleRpm > 0
    ? { level: 'pass', category: 'cut-data', title: 'Schnittdaten', detail: `${operation.feedMmMin} mm/min · Eintauchen ${operation.plungeMmMin} mm/min · ${operation.spindleRpm} 1/min.` }
    : { level: 'fail', category: 'cut-data', title: 'Schnittdaten', detail: 'Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.' });

  checks.push(operation.safeZMm > 0
    ? { level: 'pass', category: 'setup', title: 'Sicherheits-Z', detail: `${operation.safeZMm.toFixed(3)} mm über Werkstücknull.` }
    : { level: 'fail', category: 'setup', title: 'Sicherheits-Z', detail: 'Sicherheits-Z muss größer als 0 sein.' });

  if (stockMode === 'none') checks.push({ level: operation.kind === 'facing' ? 'fail' : 'warn', category: 'stock', title: 'Rohling', detail: operation.kind === 'facing' ? 'Planen benötigt einen definierten Rohling.' : 'Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.' });
  else if (operation.totalDepthMm > stock.thickness) checks.push({ level: operation.kind === 'facing' ? 'fail' : 'warn', category: 'stock', title: 'Rohlingtiefe', detail: `${operation.totalDepthMm.toFixed(3)} mm überschreiten die Rohlingdicke ${stock.thickness.toFixed(3)} mm.` });
  else checks.push({ level: 'pass', category: 'stock', title: 'Rohlingtiefe', detail: `${operation.totalDepthMm.toFixed(3)} mm liegen innerhalb der Rohlingdicke ${stock.thickness.toFixed(3)} mm.` });

  if (wcs.z !== 'top') checks.push({ level: 'fail', category: 'setup', title: 'WCS Z', detail: 'Die aktuellen 2D/2,5D-Bearbeitungen sind nur mit Z-Null auf der Rohlingoberseite freigegeben.' });
  else checks.push({ level: 'pass', category: 'setup', title: 'WCS Z', detail: 'Z-Null liegt auf der Rohlingoberseite.' });
  return checks;
}

export function validateToolCompatibility(operation: CamOperation): ValidationCheck {
  const kind = operation.tool.kind;
  const label = toolLabel(kind);

  if (operation.kind === 'facing') {
    if (kind === 'face-mill') return { level: 'pass', category: 'tool', title: 'Werkzeug · Operation', detail: 'Planfräser ist die bevorzugte Werkzeugart für Planen.' };
    if (kind === 'end-mill' || !kind) return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: `${label} ist für Planen zulässig; für größere Planflächen ist ein Planfräser bevorzugt.` };
    return { level: 'fail', category: 'tool', title: 'Werkzeug · Operation', detail: `${label} ist für Planen nicht freigegeben.` };
  }

  if (operation.kind === 'drill' && operation.method === 'helical-mill') {
    return kind === 'end-mill'
      ? { level: 'pass', category: 'tool', title: 'Werkzeug · Strategie', detail: 'Schaftfräser ist für Helixfräsen freigegeben.' }
      : { level: 'fail', category: 'tool', title: 'Werkzeug · Strategie', detail: 'Helixfräsen benötigt einen Schaftfräser aus der Werkzeugbibliothek.' };
  }

  if (operation.kind === 'drill') {
    if (!kind) return { level: 'pass', category: 'tool', title: 'Werkzeug · Operation', detail: 'Nicht typisiertes Werkzeug wird für axiales Bohren als Bohrer behandelt.' };
    if (kind === 'end-mill') return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'Schaftfräser kann axial eintauchen, sofern er dafür geeignet ist; die Werkzeugbibliothek kennt diese Eigenschaft noch nicht.' };
    return { level: 'fail', category: 'tool', title: 'Werkzeug · Operation', detail: `${label} ist für axiales Bohren nicht freigegeben.` };
  }

  if (operation.kind === 'pocket') {
    if (operation.entry === 'helix' && kind !== 'end-mill') return { level: 'fail', category: 'tool', title: 'Werkzeug · Strategie', detail: 'Helix-Eintauchen in Kreistaschen benötigt einen Schaftfräser.' };
    if (kind === 'end-mill') return { level: 'pass', category: 'tool', title: 'Werkzeug · Operation', detail: 'Schaftfräser ist für Taschen freigegeben.' };
    if (kind === 'ball-nose') return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'Vollradiusfräser ist geometrisch möglich, erzeugt aber keinen ebenen Taschenboden.' };
    if (kind === 'face-mill' || kind === 'v-bit') return { level: 'fail', category: 'tool', title: 'Werkzeug · Operation', detail: `${label} ist für die aktuelle Taschenberechnung nicht freigegeben.` };
    return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'Werkzeugtyp ist unbekannt; Taschenbearbeitung sollte mit einem Schaftfräser erfolgen.' };
  }

  if (operation.kind === 'contour') {
    if (kind === 'end-mill') return { level: 'pass', category: 'tool', title: 'Werkzeug · Operation', detail: 'Schaftfräser ist für 2D-Konturen freigegeben.' };
    if (kind === 'ball-nose') return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'Vollradiusfräser kann Konturen fahren, verändert aber die Geometrie am Konturgrund.' };
    if (kind === 'face-mill' || kind === 'v-bit') return { level: 'fail', category: 'tool', title: 'Werkzeug · Operation', detail: `${label} ist für die aktuelle radiuskorrigierte 2D-Kontur nicht freigegeben.` };
    return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'Werkzeugtyp ist unbekannt; Radiuskorrektur wird nur über den Nenndurchmesser berechnet.' };
  }

  if (kind === 'face-mill') return { level: 'fail', category: 'tool', title: 'Werkzeug · Operation', detail: 'Planfräser ist für Carve nicht freigegeben.' };
  if (kind === 'v-bit') return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'V-Fräser kann Centerlines gravieren; die aktuelle Carve-Berechnung modelliert jedoch noch keine V-Geometrie und keine variable Gravurbreite.' };
  if (kind === 'ball-nose') return { level: 'warn', category: 'tool', title: 'Werkzeug · Operation', detail: 'Vollradiusfräser ist als Centerline-Werkzeug möglich; die resultierende Nutform wird noch nicht geometrisch bewertet.' };
  return { level: 'pass', category: 'tool', title: 'Werkzeug · Operation', detail: 'Schaftfräser ist für die aktuelle Centerline-Carve-Bearbeitung freigegeben.' };
}

export function validateOperationGrammar(operation: CamOperation, stock: StockDefinition, stockMode: StockMode, wcs: WorkCoordinateSystem): ValidationCheck[] {
  return [...validateCommonOperation(operation, stock, stockMode, wcs), validateToolCompatibility(operation)];
}
