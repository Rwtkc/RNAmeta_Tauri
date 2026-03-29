function includesToken(value: string | null | undefined, token: string) {
  return typeof value === "string" && value.includes(token);
}

export function resolveSvgDrawBox(input: {
  targetLeft: number;
  targetTop: number;
  targetWidth: number;
  targetHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceContentLeft?: number;
  sourceContentTop?: number;
  sourceContentWidth?: number;
  sourceContentHeight?: number;
  preserveAspectRatio?: string | null;
}) {
  const sourceContentLeft = input.sourceContentLeft ?? 0;
  const sourceContentTop = input.sourceContentTop ?? 0;
  const sourceContentWidth = input.sourceContentWidth ?? input.sourceWidth;
  const sourceContentHeight = input.sourceContentHeight ?? input.sourceHeight;

  if (
    !Number.isFinite(input.targetLeft) ||
    !Number.isFinite(input.targetTop) ||
    !Number.isFinite(input.targetWidth) ||
    !Number.isFinite(input.targetHeight) ||
    !Number.isFinite(input.sourceWidth) ||
    !Number.isFinite(input.sourceHeight) ||
    !Number.isFinite(sourceContentLeft) ||
    !Number.isFinite(sourceContentTop) ||
    !Number.isFinite(sourceContentWidth) ||
    !Number.isFinite(sourceContentHeight) ||
    input.targetWidth <= 0 ||
    input.targetHeight <= 0 ||
    input.sourceWidth <= 0 ||
    input.sourceHeight <= 0 ||
    sourceContentWidth <= 0 ||
    sourceContentHeight <= 0
  ) {
    return null;
  }

  if (!input.preserveAspectRatio || input.preserveAspectRatio === "none") {
    const scaleX = input.targetWidth / sourceContentWidth;
    const scaleY = input.targetHeight / sourceContentHeight;

    return {
      left: input.targetLeft - sourceContentLeft * scaleX,
      top: input.targetTop - sourceContentTop * scaleY,
      width: input.sourceWidth * scaleX,
      height: input.sourceHeight * scaleY
    };
  }

  const scale = Math.min(
    input.targetWidth / input.sourceWidth,
    input.targetHeight / input.sourceHeight
  );
  const width = input.sourceWidth * scale;
  const height = input.sourceHeight * scale;
  let left = input.targetLeft;
  let top = input.targetTop;

  if (includesToken(input.preserveAspectRatio, "xMid")) {
    left += (input.targetWidth - width) / 2;
  } else if (includesToken(input.preserveAspectRatio, "xMax")) {
    left += input.targetWidth - width;
  }

  if (includesToken(input.preserveAspectRatio, "YMid")) {
    top += (input.targetHeight - height) / 2;
  } else if (includesToken(input.preserveAspectRatio, "YMax")) {
    top += input.targetHeight - height;
  }

  return { left, top, width, height };
}
