import { jsPDF } from "jspdf";
import * as opentype from "opentype.js";
import { svg2pdf } from "svg2pdf.js";
import montserrat400Woff from "@fontsource/montserrat/files/montserrat-latin-400-normal.woff";
import montserrat500Woff from "@fontsource/montserrat/files/montserrat-latin-500-normal.woff";
import montserrat600Woff from "@fontsource/montserrat/files/montserrat-latin-600-normal.woff";
import montserrat700Woff from "@fontsource/montserrat/files/montserrat-latin-700-normal.woff";
import montserrat800Woff from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff";

const SVG_NS = "http://www.w3.org/2000/svg";
const EXPORT_BACKGROUND = "#fffdf8";
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const FONT_ASSETS = {
  montserrat400: montserrat400Woff,
  montserrat500: montserrat500Woff,
  montserrat600: montserrat600Woff,
  montserrat700: montserrat700Woff,
  montserrat800: montserrat800Woff
} as const;
const fontPromises = new Map<string, Promise<any>>();

function parseSvgMarkup(svgMarkup: string) {
  const documentNode = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const parserError = documentNode.querySelector("parsererror");

  if (parserError) {
    throw new Error("Meta Plot SVG markup could not be parsed for export.");
  }

  const svgNode = documentNode.documentElement;
  if (!svgNode || svgNode.tagName.toLowerCase() !== "svg") {
    throw new Error("Meta Plot export did not resolve to an SVG root.");
  }

  return svgNode as unknown as SVGSVGElement;
}

function getSvgIntrinsicSize(svgNode: SVGSVGElement) {
  const viewBox = svgNode.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const width = Number(svgNode.getAttribute("width"));
  const height = Number(svgNode.getAttribute("height"));
  if (width > 0 && height > 0) {
    return { width, height };
  }

  throw new Error("Meta Plot export SVG does not expose a valid size.");
}

function getSvgTargetSize(svgNode: SVGSVGElement) {
  const width = Number(svgNode.getAttribute("width"));
  const height = Number(svgNode.getAttribute("height"));
  if (width > 0 && height > 0) {
    return { width, height };
  }

  return getSvgIntrinsicSize(svgNode);
}

function cloneSvgNodeForExport(
  svgNode: SVGSVGElement,
  targetWidth?: number,
  targetHeight?: number
) {
  const clone = svgNode.cloneNode(true) as SVGSVGElement;
  const intrinsic = getSvgIntrinsicSize(svgNode);
  const width = Math.max(1, Math.round(targetWidth ?? intrinsic.width));
  const height = Math.max(1, Math.round(targetHeight ?? intrinsic.height));

  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", `${width}`);
  clone.setAttribute("height", `${height}`);
  clone.setAttribute("viewBox", `0 0 ${intrinsic.width} ${intrinsic.height}`);
  clone.setAttribute("preserveAspectRatio", "none");

  const background = clone.ownerDocument.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", `${intrinsic.width}`);
  background.setAttribute("height", `${intrinsic.height}`);
  background.setAttribute("fill", EXPORT_BACKGROUND);
  clone.insertBefore(background, clone.firstChild);

  return clone;
}

function serializeSvg(svgNode: SVGSVGElement) {
  return new XMLSerializer().serializeToString(svgNode);
}

async function svgMarkupToCanvas(
  svgMarkup: string,
  targetWidth?: number,
  targetHeight?: number
) {
  const svgNode = parseSvgMarkup(svgMarkup);
  const clonedSvg = cloneSvgNodeForExport(svgNode, targetWidth, targetHeight);
  const { width: exportWidth, height: exportHeight } = getSvgTargetSize(clonedSvg);
  const serialized = serializeSvg(clonedSvg);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Meta Plot export image load failed."));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Meta Plot export canvas context unavailable.");
    }

    context.fillStyle = EXPORT_BACKGROUND;
    context.fillRect(0, 0, exportWidth, exportHeight);
    context.drawImage(image, 0, 0, exportWidth, exportHeight);

    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function readUint32(source: Uint8Array, offset: number) {
  return (
    ((source[offset] << 24) >>> 0) |
    (source[offset + 1] << 16) |
    (source[offset + 2] << 8) |
    source[offset + 3]
  ) >>> 0;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function buildPngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  writeUint32(chunk, 8 + data.length, crc32(crcInput));

  return chunk;
}

