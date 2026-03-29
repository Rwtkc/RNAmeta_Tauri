import { readTextFile } from "@tauri-apps/plugin-fs";
import { SummaryStatItem } from "@/components/analysis/SummaryStatItem";
import type { FigureExportState } from "@/components/analysis/FigureExportDialog";
import {
  buildSplicesiteRequest,
  coerceSplicesiteRunResult,
  parseSplicesiteProgressLine
} from "@/lib/splicesiteRuntime";
import {
  buildTranscriptionRequest,
  coerceTranscriptionRunResult,
  parseTranscriptionProgressLine
} from "@/lib/transcriptionRuntime";
import {
  buildTranslationRequest,
  coerceTranslationRunResult,
  parseTranslationProgressLine
} from "@/lib/translationRuntime";
import {
  getSiteModuleDefinition,
  type SiteModuleId
} from "@/modules/SiteProfile/siteModuleDefinitions";
import { useAppStore } from "@/store/useAppStore";
import type {
  SiteProfilePayload,
  SplicesiteRunResult,
  SplicesiteSummary,
  TranscriptionRunResult,
  TranscriptionSummary,
  TranslationRunResult,
  TranslationSummary
} from "@/types/native";

export type SiteRunResult =
  | TranscriptionRunResult
  | TranslationRunResult
  | SplicesiteRunResult;

export type SiteSummary =
  | TranscriptionSummary
  | TranslationSummary
  | SplicesiteSummary;

export const defaultSiteExportState: FigureExportState = {
  format: "png",
  width: "1400",
  height: "1600",
  dpi: "300"
};

export function formatSiteExportError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // ignore
  }

  return String(error);
}

function formatIsoDate() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function resolveSiteSummaryNotice(
  moduleId: SiteModuleId,
  summary: SiteSummary | null
) {
  if (moduleId !== "transcription" || !summary) {
    return "";
  }

  const transcriptionSummary = summary as TranscriptionSummary;
  if (!transcriptionSummary.hasSignal) {
    return transcriptionSummary.emptyStateMessage ?? "";
  }

  if (!transcriptionSummary.hasHeatmapSignal) {
    return transcriptionSummary.heatmapNoticeMessage ?? "";
  }

  return "";
}

export function normalizeSiteEngineLine(moduleId: SiteModuleId, line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const config = getSiteModuleDefinition(moduleId);
  const progress =
    moduleId === "transcription"
      ? parseTranscriptionProgressLine(trimmed)
      : moduleId === "translation"
        ? parseTranslationProgressLine(trimmed)
        : parseSplicesiteProgressLine(trimmed);

  if (progress) {
    return {
      type: "info" as const,
      message: `[${config.logPrefix}] ${progress.percent}% ${progress.detail}`
    };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("welcome to bioconductor") ||
    lower.includes("the following objects are masked") ||
    lower.includes("vignettes contain introductory material") ||
    lower.includes("citation(")
  ) {
    return null;
  }

  if (lower.includes("warning")) {
    return { type: "info" as const, message: `[${config.logPrefix}] ${trimmed}` };
  }

  if (lower.includes("error") || lower.includes("failed")) {
    return { type: "error" as const, message: `[${config.logPrefix}] ${trimmed}` };
  }

  return null;
}

export function buildSiteRequest(
  moduleId: SiteModuleId,
  payload: {
    species: string;
    speciesId: string;
    annotationDir: string;
    filePaths: string[];
  }
) {
  if (moduleId === "transcription") {
    return buildTranscriptionRequest(payload);
  }

  if (moduleId === "translation") {
    return buildTranslationRequest(payload);
  }

  return buildSplicesiteRequest(payload);
}

function coerceSiteRunResult(moduleId: SiteModuleId, raw: string) {
  if (moduleId === "transcription") {
    return coerceTranscriptionRunResult(raw);
  }

  if (moduleId === "translation") {
    return coerceTranslationRunResult(raw);
  }

  return coerceSplicesiteRunResult(raw);
}

