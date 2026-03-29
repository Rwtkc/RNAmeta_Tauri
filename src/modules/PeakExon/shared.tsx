import type { Dispatch, ReactNode, SetStateAction } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { buildMetaPlotPdfBytes, buildMetaPlotPngBytes } from "@/lib/metaPlotExport";
import {
  buildBoxplotDataTable,
  buildFacetedBoxplotDataTable,
  buildPeakDistributionDataTable,
  exportAnalysisDataTable,
  isDataExportFormat
} from "@/lib/analysisDataExport";
import {
  FigureExportDialog,
  type FigureExportFormat,
  type FigureExportState
} from "@/components/analysis/FigureExportDialog";
import type {
  BoxplotPayload,
  FacetedBoxplotPayload,
  PeakDistributionPayload
} from "@/types/native";

export type ExportFormat = FigureExportFormat;

export interface PeakExonExportState extends FigureExportState {}

export interface PeakExonProgress {
  percent: number;
  detail: string;
}

export interface PeakExonSummaryItem {
  label: string;
  value: string;
}

interface PeakExonExportDialogProps<TExportState extends PeakExonExportState> {
  title: string;
  icon: ReactNode;
  exportState: TExportState;
  onChange: Dispatch<SetStateAction<TExportState>>;
  onClose: () => void;
  onSubmit: () => void;
}

interface ExportPeakExonChartOptions<TExportState extends PeakExonExportState> {
  dataPayload: BoxplotPayload | FacetedBoxplotPayload | PeakDistributionPayload;
  svgElement: SVGSVGElement;
  exportState: TExportState;
  dialogTitle: string;
  fileStem: string;
  defaultWidth: number;
  defaultHeight: number;
  logLabel: string;
  addLog: (
    type: "command" | "success" | "error" | "info",
    message: string
  ) => void;
}

export function PeakExonExportDialog<TExportState extends PeakExonExportState>({
  title,
  icon,
  exportState,
  onChange,
  onClose,
  onSubmit
}: PeakExonExportDialogProps<TExportState>) {
  return (
    <FigureExportDialog
      ariaLabel={title}
      badgeIcon={icon}
      description="Configure output size and resolution before writing the file."
      onClose={onClose}
      onStateChange={(value) => onChange(value as SetStateAction<TExportState>)}
      onSubmit={onSubmit}
      state={exportState}
    />
  );
}

export function PeakExonSummaryGrid({
  items
}: {
  items: PeakExonSummaryItem[];
}) {
  return (
    <div className="meta-plot-summary-grid peak-distribution-summary-grid">
      {items.map((item) => (
        <div key={item.label} className="meta-plot-summary-item">
          <span className="meta-plot-summary-item__label">{item.label}</span>
          <strong className="meta-plot-summary-item__value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export async function tryReadModuleRunResult<TResult>(
  path: string,
  coerceResult: (raw: string) => TResult
) {
  try {
    const raw = await readTextFile(path);
    return coerceResult(raw);
  } catch {
    return null;
  }
}

export function normalizePeakExonEngineLine(
  line: string,
  logLabel: string,
  parseProgress: (line: string) => PeakExonProgress | null
) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const progress = parseProgress(trimmed);
  if (progress) {
    return {
      type: "info" as const,
      message: `[${logLabel}] ${progress.percent}% ${progress.detail}`
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
    return { type: "info" as const, message: `[${logLabel}] ${trimmed}` };
  }

  if (lower.includes("error") || lower.includes("failed")) {
    return { type: "error" as const, message: `[${logLabel}] ${trimmed}` };
  }

  return null;
}

export async function exportPeakExonChart<TExportState extends PeakExonExportState>({
  dataPayload,
  svgElement,
  exportState,
  dialogTitle,
  fileStem,
  defaultWidth,
  defaultHeight,
  logLabel,
  addLog
}: ExportPeakExonChartOptions<TExportState>) {
  const format = exportState.format;
  if (isDataExportFormat(format)) {
    const table =
      dataPayload.type === "boxplot"
        ? buildBoxplotDataTable(dataPayload)
        : dataPayload.type === "boxplot_facet"
          ? buildFacetedBoxplotDataTable(dataPayload)
          : buildPeakDistributionDataTable(dataPayload);
    const didExport = await exportAnalysisDataTable({
      addLog,
      defaultPath: exportPeakExonFileName(fileStem, format),
      format,
      logLabel,
      table,
      title: `${dialogTitle} ${format.toUpperCase()}`
    });
    return didExport;
  }

  const width = Math.max(1, Number.parseInt(exportState.width, 10) || defaultWidth);
  const height = Math.max(
    1,
    Number.parseInt(exportState.height, 10) || defaultHeight
  );
  const dpi = Math.max(72, Number.parseInt(exportState.dpi, 10) || 300);
  const svgMarkup = new XMLSerializer().serializeToString(svgElement);
  const suggestedPath = exportPeakExonFileName(fileStem, format);
  const selectedPath = await save({
    title: `${dialogTitle} ${format.toUpperCase()}`,
    defaultPath: suggestedPath,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  });

  if (!selectedPath) {
    return false;
  }

  let stage = "building export payload";
  try {
    addLog(
      "command",
      `[${logLabel}] Preparing ${format.toUpperCase()} export ${width}x${height} @ ${dpi} DPI.`
    );

    const bytes =
      format === "png"
        ? await buildMetaPlotPngBytes(svgMarkup, width, height, dpi)
        : await buildMetaPlotPdfBytes(svgMarkup, width, height, dpi);

    stage = "writing output file";
    const outputTarget =
      selectedPath.startsWith("file://") ? new URL(selectedPath) : selectedPath;
    await writeFile(outputTarget, bytes);
    addLog(
      "success",
      `[${logLabel}] Exported ${format.toUpperCase()} ${width}x${height} @ ${dpi} DPI -> ${selectedPath}`
    );
    return true;
  } catch (error) {
    throw new Error(
      `${format.toUpperCase()} export failed during ${stage}: ${formatExportError(
        error
      )}`
    );
  }
}

function exportPeakExonFileName(fileStem: string, extension: ExportFormat) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${fileStem}_${date}.${extension}`;
}

function formatExportError(error: unknown) {
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