function addPngDpiMetadata(pngBytes: Uint8Array, dpi: number) {
  const hasPngSignature =
    pngBytes.length > PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((value, index) => pngBytes[index] === value);

  if (!hasPngSignature) {
    throw new Error("Meta Plot export did not produce a valid PNG payload.");
  }

  const pixelsPerMeter = Math.max(1, Math.round(dpi / 0.0254));
  const physData = new Uint8Array(9);
  writeUint32(physData, 0, pixelsPerMeter);
  writeUint32(physData, 4, pixelsPerMeter);
  physData[8] = 1;
  const physChunk = buildPngChunk("pHYs", physData);

  let offset = PNG_SIGNATURE.length;
  let insertOffset = -1;
  let existingPhysStart = -1;
  let existingPhysEnd = -1;

  while (offset + 12 <= pngBytes.length) {
    const chunkLength = readUint32(pngBytes, offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const chunkEnd = dataStart + chunkLength + 4;
    const type = new TextDecoder().decode(pngBytes.slice(typeStart, typeStart + 4));

    if (type === "pHYs") {
      existingPhysStart = offset;
      existingPhysEnd = chunkEnd;
    }

    if (insertOffset === -1 && type === "IHDR") {
      insertOffset = chunkEnd;
    }

    offset = chunkEnd;
    if (type === "IEND") {
      break;
    }
  }

  if (insertOffset === -1) {
    throw new Error("Meta Plot export PNG metadata insertion failed.");
  }

  const sourceBytes =
    existingPhysStart >= 0
      ? new Uint8Array([
          ...pngBytes.slice(0, existingPhysStart),
          ...pngBytes.slice(existingPhysEnd)
        ])
      : pngBytes;

  const finalInsertOffset =
    existingPhysStart >= 0 && existingPhysStart < insertOffset
      ? insertOffset - (existingPhysEnd - existingPhysStart)
      : insertOffset;

  return new Uint8Array([
    ...sourceBytes.slice(0, finalInsertOffset),
    ...physChunk,
    ...sourceBytes.slice(finalInsertOffset)
  ]);
}

function parseStyleAttribute(styleText: string | null) {
  return String(styleText || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const splitIndex = entry.indexOf(":");
      if (splitIndex === -1) {
        return accumulator;
      }

      const key = entry.slice(0, splitIndex).trim();
      const value = entry.slice(splitIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function getSvgTextValue(node: Element, name: string) {
  let current: Element | null = node;

  while (current) {
    const explicit = current.getAttribute(name);
    if (explicit != null) {
      return explicit;
    }

    const styleMap = parseStyleAttribute(current.getAttribute("style"));
    if (styleMap[name] != null) {
      return styleMap[name];
    }

    current = current.parentElement;
  }

  return null;
}

function parseSvgLength(value: string | null, fontSize: number) {
  if (value == null || value === "") {
    return 0;
  }

  const text = String(value).trim();
  const numeric = Number.parseFloat(text);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (text.endsWith("em")) {
    return numeric * fontSize;
  }

  return numeric;
}

function normalizeFontWeight(value: string | null) {
  const numeric = Number.parseInt(String(value || "400"), 10);
  if (Number.isNaN(numeric)) {
    return 400;
  }
  if (numeric >= 750) {
    return 800;
  }
  if (numeric >= 650) {
    return 700;
  }
  if (numeric >= 550) {
    return 600;
  }
  if (numeric >= 450) {
    return 500;
  }
  return 400;
}

function resolveFontKey(node: Element) {
  return `montserrat${normalizeFontWeight(getSvgTextValue(node, "font-weight"))}`;
}

function resolveBaselineOffset(font: any, fontSize: number, baseline: string | null) {
  const units = font.unitsPerEm || 1000;
  const ascender = font.ascender || 0;
  const descender = font.descender || 0;
  const normalized = String(baseline || "alphabetic").toLowerCase();

  if (normalized === "middle" || normalized === "central") {
    return (((ascender + descender) / 2) / units) * fontSize;
  }

  return 0;
}

function loadFontByKey(fontKey: keyof typeof FONT_ASSETS) {
  if (!fontPromises.has(fontKey)) {
    const assetUrl = FONT_ASSETS[fontKey];
    fontPromises.set(
      fontKey,
      fetch(assetUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to load Meta Plot export font.");
          }
          return response.arrayBuffer();
        })
        .then((buffer) => opentype.parse(buffer))
    );
  }

  return fontPromises.get(fontKey)!;
}

async function convertTextToPaths(svgRoot: SVGSVGElement) {
  const textNodes = Array.from(svgRoot.querySelectorAll("text")).filter((node) =>
    String(node.textContent || "").trim()
  );

  if (!textNodes.length) {
    return;
  }

  const uniqueFontKeys = [
    ...new Set(textNodes.map((node) => resolveFontKey(node) as keyof typeof FONT_ASSETS))
  ];
  const fonts = Object.fromEntries(
    await Promise.all(
      uniqueFontKeys.map(async (fontKey) => [fontKey, await loadFontByKey(fontKey)])
    )
  ) as Record<keyof typeof FONT_ASSETS, any>;

  textNodes.forEach((node) => {
    const text = String(node.textContent || "");
    const font = fonts[resolveFontKey(node) as keyof typeof FONT_ASSETS];
    const fontSize = Number.parseFloat(getSvgTextValue(node, "font-size") || "16");
    const anchor = String(getSvgTextValue(node, "text-anchor") || "start").toLowerCase();
    const baseline = String(
      getSvgTextValue(node, "dominant-baseline") || "alphabetic"
    ).toLowerCase();
    let x = Number.parseFloat(node.getAttribute("x") || "0");
    let y = Number.parseFloat(node.getAttribute("y") || "0");
    x += parseSvgLength(node.getAttribute("dx"), fontSize);
    y += parseSvgLength(node.getAttribute("dy"), fontSize);
    const advance = font.getAdvanceWidth(text, fontSize);

    if (anchor === "middle") {
      x -= advance / 2;
    } else if (anchor === "end") {
      x -= advance;
    }

    y += resolveBaselineOffset(font, fontSize, baseline);

    const pathNode = svgRoot.ownerDocument.createElementNS(SVG_NS, "path");
    pathNode.setAttribute("d", font.getPath(text, x, y, fontSize).toPathData(2));
    pathNode.setAttribute("fill", getSvgTextValue(node, "fill") || "#22301f");
    pathNode.setAttribute("stroke", "none");

    const transform = node.getAttribute("transform");
    if (transform) {
      pathNode.setAttribute("transform", transform);
    }

    const opacity = getSvgTextValue(node, "opacity");
    if (opacity != null) {
      pathNode.setAttribute("opacity", opacity);
    }

    node.replaceWith(pathNode);
  });
}

async function canvasToPngBytes(canvas: HTMLCanvasElement, dpi = 300) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
      } else {
        reject(new Error("Meta Plot PNG export blob generation failed."));
      }
    }, "image/png");
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return addPngDpiMetadata(bytes, dpi);
}

export async function buildMetaPlotPngBytes(
  svgMarkup: string,
  width?: number,
  height?: number,
  dpi = 300
) {
  const canvas = await svgMarkupToCanvas(svgMarkup, width, height);
  return canvasToPngBytes(canvas, dpi);
}

export async function buildMetaPlotPdfBytes(
  svgMarkup: string,
  targetWidth?: number,
  targetHeight?: number,
  dpi = 300
) {
  const svgNode = cloneSvgNodeForExport(parseSvgMarkup(svgMarkup), targetWidth, targetHeight);
  const { width: exportWidth, height: exportHeight } = getSvgTargetSize(svgNode);
  const pdfWidthPt = (exportWidth / dpi) * 72;
  const pdfHeightPt = (exportHeight / dpi) * 72;

  await convertTextToPaths(svgNode);

  const pdf = new jsPDF({
    orientation: pdfWidthPt >= pdfHeightPt ? "landscape" : "portrait",
    unit: "pt",
    format: [pdfWidthPt, pdfHeightPt],
    compress: true
  });

  await svg2pdf(svgNode, pdf, {
    x: 0,
    y: 0,
    width: pdfWidthPt,
    height: pdfHeightPt
  });
  const arrayBuffer = pdf.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
