import type { MetaPlotControls } from "@/store/useAppStore";

export interface MetaPlotControlField {
  key: keyof MetaPlotControls;
  label: string;
  type: "select" | "binary" | "number";
  options?: Array<{ label: string; value: string }>;
}

export const transcriptSettings: MetaPlotControlField[] = [
  {
    key: "pltTxType",
    label: "Transcript Type",
    type: "select",
    options: [
      { label: "exon", value: "tx" },
      { label: "mRNA", value: "mrna" },
      { label: "lncRNA", value: "ncrna" }
    ]
  },
  {
    key: "headOrtail",
    label: "Retention of Promoter and Tail",
    type: "binary",
    options: [
      { label: "TRUE", value: "TRUE" },
      { label: "FALSE", value: "FALSE" }
    ]
  },
  {
    key: "txPrimaryOnly",
    label: "Use Primary Transcripts Only",
    type: "binary",
    options: [
      { label: "TRUE", value: "TRUE" },
      { label: "FALSE", value: "FALSE" }
    ]
  },
  {
    key: "txlncrnaOverlapmrna",
    label: "Allow lncRNA and mRNA to Overlap",
    type: "binary",
    options: [
      { label: "TRUE", value: "TRUE" },
      { label: "FALSE", value: "FALSE" }
    ]
  },
  {
    key: "mapFilterTranscript",
    label: "Filter Length by Original Transcript Locus",
    type: "binary",
    options: [
      { label: "TRUE", value: "TRUE" },
      { label: "FALSE", value: "FALSE" }
    ]
  }
];

export const samplingSettings: MetaPlotControlField[] = [
  {
    key: "enableCI",
    label: "Add Confidence Interval Curves",
    type: "binary",
    options: [
      { label: "TRUE", value: "TRUE" },
      { label: "FALSE", value: "FALSE" }
    ]
  },
  {
    key: "stSampleModle",
    label: "Sampling Methods",
    type: "select",
    options: [
      { label: "Equidistance", value: "Equidistance" },
      { label: "random", value: "random" }
    ]
  },
  {
    key: "stSampleNum",
    label: "Number of Bases Extracted Per Site",
    type: "number"
  },
  {
    key: "stAmblguity",
    label: "Maximum Overlap Between Sites",
    type: "number"
  }
];

export const lengthFilters: Array<{ key: keyof MetaPlotControls; label: string }> = [
  { key: "txfiveutrMinLength", label: "Length of 5'UTR (bp)" },
  { key: "txcdsMinLength", label: "Length of CDS (bp)" },
  { key: "txthreeutrMinLength", label: "Length of 3'UTR (bp)" },
  { key: "txlongNcrnaMinLength", label: "Length of lncRNA (bp)" },
  { key: "txpromoterLength", label: "Length of Promoter (bp)" },
  { key: "txtailLength", label: "Length of Tail (bp)" }
];

export const curveSettings: Array<{ key: keyof MetaPlotControls; label: string }> = [
  { key: "adjust", label: "Smoothness" },
  { key: "overlapIndex", label: "Overlap Index" },
  { key: "siteLengthIndex", label: "Site Length Index" }
];
