import type { Dispatch, ReactNode, SetStateAction } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { X } from "lucide-react";
import { buildMetaPlotPdfBytes, buildMetaPlotPngBytes } from "@/lib/metaPlotExport";

export type ExportFormat = "png" | "pdf";

export interface PeakExonExportState {
  format: ExportFormat;
  width: string;
  height: string;
  dpi: string;
}

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
    <div className="export-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="export-modal__backdrop" onClick={onClose} />
      <div className="export-modal__panel">
        <div className="export-modal__head">
          <div className="export-modal__title-row">
            <div className="export-modal__badge">{icon}</div>
            <div>
              <h3>Figure Export</h3>
              <p>Configure output size and resolution before writing the file.</p>
            </div>
          </div>
          <button
            type="button"
            className="export-modal__close"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="export-modal__body">
          <div className="export-menu__field export-menu__field--full">
            <span>Format</span>
            <div className="export-modal__format-grid">
              {(["png", "pdf"] as ExportFormat[]).map((formatOption) => (
                <button
                  key={formatOption}
                  type="button"
                  className={`export-modal__format-option${
                    exportState.format === formatOption ? " is-active" : ""
                  }`}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      format: formatOption
                    }))
                  }
                >
                  {formatOption.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="export-modal__grid">
            <label className="export-menu__field">
              <span>Width (px)</span>
              <input
                className="field-shell__input export-menu__input"
                type="number"
                value={exportState.width}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    width: event.target.value
                  }))
                }
              />
            </label>
            <label className="export-menu__field">
              <span>Height (px)</span>
              <input
                className="field-shell__input export-menu__input"
                type="number"
                value={exportState.height}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    height: event.target.value
                  }))
                }
              />
            </label>
            <label className="export-menu__field export-menu__field--full">
              <span>DPI</span>
              <input
                className="field-shell__input export-menu__input"
                type="number"
                value={exportState.dpi}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    dpi: event.target.value
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="export-modal__actions">
          <button
            type="button"
            className="export-modal__submit"
            onClick={onSubmit}
          >
            Download Figure
          </button>
        </div>
      </div>
    </div>
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
