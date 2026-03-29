import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AnnotationValidation,
  BoxplotPayload,
  FacetedBoxplotPayload,
  GeneMatrixPayload,
  GeneMatrixSummary,
  GeneTypeSummary,
  MetaPlotPayload,
  MetaPlotSummary,
  PeakExonNumSummary,
  PeakExonSizeSummary,
  PeakExonTypeSummary,
  PeakDistributionPayload,
  PeakDistributionSummary,
  PeakGeneSizeSummary,
  SiteProfilePayload,
  SplicesiteSummary,
  TranscriptionSummary,
  TranslationSummary,
  PreviewTable
} from "@/types/native";

export interface MetaPlotControls {
  pltTxType: "tx" | "mrna" | "ncrna";
  headOrtail: "TRUE" | "FALSE";
  txPrimaryOnly: "TRUE" | "FALSE";
  txlncrnaOverlapmrna: "TRUE" | "FALSE";
  mapFilterTranscript: "TRUE" | "FALSE";
  enableCI: "TRUE" | "FALSE";
  stSampleModle: "Equidistance" | "random";
  stSampleNum: number;
  stAmblguity: number;
  txfiveutrMinLength: number;
  txcdsMinLength: number;
  txthreeutrMinLength: number;
  txlongNcrnaMinLength: number;
  txpromoterLength: number;
  txtailLength: number;
  adjust: number;
  overlapIndex: number;
  siteLengthIndex: number;
}

export interface PeakDistributionControls {
  selectedFeatures: string[];
}

export const defaultMetaPlotControls: MetaPlotControls = {
  pltTxType: "tx",
  headOrtail: "TRUE",
  txPrimaryOnly: "TRUE",
  txlncrnaOverlapmrna: "TRUE",
  mapFilterTranscript: "TRUE",
  enableCI: "FALSE",
  stSampleModle: "Equidistance",
  stSampleNum: 10,
  stAmblguity: 5,
  txfiveutrMinLength: 100,
  txcdsMinLength: 100,
  txthreeutrMinLength: 100,
  txlongNcrnaMinLength: 100,
  txpromoterLength: 1000,
  txtailLength: 1000,
  adjust: 1,
  overlapIndex: 1,
  siteLengthIndex: 1
};

export const defaultPeakDistributionControls: PeakDistributionControls = {
  selectedFeatures: [
    "Promoter",
    "UTR5",
    "Start Codon",
    "CDS",
    "Stop Codon",
    "UTR3",
    "Intron",
    "Intergenic"
  ]
};

const emptyAnalysisResults = {
  metaPlotPayload: null,
  metaPlotSummary: null,
  peakDistributionPayload: null,
  peakDistributionSummary: null,
  geneTypePayload: null,
  geneTypeSummary: null,
  peakGeneSizePayload: null,
  peakGeneSizeSummary: null,
  peakExonSizePayload: null,
  peakExonSizeSummary: null,
  peakExonTypePayload: null,
  peakExonTypeSummary: null,
  peakExonNumPayload: null,
  peakExonNumSummary: null,
  geneMatrixPayload: null,
  geneMatrixSummary: null,
  transcriptionPayload: null,
  transcriptionSummary: null,
  translationPayload: null,
  translationSummary: null,
  splicesitePayload: null,
  splicesiteSummary: null
} as const;

const emptyPreviewState = {
  preview: null,
  previewFile: ""
} as const;

