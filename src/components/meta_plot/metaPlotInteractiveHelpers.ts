import type { MetaPlotSeriesValue } from "@/types/native";

export function formatPosition(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatFrequency(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  return value.toFixed(4).replace(/\.?0+$/, "");
}

export function findNearestValue(
  values: MetaPlotSeriesValue[],
  targetX: number
) {
  if (!values.length) {
    return null;
  }

  let nearest = values[0];
  let minDistance = Math.abs(nearest.x - targetX);

  values.forEach((item) => {
    const distance = Math.abs(item.x - targetX);
    if (distance < minDistance) {
      nearest = item;
      minDistance = distance;
    }
  });

  return nearest;
}

export function interpolateSeriesValue(
  values: MetaPlotSeriesValue[],
  targetX: number
) {
  if (!values.length) {
    return null;
  }

  if (targetX <= values[0].x) {
    return values[0];
  }

  if (targetX >= values[values.length - 1].x) {
    return values[values.length - 1];
  }

  for (let index = 1; index < values.length; index += 1) {
    const left = values[index - 1];
    const right = values[index];

    if (targetX <= right.x) {
      const span = Math.max(1e-9, right.x - left.x);
      const ratio = (targetX - left.x) / span;
      const interpolateOptional = (
        leftValue?: number | null,
        rightValue?: number | null
      ) => {
        if (typeof leftValue !== "number" || typeof rightValue !== "number") {
          return null;
        }

        return leftValue + (rightValue - leftValue) * ratio;
      };

      return {
        x: targetX,
        density: left.density + (right.density - left.density) * ratio,
        confidenceDown: interpolateOptional(left.confidenceDown, right.confidenceDown),
        confidenceUp: interpolateOptional(left.confidenceUp, right.confidenceUp)
      };
    }
  }

  return values[values.length - 1];
}

export function findPointOnPathByX(path: SVGPathElement, targetX: number) {
  const totalLength = path.getTotalLength();
  let start = 0;
  let end = totalLength;

  for (let iteration = 0; iteration < 22; iteration += 1) {
    const middle = (start + end) / 2;
    const point = path.getPointAtLength(middle);

    if (point.x < targetX) {
      start = middle;
    } else {
      end = middle;
    }
  }

  const startPoint = path.getPointAtLength(start);
  const endPoint = path.getPointAtLength(end);
  return Math.abs(startPoint.x - targetX) <= Math.abs(endPoint.x - targetX)
    ? startPoint
    : endPoint;
}
