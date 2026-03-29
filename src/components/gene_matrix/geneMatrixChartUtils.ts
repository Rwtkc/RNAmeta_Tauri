import type {
  GeneMatrixIntersection,
  GeneMatrixPayload
} from "@/types/native";

export interface UpsetRow {
  id: string;
  sets: string[];
  originalSets: string[];
  genes: string[];
  size: number;
  membership: boolean[];
}

export function normalizeIntersections(config: GeneMatrixPayload) {
  const sampleLabels = config.sampleLabels || [];
  const sampleMetadata = config.sampleMetadata || [];
  const originalLookup: Record<string, string> = {};
  sampleMetadata.forEach((entry) => {
    originalLookup[entry.name] = entry.originalName || entry.name;
  });

  const intersections = (config.intersections || []).map(
    (intersection: GeneMatrixIntersection) => ({
      sets: Array.isArray(intersection.sets)
        ? intersection.sets
        : [intersection.sets].filter(Boolean),
      originalSets: Array.isArray(intersection.originalSets)
        ? intersection.originalSets
        : [],
      genes: Array.isArray(intersection.genes) ? intersection.genes : [],
      size: Number(intersection.size) || 0
    })
  );

  const sampleSizes: Record<string, number> = {};
  intersections
    .filter((intersection) => intersection.sets.length === 1)
    .forEach((intersection) => {
      sampleSizes[intersection.sets[0]] = intersection.size;
    });

  const rows: UpsetRow[] = intersections
    .map((intersection) => ({
      id: intersection.sets.join("__"),
      sets: intersection.sets,
      originalSets: intersection.originalSets.length
        ? intersection.originalSets
        : intersection.sets.map(
            (label: string) => originalLookup[label] || label
          ),
      genes: intersection.genes,
      size: intersection.size,
      membership: sampleLabels.map((label: string) =>
        intersection.sets.includes(label)
      )
    }))
    .sort((left, right) => {
      if (right.size !== left.size) {
        return right.size - left.size;
      }
      if (left.sets.length !== right.sets.length) {
        return left.sets.length - right.sets.length;
      }
      return left.id.localeCompare(right.id);
    });

  return { sampleLabels, sampleMetadata, sampleSizes, rows };
}

export function formatGeneMatrixCount(value: number) {
  return Number(value || 0).toLocaleString("en-US");
}

export function createGeneMatrixBandScale(
  count: number,
  rangeStart: number,
  rangeEnd: number,
  paddingInner = 0.28,
  paddingOuter = 0.08
) {
  const range = rangeEnd - rangeStart;
  const step =
    range / Math.max(1, count + paddingInner * (count - 1) + paddingOuter * 2);

  return {
    bandwidth: step,
    position: (index: number) =>
      rangeStart + (paddingOuter + index * (1 + paddingInner)) * step
  };
}
