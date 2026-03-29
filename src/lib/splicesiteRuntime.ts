import type { SplicesiteRunResult } from "@/types/native";

const SPLICESITE_PROGRESS_PATTERN = /\[splicesite\]\[(\d+)%\]\s*(.+)$/i;

export function parseSplicesiteProgressLine(line: string) {
  const match = line.match(SPLICESITE_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coerceSplicesiteRunResult(raw: string): SplicesiteRunResult {
  return JSON.parse(raw) as SplicesiteRunResult;
}

export function buildSplicesiteRequest(payload: {
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
