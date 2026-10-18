import type { MaterialKind } from './materialContext';
import { materialProfiles } from './materialContext';
import { calculateFeedsSpeeds } from './feedsSpeeds';
import type { MillingTool } from './toolTypes';
import { isMillingTool } from './toolTypes';
import type { StepToolMatch } from './stepToolMatching';

export type StepCuttingAdvice = {
  featureId: string;
  toolId: string;
  method: 'drill' | 'helical-mill';
  status: 'conditional';
  spindleRpm: number;
  feedMmMin: number;
  notes: string[];
};

/** 011-F2: arithmetic starting points, never production cutting data.
 * Machine rpm limits, plunge feeds, material grades, tool coatings and
 * drill-specific chip loads are not known here; no automatic CAM transfer.
 */
export function adviseStepCuttingData(
  matches: readonly StepToolMatch[],
  tools: readonly MillingTool[],
  material: MaterialKind,
  libraryReady: boolean
): StepCuttingAdvice[] {
  if (!libraryReady || !Array.isArray(matches) || !Array.isArray(tools) ||
      !tools.every(isMillingTool) || new Set(tools.map(t => t.id)).size !== tools.length ||
      !Object.prototype.hasOwnProperty.call(materialProfiles, material)) return [];
  const profile = materialProfiles[material];
  if (!Number.isFinite(profile.cuttingSpeedMMin) || profile.cuttingSpeedMMin <= 0 ||
      !Number.isFinite(profile.chipLoadFactor) || profile.chipLoadFactor <= 0) return [];
  const byId = new Map(tools.map(tool => [tool.id, tool]));
  const result: StepCuttingAdvice[] = [];
  for (const match of matches) {
    if (match.status !== 'conditional') continue;
    for (const candidate of match.candidates) {
      const tool = byId.get(candidate.toolId);
      if (!tool || tool.name !== candidate.toolName ||
          (candidate.method !== 'drill' && candidate.method !== 'helical-mill')) continue;
      try {
        const calculated = calculateFeedsSpeeds({
          toolDiameterMm: tool.diameterMm,
          cuttingSpeedMMin: profile.cuttingSpeedMMin,
          flutes: tool.flutes,
          chipLoadMm: tool.chipLoadMm * profile.chipLoadFactor
        });
        if (![calculated.spindleRpm, calculated.feedMmMin].every(Number.isFinite) ||
            calculated.spindleRpm <= 0 || calculated.feedMmMin <= 0) continue;
        result.push({
          featureId: match.featureId, toolId: tool.id, method: candidate.method,
          status: 'conditional', spindleRpm: calculated.spindleRpm,
          feedMmMin: calculated.feedMmMin,
          notes: [
            profile.note,
            'Rechnerischer Startwert, keine Maschinen- oder Werkzeugfreigabe.',
            'Drehzahlgrenzen, Werkzeugwerkstoff, Kühlung, Eintauchvorschub und Eingriff nicht geprüft.',
            ...(candidate.method === 'drill'
              ? ['Bohrerspezifische Vorschubwerte und Spanabfuhr sind gesondert zu prüfen.']
              : ['Helixgeometrie, radiale Zustellung und Eintauchfähigkeit sind gesondert zu prüfen.']),
            ...candidate.reasons
          ]
        });
      } catch {
        // Fail closed on invalid arithmetic rather than emitting partial advice.
      }
    }
  }
  return result;
}
