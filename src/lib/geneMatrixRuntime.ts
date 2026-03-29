import type { GeneMatrixRunResult } from "@/types/native";

const GENE_MATRIX_PROGRESS_PATTERN = /\[gene-matrix\]\[(\d+)%\]\s*(.+)$/i;

export function parseGeneMatrixProgressLine(line: string) {
  const match = line.match(GENE_MATRIX_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coerceGeneMatrixRunResult(raw: string): GeneMatrixRunResult {
  return JSON.parse(raw) as GeneMatrixRunResult;
}

export function buildGeneMatrixRequest(payload: {
  species: string;
  speciesId: string;
  annotationDir: string;
  filePaths: string[];
}) {
  return {
    species: payload.species,
    speciesId: payload.speciesId,
    annotationDir: payload.annotationDir,
    filePaths: payload.filePaths
  };
}
