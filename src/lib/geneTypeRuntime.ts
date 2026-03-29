import type { GeneTypeRunResult } from "@/types/native";

const GENE_TYPE_PROGRESS_PATTERN = /\[gene-type\]\[(\d+)%\]\s*(.+)$/i;

export function parseGeneTypeProgressLine(line: string) {
  const match = line.match(GENE_TYPE_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coerceGeneTypeRunResult(raw: string): GeneTypeRunResult {
  return JSON.parse(raw) as GeneTypeRunResult;
}

export function buildGeneTypeRequest(payload: {
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
