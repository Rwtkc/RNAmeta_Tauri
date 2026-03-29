import {
  appendLegend,
  appendTextNode,
  createPositionedExportContentGroup,
  createPositionedExportSvgNode,
  fitExportSize,
  HEATMAP_Y_AXIS_EXPORT_PADDING
} from "@/lib/siteProfileExportSvg";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export function buildSiteProfileSvgMarkup(
  exportElement: HTMLElement,
  width: number,
  height: number,
  backgroundColor = "#fffdf8"
) {
  const panels = Array.from(
    exportElement.querySelectorAll(".site-profile-chart-panel")
  );
  if (panels.length === 0) {
    throw new Error("Site profile export did not find any rendered panels.");
  }

  const rootRect = exportElement.getBoundingClientRect();
  if (!rootRect.width || !rootRect.height) {
    throw new Error("Site profile export root does not expose a measurable size.");
  }

  const contentWidth = Math.max(1, Math.ceil(rootRect.width));
  const contentHeight = Math.max(1, Math.ceil(rootRect.height));
  const { scale, widthPx, heightPx } = fitExportSize(
    contentWidth,
    contentHeight,
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height))
  );

  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("xmlns:xlink", XLINK_NS);
  root.setAttribute("width", `${widthPx}`);
  root.setAttribute("height", `${heightPx}`);
  root.setAttribute("viewBox", `0 0 ${widthPx} ${heightPx}`);

  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", `${widthPx}`);
  background.setAttribute("height", `${heightPx}`);
  background.setAttribute("fill", backgroundColor);
  root.appendChild(background);

  const heatmapSampleSummary = exportElement.dataset.currentHeatmapSample || "";
  const sampleSwitcherNode = exportElement.querySelector(
    ".site-profile-d3-chart__sample-switcher"
  ) as HTMLDivElement | null;
  const sampleSwitcherLabelNode = exportElement.querySelector(
    ".site-profile-d3-chart__sample-switcher-label"
  ) as HTMLSpanElement | null;

  if (heatmapSampleSummary && sampleSwitcherNode) {
    appendTextNode({
      root,
      text: heatmapSampleSummary,
      rect: sampleSwitcherNode.getBoundingClientRect(),
      rootRect,
      scale,
      style: window.getComputedStyle(sampleSwitcherLabelNode || sampleSwitcherNode)
    });
  }

  panels.forEach((panelNode) => {
    const panelElement = panelNode as HTMLElement;
    const titleNode = panelElement.querySelector(
      ".site-profile-chart-panel__title"
    ) as HTMLHeadingElement | null;
    const densitySvgNode = panelElement.querySelector(
      ".site-profile-chart-panel__svg"
    ) as SVGSVGElement | null;
    const heatmapYAxisNode = panelElement.querySelector(
      ".site-profile-heatmap-panel__y-axis"
    ) as SVGSVGElement | null;
    const heatmapBodyNode = panelElement.querySelector(
      ".site-profile-heatmap-panel__body"
    ) as SVGSVGElement | null;
    const heatmapAxisNode = panelElement.querySelector(
      ".site-profile-heatmap-panel__axis"
    ) as SVGSVGElement | null;
    const sampleNode = panelElement.querySelector(
      ".site-profile-heatmap-panel__sample"
    ) as HTMLDivElement | null;

    if (titleNode) {
      appendTextNode({
        root,
        text: titleNode.textContent?.trim() || "",
        rect: titleNode.getBoundingClientRect(),
        rootRect,
        scale,
        style: window.getComputedStyle(titleNode)
      });
    }

    if (densitySvgNode) {
      const node = createPositionedExportSvgNode({
        svgElement: densitySvgNode,
        rect: densitySvgNode.getBoundingClientRect(),
        rootRect,
        scale,
        preserveAspectRatio:
          densitySvgNode.getAttribute("preserveAspectRatio") || "xMinYMin meet"
      });
      if (node) {
        root.appendChild(node);
      }
    }

    if (heatmapYAxisNode) {
      const node = createPositionedExportContentGroup({
        svgElement: heatmapYAxisNode,
        rect: heatmapYAxisNode.getBoundingClientRect(),
        rootRect,
        scale,
        exportPadding: HEATMAP_Y_AXIS_EXPORT_PADDING,
        preserveAspectRatio:
          heatmapYAxisNode.getAttribute("preserveAspectRatio") || "none"
      });
      if (node) {
        root.appendChild(node);
      }
    }

    if (heatmapBodyNode) {
      const node = createPositionedExportSvgNode({
        svgElement: heatmapBodyNode,
        rect: heatmapBodyNode.getBoundingClientRect(),
        rootRect,
        scale,
        preserveAspectRatio:
          heatmapBodyNode.getAttribute("preserveAspectRatio") || "none"
      });
      if (node) {
        root.appendChild(node);
      }
    }

    if (heatmapAxisNode) {
      const node = createPositionedExportContentGroup({
        svgElement: heatmapAxisNode,
        rect: heatmapAxisNode.getBoundingClientRect(),
        rootRect,
        scale,
        preserveAspectRatio:
          heatmapAxisNode.getAttribute("preserveAspectRatio") || "xMinYMin meet"
      });
      if (node) {
        root.appendChild(node);
      }
    }

    if (sampleNode) {
      appendTextNode({
        root,
        text: sampleNode.textContent?.trim() || "",
        rect: sampleNode.getBoundingClientRect(),
        rootRect,
        scale,
        style: window.getComputedStyle(sampleNode),
        anchor:
          window.getComputedStyle(sampleNode).textAlign === "right"
            ? "end"
            : "start"
      });
    }
  });

  appendLegend(root, exportElement, rootRect, scale);
  return new XMLSerializer().serializeToString(root);
}
