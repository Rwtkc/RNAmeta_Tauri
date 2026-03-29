export function buildHeatmapSampleOptions(
  config: Record<string, unknown> | null | undefined,
  panels: Array<Record<string, unknown>>
) {
  const explicitOptions = Array.isArray(config?.heatmapSamples)
    ? config.heatmapSamples
        .map((option) => {
          if (!option || typeof option !== "object") {
            return null;
          }

          const record = option as Record<string, unknown>;
          if (!record.value) {
            return null;
          }

          return {
            value: String(record.value),
            label: String(record.label ?? record.value)
          };
        })
        .filter(
          (option): option is { value: string; label: string } =>
            option !== null
        )
    : [];

  if (explicitOptions.length > 0) {
    return explicitOptions;
  }

  const seen = new Set<string>();
  return panels
    .filter((panel) => panel.type === "heatmap" && panel.sampleName)
    .map((panel) => String(panel.sampleName))
    .filter((sampleName) => {
      if (seen.has(sampleName)) {
        return false;
      }
      seen.add(sampleName);
      return true;
    })
    .map((sampleName) => ({
      value: sampleName,
      label: sampleName
    }));
}

export function resolveInitialHeatmapSample(
  config: Record<string, unknown> | null | undefined,
  sampleOptions: Array<{ value: string; label: string }>
) {
  const defaultValue = config?.defaultHeatmapSample
    ? String(config.defaultHeatmapSample)
    : "";
  if (defaultValue && sampleOptions.some((option) => option.value === defaultValue)) {
    return defaultValue;
  }

  return sampleOptions[0]?.value ?? "";
}

export function buildHeatmapSampleSummary(
  selectedHeatmapSample: string,
  sampleOptions: Array<{ value: string; label: string }>
) {
  if (!selectedHeatmapSample || sampleOptions.length <= 1) {
    return "";
  }

  const selectedOption = sampleOptions.find(
    (option) => option.value === selectedHeatmapSample
  );
  if (!selectedOption) {
    return "";
  }

  return `Heatmap Sample: ${selectedOption.label}`;
}

export function filterVisibleSiteProfilePanels(
  panels: Array<Record<string, unknown>>,
  selectedHeatmapSample: string
) {
  if (!selectedHeatmapSample) {
    return panels;
  }

  return panels.filter(
    (panel) =>
      panel.type !== "heatmap" || panel.sampleName === selectedHeatmapSample
  );
}
