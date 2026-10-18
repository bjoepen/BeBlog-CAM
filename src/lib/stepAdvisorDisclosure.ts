/** Pure disclosure transition shared by the rendered STEP feature cards. */
export function toggleExpandedFeature(current: readonly string[], featureId: string): string[] {
  return current.includes(featureId)
    ? current.filter(id => id !== featureId)
    : [...current, featureId];
}
