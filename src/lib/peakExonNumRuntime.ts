import type { PeakExonNumRunResult } from "@/types/native";

const PEAK_EXON_NUM_PROGRESS_PATTERN =
  /\[peak-exon-num\]\[(\d+)%\]\s*(.+)$/i;

export function parsePeakExonNumProgressLine(line: string) {
  const match = line.match(PEAK_EXON_NUM_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coercePeakExonNumRunResult(raw: string): PeakExonNumRunResult {
  return JSON.parse(raw) as PeakExonNumRunResult;
}

export function buildPeakExonNumRequest(payload: {
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
