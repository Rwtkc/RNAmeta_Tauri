import type { PeakExonTypeRunResult } from "@/types/native";

const PEAK_EXON_TYPE_PROGRESS_PATTERN =
  /\[peak-exon-type\]\[(\d+)%\]\s*(.+)$/i;

export function parsePeakExonTypeProgressLine(line: string) {
  const match = line.match(PEAK_EXON_TYPE_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coercePeakExonTypeRunResult(
  raw: string
): PeakExonTypeRunResult {
  const parsed = JSON.parse(raw) as PeakExonTypeRunResult;

  if (parsed.chartPayload) {
    const categories = Array.isArray(parsed.chartPayload.categories)
      ? parsed.chartPayload.categories
      : [];
    const originalNames = parsed.chartPayload.categoryOriginalNames;

    parsed.chartPayload.categoryOriginalNames = Array.isArray(originalNames)
      ? Object.fromEntries(
          categories.map((category, index) => [
            category,
            originalNames[index] ?? category
          ])
        )
      : originalNames;
  }

  return parsed;
}

export function buildPeakExonTypeRequest(payload: {
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
