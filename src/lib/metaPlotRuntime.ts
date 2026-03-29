import type { MetaPlotControls } from "@/store/useAppStore";
import type { MetaPlotPayload, MetaPlotRunResult } from "@/types/native";

interface MetaPlotRequestPayload {
  species: string;
  speciesId: string;
  annotationDir: string;
  filePaths: string[];
  controls: MetaPlotControls;
}

const META_PLOT_PROGRESS_PATTERN = /\[meta-plot\]\[(\d+)%\]\s*(.+)$/i;

export function buildMetaPlotRequest(payload: MetaPlotRequestPayload) {
  return {
    species: payload.species,
    speciesId: payload.speciesId,
    annotationDir: payload.annotationDir,
    filePaths: payload.filePaths,
    controls: payload.controls
  };
}

export function parseMetaPlotProgressLine(line: string) {
  const match = line.match(META_PLOT_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function tuneMetaPlotPayload(payload: MetaPlotPayload): MetaPlotPayload {
  const yDomain: [number, number] = [...payload.yDomain] as [number, number];
  yDomain[0] = Math.min(yDomain[0], -0.6);

  return {
    ...payload,
    yDomain
  };
}

export function coerceMetaPlotRunResult(raw: string): MetaPlotRunResult {
  return JSON.parse(raw) as MetaPlotRunResult;
}
