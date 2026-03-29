import { invoke } from "@tauri-apps/api/core";

interface BuildAnalysisCacheKeyInput {
  moduleName: string;
  annotationDir: string;
  speciesId: string;
  filePaths: string[];
  controls: unknown;
}

export async function resolveSessionCachePath(relativePath?: string) {
  return invoke<string>("resolve_session_cache_path", {
    relativePath: relativePath ?? null
  });
}

export async function buildAnalysisCacheKey(
  input: BuildAnalysisCacheKeyInput
) {
  return invoke<string>("build_analysis_cache_key", {
    moduleName: input.moduleName,
    annotationDir: input.annotationDir,
    speciesId: input.speciesId,
    filePaths: input.filePaths,
    controlsJson: JSON.stringify(input.controls)
  });
}
