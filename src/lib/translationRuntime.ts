import type { TranslationRunResult } from "@/types/native";

const TRANSLATION_PROGRESS_PATTERN = /\[translation\]\[(\d+)%\]\s*(.+)$/i;

export function parseTranslationProgressLine(line: string) {
  const match = line.match(TRANSLATION_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coerceTranslationRunResult(raw: string): TranslationRunResult {
  return JSON.parse(raw) as TranslationRunResult;
}

export function buildTranslationRequest(payload: {
  species: string;
  speciesId: string;
  annotationDir: string;
  filePaths: string[];
}) {
  return {
    species: payload.species,
    speciesId: payload.speciesId,
    annotationDir: payload.annotationDir,
    filePaths: payload.filePaths,
    controls: {}
  };
}
