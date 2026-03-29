import type { ScaleLinear } from "d3";

function formatValue(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return "NA";
  }

  return value.toFixed(digits);
}

function placeTooltip(
  tooltipNode: HTMLDivElement,
  containerNode: HTMLDivElement,
  event: MouseEvent
) {
  const containerRect = containerNode.getBoundingClientRect();
  const tooltipRect = tooltipNode.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, event.clientX - containerRect.left + 16),
    Math.max(12, containerRect.width - tooltipRect.width - 12)
  );
  const top = Math.min(
    Math.max(12, event.clientY - containerRect.top - tooltipRect.height - 10),
    Math.max(12, containerRect.height - tooltipRect.height - 12)
  );

  tooltipNode.style.left = `${left}px`;
  tooltipNode.style.top = `${top}px`;
}

export function hideSiteProfileTooltip(tooltipNode: HTMLDivElement | null) {
  if (!tooltipNode) {
    return;
  }

  tooltipNode.dataset.visible = "false";
}

export function resolveSiteProfileHoverDatum(
  values: Array<{ x: number; density: number }>,
  pointerX: number,
  scaleX: ScaleLinear<number, number>
) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const targetX = scaleX.invert(pointerX);
  let bestPoint = values[0];
  let bestDistance = Math.abs(values[0].x - targetX);

  values.forEach((point) => {
    const distance = Math.abs(point.x - targetX);
    if (distance < bestDistance) {
      bestPoint = point;
      bestDistance = distance;
    }
  });

  return bestPoint;
}

export function showSiteProfileTooltip(
  tooltipNode: HTMLDivElement | null,
  containerNode: HTMLDivElement | null,
  event: MouseEvent,
  panelTitle: string,
  series: { name: string; originalName?: string },
  datum: { x: number; density: number } | null,
  yLabel: string
) {
  if (!tooltipNode || !containerNode || !series || !datum) {
    return;
  }

  tooltipNode.innerHTML = [
    `<div class="site-profile-tooltip__label">${series.name}</div>`,
    series.originalName
      ? `<div class="site-profile-tooltip__row site-profile-tooltip__row--file"><span>File</span><strong>${series.originalName}</strong></div>`
      : "",
    `<div class="site-profile-tooltip__row"><span>Panel</span><strong>${panelTitle}</strong></div>`,
    `<div class="site-profile-tooltip__row"><span>Position</span><strong>${formatValue(datum.x, 1)}</strong></div>`,
    `<div class="site-profile-tooltip__row"><span>${yLabel || "Density"}</span><strong>${formatValue(datum.density, 3)}</strong></div>`
  ].join("");

  tooltipNode.dataset.visible = "true";
  placeTooltip(tooltipNode, containerNode, event);
}
