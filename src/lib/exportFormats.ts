export type FigureRenderFormat = "png" | "pdf";
export type DataExportFormat = "csv" | "txt";
export type AnalysisExportFormat = FigureRenderFormat | DataExportFormat;

export interface AnalysisExportState {
  format: AnalysisExportFormat;
  width: string;
  height: string;
  dpi: string;
}

export const ANALYSIS_EXPORT_FORMATS: AnalysisExportFormat[] = [
  "png",
  "pdf",
  "csv",
  "txt"
];

export function isFigureExportFormat(
  format: AnalysisExportFormat
): format is FigureRenderFormat {
  return format === "png" || format === "pdf";
}

export function isDataExportFormat(
  format: AnalysisExportFormat
): format is DataExportFormat {
  return format === "csv" || format === "txt";
}
