import type { PeakGeneSizeRunResult } from "@/types/native";

const PEAK_GENE_SIZE_PROGRESS_PATTERN =
  /\[peak-gene-size\]\[(\d+)%\]\s*(.+)$/i;

export function parsePeakGeneSizeProgressLine(line: string) {
  const match = line.match(PEAK_GENE_SIZE_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coercePeakGeneSizeRunResult(
  raw: string
): PeakGeneSizeRunResult {
  return JSON.parse(raw) as PeakGeneSizeRunResult;
}

export function buildPeakGeneSizeRequest(payload: {
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
