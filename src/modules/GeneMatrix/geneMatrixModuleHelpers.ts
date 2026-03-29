import { readTextFile } from "@tauri-apps/plugin-fs";
import type { FigureExportState } from "@/components/analysis/FigureExportDialog";
import {
  coerceGeneMatrixRunResult,
  parseGeneMatrixProgressLine
} from "@/lib/geneMatrixRuntime";

export const defaultGeneMatrixExportState: FigureExportState = {
  format: "png",
  width: "1200",
  height: "700",
  dpi: "300"
};

export function formatGeneMatrixExportError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // ignore
  }
  return String(error);
}

export function geneMatrixExportFileName(
  extension: FigureExportState["format"]
) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `gene_matrix_${date}.${extension}`;
}

export async function tryReadGeneMatrixRunResult(path: string) {
  try {
    const raw = await readTextFile(path);
    return coerceGeneMatrixRunResult(raw);
  } catch {
    return null;
  }
}

export function normalizeGeneMatrixEngineLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const progress = parseGeneMatrixProgressLine(trimmed);
  if (progress) {
    return {
      type: "info" as const,
      message: `[Gene Matrix] ${progress.percent}% ${progress.detail}`
    };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("welcome to bioconductor") ||
    lower.includes("the following objects are masked") ||
    lower.includes("vignettes contain introductory material") ||
    lower.includes("citation(")
  ) {
    return null;
  }

  if (lower.includes("warning")) {
    return { type: "info" as const, message: `[Gene Matrix] ${trimmed}` };
  }

  if (lower.includes("error") || lower.includes("failed")) {
    return { type: "error" as const, message: `[Gene Matrix] ${trimmed}` };
  }

  return null;
}