export async function tryReadSiteRunResult(
  moduleId: SiteModuleId,
  path: string
) {
  try {
    const raw = await readTextFile(path);
    return coerceSiteRunResult(moduleId, raw);
  } catch {
    return null;
  }
}

export function siteExportFileName(
  moduleId: SiteModuleId,
  extension: FigureExportState["format"]
) {
  return `${getSiteModuleDefinition(moduleId).exportPrefix}_${formatIsoDate()}.${extension}`;
}

export function siteSuccessLogMessage(
  moduleId: SiteModuleId,
  summary: SiteSummary
) {
  const config = getSiteModuleDefinition(moduleId);

  if (moduleId === "transcription") {
    const item = summary as TranscriptionSummary;
    return `[${config.logPrefix}] Completed ${item.sampleCount} sample(s), ${item.intervalCount} intervals, ${item.boundaryHitCount} boundary hits.`;
  }

  if (moduleId === "translation") {
    const item = summary as TranslationSummary;
    return `[${config.logPrefix}] Completed ${item.sampleCount} sample(s), ${item.intervalCount} intervals, ${item.boundaryHitCount} boundary hits.`;
  }

  const item = summary as SplicesiteSummary;
  return `[${config.logPrefix}] Completed ${item.sampleCount} sample(s), ${item.intervalCount} intervals, ${item.junctionHitCount} junction hits.`;
}

export function renderSiteSummaryCards(
  moduleId: SiteModuleId,
  summary: SiteSummary
) {
  if (moduleId === "transcription") {
    const item = summary as TranscriptionSummary;
    return (
      <>
        <SummaryStatItem label="Species" value={item.species} />
        <SummaryStatItem label="Samples" value={String(item.sampleCount)} />
        <SummaryStatItem label="Intervals" value={String(item.intervalCount)} />
        <SummaryStatItem
          label="Heatmap Sample"
          value={
            !item.hasSignal
              ? "No boundary hits"
              : !item.hasHeatmapSignal
                ? "No heatmap signal"
                : item.heatmapSample || "Unavailable"
          }
        />
      </>
    );
  }

  if (moduleId === "translation") {
    const item = summary as TranslationSummary;
    return (
      <>
        <SummaryStatItem label="Species" value={item.species} />
        <SummaryStatItem label="Samples" value={String(item.sampleCount)} />
        <SummaryStatItem label="Intervals" value={String(item.intervalCount)} />
        <SummaryStatItem
          label="Heatmap Sample"
          value={item.heatmapSample || "Unavailable"}
        />
      </>
    );
  }

  const item = summary as SplicesiteSummary;
  return (
    <>
      <SummaryStatItem label="Species" value={item.species} />
      <SummaryStatItem label="Samples" value={String(item.sampleCount)} />
      <SummaryStatItem label="Intervals" value={String(item.intervalCount)} />
      <SummaryStatItem
        label="Junction Hits"
        value={String(item.junctionHitCount)}
      />
    </>
  );
}

export function resolveSiteStoreSlice(
  moduleId: SiteModuleId,
  state: ReturnType<typeof useAppStore.getState>
) {
  if (moduleId === "transcription") {
    return {
      payload: state.transcriptionPayload,
      summary: state.transcriptionSummary
    };
  }

  if (moduleId === "translation") {
    return {
      payload: state.translationPayload,
      summary: state.translationSummary
    };
  }

  return {
    payload: state.splicesitePayload,
    summary: state.splicesiteSummary
  };
}

export function setSiteStoreResult(
  store: ReturnType<typeof useAppStore.getState>,
  moduleId: SiteModuleId,
  payload: SiteProfilePayload | null,
  summary: SiteSummary | null
) {
  if (moduleId === "transcription") {
    store.setTranscriptionResult(payload, summary as TranscriptionSummary | null);
    return;
  }

  if (moduleId === "translation") {
    store.setTranslationResult(payload, summary as TranslationSummary | null);
    return;
  }

  store.setSplicesiteResult(payload, summary as SplicesiteSummary | null);
}
