import type { PeakDistributionControls } from "@/store/useAppStore";
import type {
  PeakDistributionPayload,
  PeakDistributionRunResult
} from "@/types/native";

export const PEAK_DISTRIBUTION_FEATURE_ORDER = [
  "Promoter",
  "UTR5",
  "Start Codon",
  "CDS",
  "Stop Codon",
  "UTR3",
  "Intron",
  "Intergenic"
] as const;

interface PeakDistributionRequestPayload {
  species: string;
  speciesId: string;
  annotationDir: string;
  filePaths: string[];
  controls: PeakDistributionControls;
}

const PEAK_DISTRIBUTION_PROGRESS_PATTERN =
  /\[peak-distribution\]\[(\d+)%\]\s*(.+)$/i;

export function buildPeakDistributionRequest(
  payload: PeakDistributionRequestPayload
) {
  return {
    species: payload.species,
    speciesId: payload.speciesId,
    annotationDir: payload.annotationDir,
    filePaths: payload.filePaths,
    controls: buildPeakDistributionAnalysisControls(payload.controls)
  };
}

export function buildPeakDistributionAnalysisControls(
  _controls?: PeakDistributionControls
) {
  return {
    selectedFeatures: [...PEAK_DISTRIBUTION_FEATURE_ORDER]
  };
}

export function parsePeakDistributionProgressLine(line: string) {
  const match = line.match(PEAK_DISTRIBUTION_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coercePeakDistributionRunResult(
  raw: string
): PeakDistributionRunResult {
  return JSON.parse(raw) as PeakDistributionRunResult;
}

export function tunePeakDistributionPayload(
  payload: PeakDistributionPayload
): PeakDistributionPayload {
  const categories = Array.isArray(payload.categories)
    ? payload.categories
    : payload.categories != null
      ? [payload.categories as unknown as string]
      : [];
  const categoryOriginalNames = Array.isArray(payload.categoryOriginalNames)
    ? Object.fromEntries(
        categories.map((category, index) => [
          category,
          payload.categoryOriginalNames?.[index] ?? category
        ])
      )
    : typeof payload.categoryOriginalNames === "string"
      ? Object.fromEntries([[categories[0] ?? payload.categoryOriginalNames, payload.categoryOriginalNames]])
      : payload.categoryOriginalNames;
  const series = payload.series.map((entry) => ({
    ...entry,
    values: Array.isArray(entry.values)
      ? entry.values
      : entry.values != null
        ? [entry.values as unknown as number]
        : []
  }));
  const sanitizedTicks = [...(payload.yTicks ?? [])]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)
    .filter((value, index, ticks) => index === 0 || value !== ticks[index - 1]);

  const domain: [number, number] = [...payload.yDomain] as [number, number];
  const highestTick = sanitizedTicks.length
    ? sanitizedTicks[sanitizedTicks.length - 1]
    : domain[1];

  if (highestTick > domain[1]) {
    domain[1] = highestTick;
  }

  return {
    ...payload,
    categories,
    categoryOriginalNames,
    series,
    yTicks: sanitizedTicks,
    yDomain: domain
  };
}

function createNiceTicks(maxValue: number, targetTickCount = 5) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return [0];
  }

  const roughStep = maxValue / Math.max(1, targetTickCount);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  let niceStep = magnitude;

  if (normalized > 5) {
    niceStep = 10 * magnitude;
  } else if (normalized > 2) {
    niceStep = 5 * magnitude;
  } else if (normalized > 1) {
    niceStep = 2 * magnitude;
  }

  const top = Math.ceil(maxValue / niceStep) * niceStep;
  const ticks: number[] = [];

  for (let current = 0; current <= top + niceStep * 0.5; current += niceStep) {
    ticks.push(current);
  }

  return ticks;
}

function tuneGroupedBarDomain(payload: PeakDistributionPayload) {
  const maxValue = payload.series.reduce((seriesMax, series) => {
    const localMax = series.values.reduce(
      (valueMax, value) => Math.max(valueMax, Number.isFinite(value) ? value : 0),
      0
    );
    return Math.max(seriesMax, localMax);
  }, 0);
  const paddedMax = maxValue > 0 ? maxValue * 1.12 : 1;

  return {
    ...payload,
    yDomain: [0, paddedMax] as [number, number],
    yTicks: createNiceTicks(paddedMax)
  };
}

function filterGroupedBarPayload(
  payload: PeakDistributionPayload,
  selectedFeatures: string[]
) {
  const selectedFeatureSet = new Set(selectedFeatures);
  const orderedFeatures = PEAK_DISTRIBUTION_FEATURE_ORDER.filter((feature) =>
    selectedFeatureSet.has(feature)
  );
  const indices = orderedFeatures
    .map((feature) => payload.categories.indexOf(feature))
    .filter((index) => index >= 0);
  const categories = indices.map((index) => payload.categories[index]);

  return tuneGroupedBarDomain({
    ...payload,
    categories,
    series: payload.series.map((series) => ({
      ...series,
      values: indices.map((index) => series.values[index] ?? 0)
    }))
  });
}

function filterStackedBarPayload(
  payload: PeakDistributionPayload,
  selectedFeatures: string[]
) {
  const selectedFeatureSet = new Set(selectedFeatures);
  const orderedFeatures = PEAK_DISTRIBUTION_FEATURE_ORDER.filter((feature) =>
    selectedFeatureSet.has(feature)
  );
  const orderedFeatureSet = new Set<string>(orderedFeatures);

  return {
    ...payload,
    series: payload.series.filter((series) => orderedFeatureSet.has(series.name))
  };
}

export function filterPeakDistributionPayload(
  payload: PeakDistributionPayload | null,
  selectedFeatures: string[]
) {
  if (!payload) {
    return null;
  }

  if (payload.type === "grouped_bar") {
    return filterGroupedBarPayload(payload, selectedFeatures);
  }

  return filterStackedBarPayload(payload, selectedFeatures);
}
