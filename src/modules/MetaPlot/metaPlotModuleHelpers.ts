import { readTextFile } from "@tauri-apps/plugin-fs";
import type { FigureExportState } from "@/components/analysis/FigureExportDialog";
import {
  coerceMetaPlotRunResult,
  parseMetaPlotProgressLine
} from "@/lib/metaPlotRuntime";

export const defaultMetaPlotExportState: FigureExportState = {
  format: "png",
  width: "1200",
  height: "560",
  dpi: "300"
};

export function formatMetaPlotExportError(error: unknown) {
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
    // ignore JSON serialization failure
  }

  return String(error);
}

export function metaPlotExportFileName(extension: FigureExportState["format"]) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `meta_plot_${date}.${extension}`;
}

export async function tryReadMetaPlotRunResult(path: string) {
  try {
    const raw = await readTextFile(path);
    return coerceMetaPlotRunResult(raw);
  } catch {
    return null;
  }
}

export function normalizeMetaPlotEngineLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const progress = parseMetaPlotProgressLine(trimmed);
  if (progress) {
    return {
      type: "info" as const,
      message: `[Meta Plot] ${progress.percent}% ${progress.detail}`
    };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("valid.genomicranges.seqinfo") ||
    lower.includes("out-of-bound ranges")
  ) {
    return {
      type: "info" as const,
      message:
        "[Meta Plot] Annotation contains out-of-bound transcript ranges; Bioconductor trimmed those entries during plot construction."
    };
  }

  if (lower.includes("error") || lower.includes("failed")) {
    return {
      type: "error" as const,
      message: `[Meta Plot] ${trimmed}`
    };
  }

  return null;
}
