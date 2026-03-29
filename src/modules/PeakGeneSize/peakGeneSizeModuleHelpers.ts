import { readTextFile } from "@tauri-apps/plugin-fs";
import type {
  FigureExportFormat,
  FigureExportState
} from "@/components/analysis/FigureExportDialog";
import {
  coercePeakGeneSizeRunResult,
  parsePeakGeneSizeProgressLine
} from "@/lib/peakGeneSizeRuntime";

export const defaultPeakGeneSizeExportState: FigureExportState = {
  format: "png",
  width: "1200",
  height: "620",
  dpi: "300"
};

export function formatPeakGeneSizeExportError(error: unknown) {
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

export function peakGeneSizeExportFileName(extension: FigureExportFormat) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `peak_gene_size_${date}.${extension}`;
}

export async function tryReadPeakGeneSizeRunResult(path: string) {
  try {
    const raw = await readTextFile(path);
    return coercePeakGeneSizeRunResult(raw);
  } catch {
    return null;
  }
}

export function normalizePeakGeneSizeEngineLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const progress = parsePeakGeneSizeProgressLine(trimmed);
  if (progress) {
    return {
      type: "info" as const,
      message: `[Peak Gene Size] ${progress.percent}% ${progress.detail}`
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
    return { type: "info" as const, message: `[Peak Gene Size] ${trimmed}` };
  }

  if (lower.includes("error") || lower.includes("failed")) {
    return { type: "error" as const, message: `[Peak Gene Size] ${trimmed}` };
  }

  return null;
}
