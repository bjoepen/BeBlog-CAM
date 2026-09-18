/**
 * Build 008E performance counters for Z-level model roughing.
 *
 * Deliberately side-effect-free with respect to CAM semantics: callers opt in
 * by supplying a profile object. The production result must be identical with
 * profiling enabled or disabled.
 */
export type ZLevelPerformanceProfile = {
  triangleTests: number;
  rasterSafetyTests: number;
  boundarySegmentDistanceTests: number;
  stayDownSafetyTests: number;
  accessibilitySamples: number;
  accessibilityRegionTests: number;
};

export function createZLevelPerformanceProfile(): ZLevelPerformanceProfile {
  return {
    triangleTests: 0,
    rasterSafetyTests: 0,
    boundarySegmentDistanceTests: 0,
    stayDownSafetyTests: 0,
    accessibilitySamples: 0,
    accessibilityRegionTests: 0,
  };
}