interface AppState {
  annotationDir: string;
  annotationValidation: AnnotationValidation | null;
  species: string;
  selectedFiles: string[];
  savedFiles: string[];
  preview: PreviewTable | null;
  previewFile: string;
  metaPlotControls: MetaPlotControls;
  peakDistributionControls: PeakDistributionControls;
  metaPlotPayload: MetaPlotPayload | null;
  metaPlotSummary: MetaPlotSummary | null;
  peakDistributionPayload: PeakDistributionPayload | null;
  peakDistributionSummary: PeakDistributionSummary | null;
  geneTypePayload: PeakDistributionPayload | null;
  geneTypeSummary: GeneTypeSummary | null;
  peakGeneSizePayload: BoxplotPayload | null;
  peakGeneSizeSummary: PeakGeneSizeSummary | null;
  peakExonSizePayload: FacetedBoxplotPayload | null;
  peakExonSizeSummary: PeakExonSizeSummary | null;
  peakExonTypePayload: PeakDistributionPayload | null;
  peakExonTypeSummary: PeakExonTypeSummary | null;
  peakExonNumPayload: BoxplotPayload | null;
  peakExonNumSummary: PeakExonNumSummary | null;
  geneMatrixPayload: GeneMatrixPayload | null;
  geneMatrixSummary: GeneMatrixSummary | null;
  transcriptionPayload: SiteProfilePayload | null;
  transcriptionSummary: TranscriptionSummary | null;
  translationPayload: SiteProfilePayload | null;
  translationSummary: TranslationSummary | null;
  splicesitePayload: SiteProfilePayload | null;
  splicesiteSummary: SplicesiteSummary | null;
  setAnnotationDir: (path: string) => void;
  setAnnotationValidation: (value: AnnotationValidation | null) => void;
  setSpecies: (value: string) => void;
  setSelectedFiles: (files: string[], normalizedFiles?: string[]) => void;
  saveUploadContext: () => void;
  setPreview: (preview: PreviewTable | null, filePath: string) => void;
  setMetaPlotControl: <K extends keyof MetaPlotControls>(
    key: K,
    value: MetaPlotControls[K]
  ) => void;
  setPeakDistributionFeatures: (features: string[]) => void;
  setMetaPlotResult: (
    payload: MetaPlotPayload | null,
    summary: MetaPlotSummary | null
  ) => void;
  setPeakDistributionResult: (
    payload: PeakDistributionPayload | null,
    summary: PeakDistributionSummary | null
  ) => void;
  setGeneTypeResult: (
    payload: PeakDistributionPayload | null,
    summary: GeneTypeSummary | null
  ) => void;
  setPeakGeneSizeResult: (
    payload: BoxplotPayload | null,
    summary: PeakGeneSizeSummary | null
  ) => void;
  setPeakExonSizeResult: (
    payload: FacetedBoxplotPayload | null,
    summary: PeakExonSizeSummary | null
  ) => void;
  setPeakExonTypeResult: (
    payload: PeakDistributionPayload | null,
    summary: PeakExonTypeSummary | null
  ) => void;
  setPeakExonNumResult: (
    payload: BoxplotPayload | null,
    summary: PeakExonNumSummary | null
  ) => void;
  setGeneMatrixResult: (
    payload: GeneMatrixPayload | null,
    summary: GeneMatrixSummary | null
  ) => void;
  setTranscriptionResult: (
    payload: SiteProfilePayload | null,
    summary: TranscriptionSummary | null
  ) => void;
  setTranslationResult: (
    payload: SiteProfilePayload | null,
    summary: TranslationSummary | null
  ) => void;
  setSplicesiteResult: (
    payload: SiteProfilePayload | null,
    summary: SplicesiteSummary | null
  ) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      annotationDir: "",
      annotationValidation: null,
      species: "",
      selectedFiles: [],
      savedFiles: [],
      ...emptyPreviewState,
      metaPlotControls: defaultMetaPlotControls,
      peakDistributionControls: defaultPeakDistributionControls,
      ...emptyAnalysisResults,
      setAnnotationDir: (path) =>
        set({
          annotationDir: path,
          annotationValidation: null,
          ...emptyAnalysisResults
        }),
      setAnnotationValidation: (value) => set({ annotationValidation: value }),
      setSpecies: (value) =>
        set({
          species: value,
          annotationValidation: null,
          ...emptyAnalysisResults
        }),
      setSelectedFiles: (files, normalizedFiles) =>
        set({
          selectedFiles: files,
          savedFiles: normalizedFiles ?? files,
          ...emptyPreviewState,
          ...emptyAnalysisResults
        }),
      saveUploadContext: () => {
        const { selectedFiles, savedFiles } = get();
        set({
          savedFiles: savedFiles.length > 0 ? savedFiles : selectedFiles,
          ...emptyPreviewState,
          ...emptyAnalysisResults
        });
      },
      setPreview: (preview, filePath) => set({ preview, previewFile: filePath }),
      setMetaPlotControl: (key, value) =>
        set((state) => ({
          metaPlotControls: {
            ...state.metaPlotControls,
            [key]: value
          }
        })),
      setPeakDistributionFeatures: (features) =>
        set((state) => ({
          peakDistributionControls: {
            ...state.peakDistributionControls,
            selectedFeatures: features
          }
        })),
      setMetaPlotResult: (payload, summary) =>
        set({ metaPlotPayload: payload, metaPlotSummary: summary }),
      setPeakDistributionResult: (payload, summary) =>
        set({
          peakDistributionPayload: payload,
          peakDistributionSummary: summary
        }),
      setGeneTypeResult: (payload, summary) =>
        set({
          geneTypePayload: payload,
          geneTypeSummary: summary
        }),
      setPeakGeneSizeResult: (payload, summary) =>
        set({
          peakGeneSizePayload: payload,
          peakGeneSizeSummary: summary
        }),
      setPeakExonSizeResult: (payload, summary) =>
        set({
          peakExonSizePayload: payload,
          peakExonSizeSummary: summary
        }),
      setPeakExonTypeResult: (payload, summary) =>
        set({
          peakExonTypePayload: payload,
          peakExonTypeSummary: summary
        }),
      setPeakExonNumResult: (payload, summary) =>
        set({
          peakExonNumPayload: payload,
          peakExonNumSummary: summary
        }),
      setGeneMatrixResult: (payload, summary) =>
        set({
          geneMatrixPayload: payload,
          geneMatrixSummary: summary
        }),
      setTranscriptionResult: (payload, summary) =>
        set({
          transcriptionPayload: payload,
          transcriptionSummary: summary
        }),
      setTranslationResult: (payload, summary) =>
        set({
          translationPayload: payload,
          translationSummary: summary
        }),
      setSplicesiteResult: (payload, summary) =>
        set({
          splicesitePayload: payload,
          splicesiteSummary: summary
        })
    }),
    {
      name: "rnameta-desktop-store",
      partialize: (state) => ({
        annotationDir: state.annotationDir,
        annotationValidation: state.annotationValidation,
        species: state.species
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AppState>;

        return {
          ...currentState,
          annotationDir: persisted.annotationDir ?? currentState.annotationDir,
          annotationValidation:
            persisted.annotationValidation ?? currentState.annotationValidation,
          species: persisted.species ?? currentState.species
        };
      }
    }
  )
);
