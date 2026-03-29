export type SiteModuleId = "transcription" | "translation" | "splicesite";

export interface SiteModuleDefinition {
  id: SiteModuleId;
  label: string;
  title: string;
  titleDescription: string;
  resultDescription: string;
  runLabel: string;
  exportPrefix: string;
  runnerScript: string;
  cacheModuleName: string;
  logPrefix: string;
  idlePlaceholder: string;
}

export const SITE_MODULE_DEFINITIONS: SiteModuleDefinition[] = [
  {
    id: "transcription",
    label: "Transcription",
    title: "Transcription",
    titleDescription:
      "Profile peak density around transcription start and end boundaries and keep the heatmap view local to the desktop client.",
    resultDescription:
      "Boundary density curves with per-sample TSS/TES heatmaps rendered entirely on the client.",
    runLabel: "Run Transcription",
    exportPrefix: "transcription",
    runnerScript: "scripts/transcription_runner.R",
    cacheModuleName: "transcription",
    logPrefix: "Transcription",
    idlePlaceholder:
      "Run Transcription to render boundary density curves and heatmap panels."
  },
  {
    id: "translation",
    label: "Translation",
    title: "Translation",
    titleDescription:
      "Profile peak density around translation start and end sites with local TSS/TES heatmap rendering in the desktop client.",
    resultDescription:
      "Boundary density curves with per-sample translation start/end heatmaps rendered entirely on the client.",
    runLabel: "Run Translation",
    exportPrefix: "translation",
    runnerScript: "scripts/translation_runner.R",
    cacheModuleName: "translation",
    logPrefix: "Translation",
    idlePlaceholder:
      "Run Translation to render boundary density curves and heatmap panels."
  },
  {
    id: "splicesite",
    label: "Splicesite",
    title: "Splicesite",
    titleDescription:
      "Profile peak density around 5' and 3' splice junction windows across the selected BED inputs.",
    resultDescription:
      "Splice-site density curves rendered entirely on the client.",
    runLabel: "Run Splicesite",
    exportPrefix: "splicesite",
    runnerScript: "scripts/splicesite_runner.R",
    cacheModuleName: "splicesite",
    logPrefix: "Splicesite",
    idlePlaceholder:
      "Run Splicesite to render splice-site density curves."
  }
];

export const SITE_NAV_CHILDREN = SITE_MODULE_DEFINITIONS.map(({ id, label }) => ({
  id,
  label
}));

export function getSiteModuleDefinition(id: SiteModuleId) {
  const definition = SITE_MODULE_DEFINITIONS.find((item) => item.id === id);
  if (!definition) {
    throw new Error(`Unknown site module '${id}'.`);
  }

  return definition;
}
