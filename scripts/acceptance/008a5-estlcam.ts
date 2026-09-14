import { postProcessEstlcam } from '../../src/lib/postprocessors';

export function run008a5(source: string) {
  const posted = postProcessEstlcam(source);
  return {
    ok: posted.ok,
    errors: posted.errors,
    warnings: posted.warnings,
    code: posted.code,
    removedLines: posted.removedLines,
    transformedLines: posted.transformedLines,
  };
}
