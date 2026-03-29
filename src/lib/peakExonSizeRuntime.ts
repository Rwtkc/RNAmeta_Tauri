import type { PeakExonSizeRunResult } from "@/types/native";

const PEAK_EXON_SIZE_PROGRESS_PATTERN =
  /\[peak-exon-size\]\[(\d+)%\]\s*(.+)$/i;

export function parsePeakExonSizeProgressLine(line: string) {
  const match = line.match(PEAK_EXON_SIZE_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coercePeakExonSizeRunResult(
  raw: string
): PeakExonSizeRunResult {
  return JSON.parse(raw) as PeakExonSizeRunResult;
}

export function buildPeakExonSizeRequest(payload: {
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
