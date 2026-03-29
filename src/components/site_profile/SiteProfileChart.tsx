import { useEffect, useMemo, useRef, useState } from "react";
import { SiteProfileDensityPanel } from "@/components/site_profile/SiteProfileDensityPanel";
import { SiteProfileHeatmapPanel } from "@/components/site_profile/SiteProfileHeatmapPanel";
import { normalizePanels } from "@/components/site_profile/siteProfileChartData";
import {
  buildHeatmapSampleOptions,
  buildHeatmapSampleSummary,
  filterVisibleSiteProfilePanels,
  resolveInitialHeatmapSample
} from "@/components/site_profile/siteProfilePanelSelection";
import type { SiteProfilePayload } from "@/types/native";

function buildLegendEntries(
  config: SiteProfilePayload,
  panels: Array<Record<string, unknown>>
) {
  const explicitLegend = Array.isArray(config?.legend)
    ? config.legend.filter((entry) => entry?.name && entry?.color)
    : [];

  if (explicitLegend.length > 0) {
    return explicitLegend;
  }

  const seen = new Set<string>();
  const entries = [] as Array<{ name: string; color: string }>;

  panels
    .filter((panel) => panel.type === "density")
    .forEach((panel) => {
      const series = Array.isArray(panel.series)
        ? (panel.series as Array<Record<string, unknown>>)
        : [];
      series.forEach((item) => {
        if (!item?.name || seen.has(String(item.name))) {
          return;
        }

        seen.add(String(item.name));
        entries.push({
          name: String(item.name),
          color: String(item.color || "#859b7a")
        });
      });
    });

  return entries;
}

export function SiteProfileChart({ payload }: { payload: SiteProfilePayload }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const panels = useMemo(
    () => normalizePanels(payload as unknown as Record<string, unknown>),
    [payload]
  );
  const heatmapSampleOptions = useMemo(
    () =>
      buildHeatmapSampleOptions(
        payload as unknown as Record<string, unknown>,
        panels
      ),
    [panels, payload]
  );
  const [selectedHeatmapSample, setSelectedHeatmapSample] = useState(() =>
    resolveInitialHeatmapSample(
      payload as unknown as Record<string, unknown>,
      heatmapSampleOptions
    )
  );
  const legendEntries = useMemo(
    () => buildLegendEntries(payload, panels),
    [panels, payload]
  );
  const heatmapSampleSummary = useMemo(
    () =>
      buildHeatmapSampleSummary(selectedHeatmapSample, heatmapSampleOptions),
    [heatmapSampleOptions, selectedHeatmapSample]
  );
  const visiblePanels = useMemo(
    () =>
      filterVisibleSiteProfilePanels(
        panels,
        heatmapSampleOptions.length > 1 ? selectedHeatmapSample : ""
      ),
    [heatmapSampleOptions.length, panels, selectedHeatmapSample]
  );
  const isSingleColumnLayout = useMemo(() => {
    if (payload?.layout === "stacked") {
      return true;
    }

    return (
      visiblePanels.length > 0 &&
      visiblePanels.every((panel) => panel.type === "density")
    );
  }, [payload?.layout, visiblePanels]);
  const showChartTitle = !(
    payload?.hideTitle || (payload?.title === "Splicesite" && isSingleColumnLayout)
  );

  useEffect(() => {
    setSelectedHeatmapSample((currentValue) => {
      if (
        currentValue &&
        heatmapSampleOptions.some((option) => option.value === currentValue)
      ) {
        return currentValue;
      }

      return resolveInitialHeatmapSample(
        payload as unknown as Record<string, unknown>,
        heatmapSampleOptions
      );
    });
  }, [heatmapSampleOptions, payload]);

  if (panels.length === 0) {
    return null;
  }

  return (
    <div
      ref={chartRef}
      className={`site-profile-d3-chart${
        isSingleColumnLayout ? " site-profile-d3-chart--stacked" : ""
      }`}
      data-current-heatmap-sample={heatmapSampleSummary || undefined}
    >
      {showChartTitle ? (
        <h2 className="site-profile-d3-chart__title">
          {payload?.title || "Site Profile"}
        </h2>
      ) : null}
      {heatmapSampleOptions.length > 1 ? (
        <div className="site-profile-d3-chart__sample-switcher">
          <span className="site-profile-d3-chart__sample-switcher-label">
            Heatmap Sample
          </span>
          <div className="site-profile-d3-chart__sample-switcher-options">
            {heatmapSampleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`site-profile-d3-chart__sample-chip${
                  selectedHeatmapSample === option.value ? " is-active" : ""
                }`}
                onClick={() => setSelectedHeatmapSample(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={`site-profile-d3-chart__grid${
          isSingleColumnLayout ? " site-profile-d3-chart__grid--stacked" : ""
        }`}
      >
        {visiblePanels.map((panel, index) =>
          panel.type === "heatmap" ? (
            <SiteProfileHeatmapPanel
              key={`${panel.title}-${index}`}
              panel={{
                ...panel,
                layoutMode: isSingleColumnLayout ? "stacked" : "compact"
              } as any}
            />
          ) : (
            <SiteProfileDensityPanel
              key={`${panel.title}-${index}`}
              panel={{
                ...panel,
                layoutMode: isSingleColumnLayout ? "stacked" : "compact"
              } as any}
              tooltipRef={tooltipRef}
              containerRef={chartRef}
            />
          )
        )}
      </div>
      {legendEntries.length > 0 ? (
        <div className="site-profile-d3-chart__legend">
          {legendEntries.map((entry) => (
            <div key={entry.name} className="site-profile-d3-chart__legend-item">
              <span
                className="site-profile-d3-chart__legend-swatch"
                style={{ backgroundColor: entry.color }}
              />
              <span className="site-profile-d3-chart__legend-label">
                {entry.name}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div
        ref={tooltipRef}
        className="site-profile-tooltip"
        data-visible="false"
      />
    </div>
  );
}
