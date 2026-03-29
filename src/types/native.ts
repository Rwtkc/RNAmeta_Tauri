export interface PreviewTable {
  headers: string[];
  rows: string[][];
  sourcePath: string;
  rowCount: number;
}

export interface AnnotationValidation {
  exists: boolean;
  isValid: boolean;
  rootPath: string;
  registryPath: string | null;
  txdbDir: string | null;
  txlensDir: string | null;
  gffDir: string | null;
  availableSpecies: string[];
  speciesSupported: boolean;
  missingItems: string[];
  speciesFiles: string[];
}

export interface MetaPlotSeriesValue {
  x: number;
  density: number;
  confidenceDown?: number | null;
  confidenceUp?: number | null;
}

export interface MetaPlotSeries {
  name: string;
  originalName: string;
  color: string;
  values: MetaPlotSeriesValue[];
}

export interface MetaPlotComponentSegment {
  start: number;
  end: number;
  mid: number;
  label: string;
  alpha: number;
  height: number;
  component: string;
}

export interface MetaPlotPayload {
  title: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  showCI: boolean;
  components: {
    trackBase: number;
    labelY: number;
    segments: MetaPlotComponentSegment[];
    separators: Array<{ x: number; y1: number; y2: number }>;
  };
  series: MetaPlotSeries[];
}

export interface MetaPlotSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  sampledPointCount: number;
  overlapCount: number;
}

export interface MetaPlotRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: MetaPlotSummary;
  chartPayload?: MetaPlotPayload;
}

export interface PeakDistributionSeries {
  name: string;
  originalName: string;
  color: string;
  values: number[];
}

export interface PeakDistributionPayload {
  type: "grouped_bar" | "stacked_bar";
  title: string;
  xLabel: string;
  yLabel: string;
  tooltipSeriesLabel?: string;
  tooltipValueLabel?: string;
  hoverMinHeight?: number;
  categoryOriginalNames?: Record<string, string>;
  categories: string[];
  showLabels: boolean;
  yTicks: number[];
  yDomain: [number, number];
  series: PeakDistributionSeries[];
}

export interface PeakDistributionSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  featureRowCount: number;
}

export interface PeakDistributionRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: PeakDistributionSummary;
  chartPayload?: PeakDistributionPayload;
  detailFiles?: string[];
}

// ── Gene Type ──────────────────────────────────────────────

export interface GeneTypeSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  overlapCount: number;
}

export interface GeneTypeRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: GeneTypeSummary;
  chartPayload?: PeakDistributionPayload;
}

// ── Peak Gene Size ─────────────────────────────────────────

export interface BoxplotGroup {
  name: string;
  originalName: string;
  color: string;
  values: number[];
}

export interface BoxplotPayload {
  type: "boxplot";
  title: string;
  yLabel: string;
  scaleTransform?: "log2" | "linear";
  countLabel?: string;
  groups: BoxplotGroup[];
}

export interface PeakGeneSizeSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  transcriptCount: number;
}

export interface PeakGeneSizeRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: PeakGeneSizeSummary;
  chartPayload?: BoxplotPayload;
}

export interface FacetedBoxplotFacet {
  name: string;
  groups: BoxplotGroup[];
}

export interface FacetedBoxplotPayload {
  type: "boxplot_facet";
  title: string;
  yLabel: string;
  scaleTransform?: "log2" | "linear";
  countLabel?: string;
  facets: FacetedBoxplotFacet[];
}

export interface PeakExonSizeSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  exonHitCount: number;
}

export interface PeakExonSizeRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: PeakExonSizeSummary;
  chartPayload?: FacetedBoxplotPayload | null;
}

export interface PeakExonTypeSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  exonHitCount: number;
}

export interface PeakExonTypeRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: PeakExonTypeSummary;
  chartPayload?: PeakDistributionPayload | null;
}

export interface PeakExonNumSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  transcriptCount: number;
}

export interface PeakExonNumRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: PeakExonNumSummary;
  chartPayload?: BoxplotPayload | null;
}

// ── Gene Matrix ────────────────────────────────────────────

export interface GeneMatrixIntersection {
  sets: string[];
  originalSets: string[];
  size: number;
  label: string;
  genes: string[];
}

export interface GeneMatrixSampleMetadata {
  name: string;
  originalName: string;
}

export interface GeneMatrixPayload {
  title: string;
  sampleLabels: string[];
  sampleMetadata: GeneMatrixSampleMetadata[];
  colors: Record<string, string>;
  intersections: GeneMatrixIntersection[];
}

export interface GeneMatrixSummary {
  species: string;
  sampleCount: number;
  sampleLabels: string[];
  unionGeneCount: number;
}

export interface GeneMatrixRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: GeneMatrixSummary;
  chartPayload?: GeneMatrixPayload;
}

export interface SiteProfileDensityValue {
  x: number;
  density: number;
}

export interface SiteProfileDensitySeries {
  name: string;
  originalName: string;
  color: string;
  values: SiteProfileDensityValue[];
}

export interface SiteProfileLegendEntry {
  name: string;
  originalName?: string;
  color: string;
}

export interface SiteProfileHeatmapSampleOption {
  value: string;
  label: string;
}

export interface SiteProfileDensityPanel {
  type: "density";
  key?: string;
  title: string;
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  yTicks?: number[];
  guideLines?: number[];
  series: SiteProfileDensitySeries[];
}

export interface SiteProfileHeatmapPanel {
  type: "heatmap";
  title: string;
  sampleName: string;
  originalName: string;
  rows: number;
  columns: number;
  matrixValues: number[][];
  xDomain: [number, number];
  imageData?: string;
  displayHeightPx?: number;
  displayWidthRatio?: number;
  cornerRadiusPx?: number;
  backgroundColor?: string;
  palette?: string[];
  colorMaxQuantile?: number;
  showGrid?: boolean;
  pixelated?: boolean;
  gridOuterStroke?: string;
  gridOuterStrokeWidth?: number;
  horizontalGridStroke?: string;
  verticalGridStroke?: string;
  gridStrokeWidth?: number;
}

export type SiteProfilePanel =
  | SiteProfileDensityPanel
  | SiteProfileHeatmapPanel;

export interface SiteProfilePayload {
  title: string;
  hideTitle?: boolean;
  layout?: "stacked" | "grid";
  panels: SiteProfilePanel[];
  heatmapSamples?: SiteProfileHeatmapSampleOption[];
  defaultHeatmapSample?: string | null;
  legend?: SiteProfileLegendEntry[];
}

export interface TranscriptionSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  heatmapSample: string | null;
  hasSignal: boolean;
  hasHeatmapSignal: boolean;
  boundaryHitCount: number;
  emptyStateMessage?: string | null;
  heatmapNoticeMessage?: string | null;
}

export interface TranscriptionRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: TranscriptionSummary;
  chartPayload?: SiteProfilePayload | null;
}

export interface TranslationSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  heatmapSample: string | null;
  boundaryHitCount: number;
}

export interface TranslationRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: TranslationSummary;
  chartPayload?: SiteProfilePayload | null;
}

export interface SplicesiteSummary {
  species: string;
  sampleCount: number;
  intervalCount: number;
  junctionHitCount: number;
}

export interface SplicesiteRunResult {
  status: "ok" | "error";
  message?: string;
  summary?: SplicesiteSummary;
  chartPayload?: SiteProfilePayload | null;
}
