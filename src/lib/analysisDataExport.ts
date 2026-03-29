import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
export { isDataExportFormat } from "@/lib/exportFormats";
import type {
  BoxplotPayload,
  FacetedBoxplotPayload,
  GeneMatrixPayload,
  MetaPlotPayload,
  PeakDistributionPayload,
  SiteProfilePayload
} from "@/types/native";
import type { AnalysisExportFormat, DataExportFormat } from "@/lib/exportFormats";

type ExportCell = string | number | boolean | null | undefined;

export interface AnalysisDataTable {
  columns: string[];
  rows: ExportCell[][];
}

function serializeCell(value: ExportCell, delimiter: string) {
  const text = value == null ? "" : String(value);
  const escaped = text.replaceAll('"', '""');
  if (
    escaped.includes(delimiter) ||
    escaped.includes('"') ||
    escaped.includes("\n") ||
    escaped.includes("\r")
  ) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function serializeAnalysisDataTable(
  table: AnalysisDataTable,
  format: DataExportFormat
) {
  const delimiter = format === "csv" ? "," : "\t";
  const lines = [
    table.columns.map((cell) => serializeCell(cell, delimiter)).join(delimiter),
    ...table.rows.map((row) =>
      row.map((cell) => serializeCell(cell, delimiter)).join(delimiter)
    )
  ];

  return lines.join("\r\n");
}

export async function exportAnalysisDataTable(input: {
  addLog: (
    type: "command" | "success" | "error" | "info",
    message: string
  ) => void;
  defaultPath: string;
  format: AnalysisExportFormat;
  logLabel: string;
  table: AnalysisDataTable;
  title: string;
}) {
  const { addLog, defaultPath, format, logLabel, table, title } = input;
  const selectedPath = await save({
    title,
    defaultPath,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  });

  if (!selectedPath) {
    return false;
  }

  const outputTarget =
    selectedPath.startsWith("file://") ? new URL(selectedPath) : selectedPath;
  addLog("command", `[${logLabel}] Preparing ${format.toUpperCase()} data export.`);
  const content = serializeAnalysisDataTable(table, format as DataExportFormat);
  await writeTextFile(outputTarget, content);
  addLog(
    "success",
    `[${logLabel}] Exported ${format.toUpperCase()} data -> ${selectedPath}`
  );
  return true;
}

export function buildMetaPlotDataTable(payload: MetaPlotPayload): AnalysisDataTable {
  return {
    columns: [
      "sample",
      "displayName",
      "position",
      "density",
      "confidenceDown",
      "confidenceUp"
    ],
    rows: payload.series.flatMap((series) =>
      series.values.map((value) => [
        series.originalName || series.name,
        series.name,
        value.x,
        value.density,
        value.confidenceDown,
        value.confidenceUp
      ])
    )
  };
}

export function buildPeakDistributionDataTable(
  payload: PeakDistributionPayload
): AnalysisDataTable {
  return {
    columns: ["series", "displayName", "category", "originalCategory", "value"],
    rows: payload.series.flatMap((series) =>
      payload.categories.map((category, index) => [
        series.originalName || series.name,
        series.name,
        category,
        payload.categoryOriginalNames?.[category] ?? category,
        series.values[index] ?? null
      ])
    )
  };
}

export function buildBoxplotDataTable(payload: BoxplotPayload): AnalysisDataTable {
  return {
    columns: ["series", "displayName", "value"],
    rows: payload.groups.flatMap((group) =>
      group.values.map((value) => [
        group.originalName || group.name,
        group.name,
        value
      ])
    )
  };
}

export function buildFacetedBoxplotDataTable(
  payload: FacetedBoxplotPayload
): AnalysisDataTable {
  return {
    columns: ["facet", "series", "displayName", "value"],
    rows: payload.facets.flatMap((facet) =>
      facet.groups.flatMap((group) =>
        group.values.map((value) => [
          facet.name,
          group.originalName || group.name,
          group.name,
          value
        ])
      )
    )
  };
}

export function buildGeneMatrixDataTable(
  payload: GeneMatrixPayload
): AnalysisDataTable {
  return {
    columns: [
      "intersectionLabel",
      "intersectionSize",
      "setCount",
      "sets",
      "originalSets",
      "genes"
    ],
    rows: payload.intersections.map((item) => [
      item.label,
      item.size,
      item.sets.length,
      item.sets.join(";"),
      item.originalSets.join(";"),
      item.genes.join(";")
    ])
  };
}

export function buildSiteProfileDataTable(
  payload: SiteProfilePayload,
  selectedHeatmapSample: string | null = null
): AnalysisDataTable {
  const rows: ExportCell[][] = [];

  payload.panels.forEach((panel) => {
    if (panel.type === "density") {
      panel.series.forEach((series) => {
        series.values.forEach((value) => {
          rows.push([
            "density",
            panel.title,
            series.originalName || series.name,
            series.name,
            value.x,
            null,
            null,
            value.density,
            null
          ]);
        });
      });
      return;
    }

    if (selectedHeatmapSample && panel.sampleName !== selectedHeatmapSample) {
      return;
    }

    panel.matrixValues.forEach((rowValues, rowIndex) => {
      rowValues.forEach((value, columnIndex) => {
        rows.push([
          "heatmap",
          panel.title,
          panel.originalName || panel.sampleName,
          panel.sampleName,
          null,
          rowIndex + 1,
          columnIndex + 1,
          null,
          value
        ]);
      });
    });
  });

  return {
    columns: [
      "panelType",
      "panelTitle",
      "sample",
      "displayName",
      "position",
      "row",
      "column",
      "density",
      "value"
    ],
    rows
  };
}
