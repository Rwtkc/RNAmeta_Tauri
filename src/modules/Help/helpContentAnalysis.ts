import type { HelpPage } from "./helpTypes";

export const helpContentAnalysis: HelpPage[] = [
  {
    id: "help-meta-plot",
    title: "Meta Plot",
    summary:
      "Generate transcript-relative metagene-style profiles from the current upload session and interpret how peak density changes across normalized transcript structure.",
    sections: [
      {
        title: "What Meta Plot answers",
        paragraphs: [
          "Meta Plot summarizes how peaks distribute across normalized transcript coordinates. It is useful when you want an overview of positional enrichment rather than a gene-by-gene table.",
          "This module is appropriate for questions such as whether a modification signal is enriched near transcript boundaries, whether samples show similar global positional shapes, and whether the dominant signal shifts after filtering or subgrouping."
        ]
      },
      {
        title: "How to use the controls",
        paragraphs: [
          "Configure transcript-related filters and smoothing settings before running the analysis. The purpose of the controls is to stabilize the plotted profile while keeping the biological comparison faithful to the uploaded BED context.",
          "After a run completes, inspect both the rendered chart and the summary metrics together. The curve shape gives the visual trend, while the summary block gives compact numerical support for reporting."
        ],
        lists: [
          {
            label: "Interpretation tips",
            items: [
              "Use the same upload session across repeated Meta Plot runs when you want to compare parameter effects.",
              "Treat the plotted line as a transcript-relative trend rather than a direct count table.",
              "When multiple files are present, use the tooltip and legend context to verify which sample each profile belongs to."
            ]
          }
        ]
      },
      {
        title: "Exports and outputs",
        paragraphs: [
          "The chart can be exported as a figure for presentations or manuscripts. The same export panel also supports normalized table export, which is the preferred route when you want to re-plot the data elsewhere or archive the exact values behind the current view.",
          "For table output, CSV uses comma-separated fields and TXT uses tab-separated fields. These exports intentionally contain data rather than narrative summary text."
        ]
      }
    ]
  },
  {
    id: "help-peak-distribution",
    title: "Peak Distribution",
    summary:
      "Annotate peaks against transcript-related genomic features and compare how the current upload session distributes across promoter, UTR, CDS, intronic, and intergenic regions.",
    sections: [
      {
        title: "What Peak Distribution answers",
        paragraphs: [
          "Peak Distribution is the feature-level annotation view. It asks where the uploaded BED intervals fall relative to gene architecture, allowing you to summarize the fraction or frequency of peaks associated with major transcript features.",
          "This module is especially useful for comparing broad functional context across samples before diving into more targeted analyses."
        ]
      },
      {
        title: "Display settings and feature selection",
        paragraphs: [
          "The control panel exposes the visible feature categories used in the current plot. This means the chart can focus on the subset of promoter, UTR, CDS, codon, intronic, or intergenic classes that matter most for the present comparison.",
          "If you hide or show features, the exported data follows the current rendered view rather than a hidden superset. This keeps the figure and the table aligned."
        ]
      },
      {
        title: "Reading the result",
        paragraphs: [
          "Use the summary values to understand the overall composition and the chart itself to compare categories across files. The module is best interpreted as an architectural annotation overview rather than a strict abundance test.",
          "When results appear surprising, first verify the species and annotation library in Project Configuration, because annotation mismatch can distort feature assignment."
        ]
      }
    ]
  },
  {
    id: "help-gene-statistics",
    title: "Gene Statistics",
    summary:
      "Use Gene Type, Peak Gene Size, and Gene Matrix to understand transcript classes, transcript-length-linked behavior, and shared gene overlap across multiple uploaded BED files.",
    sections: [
      {
        title: "Gene Type",
        paragraphs: [
          "Gene Type summarizes the transcript biotypes represented by the uploaded peak-associated genes. This helps answer whether the current peak set is concentrated in protein-coding transcripts, non-coding classes, or a more mixed biotype background.",
          "Use Gene Type early in interpretation when you want a quick biological profile of what kinds of transcripts dominate the dataset."
        ]
      },
      {
        title: "Peak Gene Size",
        paragraphs: [
          "Peak Gene Size links the uploaded peaks to transcript length distributions. The chart is useful when you want to know whether the analysis is dominated by shorter or longer transcript-associated genes, and whether groups differ in that structural tendency.",
          "Because the output is distribution-oriented, review both the visual spread and the summary values. Export the table data if you need to run independent statistical comparison outside the client."
        ]
      },
      {
        title: "Gene Matrix",
        paragraphs: [
          "Gene Matrix is the overlap-focused module for 2 to 5 uploaded files. It compares which genes are shared or unique across samples and renders that relationship as a matrix-style chart.",
          "This module is useful when you need a quick answer to sample concordance questions such as whether replicate-like files overlap strongly, or whether treatment groups separate into distinct gene sets."
        ],
        lists: [
          {
            label: "When to prefer Gene Matrix",
            items: [
              "Use it after Upload / Run when you have multiple BED files in the same session.",
              "Use it before detailed exon or site-level analysis if your main question is sample overlap.",
              "Export the table when you need a downstream list-oriented comparison outside the client."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "help-exon-statistics",
    title: "Exon Statistics",
    summary:
      "Use the exon-oriented modules to examine exon length behavior, exon positional composition, and transcript exon-count patterns for the genes associated with the current BED session.",
    sections: [
      {
        title: "Peak Exon Size",
        paragraphs: [
          "Peak Exon Size summarizes exon-length distributions and keeps the distinction between first, middle, and last exon classes. This module is useful when you suspect that peak-associated transcripts are biased toward particular exon-length regimes.",
          "Because exon position classes can behave differently, interpret the categories separately before collapsing them into a single biological story."
        ]
      },
      {
        title: "Peak Exon Type",
        paragraphs: [
          "Peak Exon Type focuses on exon-position composition. Instead of emphasizing length, it tells you whether the uploaded peaks are more often associated with first, middle, or last exon overlaps.",
          "This is often the fastest exon-oriented module to read because the output is compositional. It works well as a high-level exon context summary."
        ]
      },
      {
        title: "Peak Exon Num",
        paragraphs: [
          "Peak Exon Num summarizes the exon-count distribution of transcripts connected to the uploaded peaks. This can reveal whether the signal is associated with simpler or more exon-rich transcript structures.",
          "Use the module together with Peak Exon Size when you want a more structural view of the peak-associated transcript population."
        ]
      }
    ]
  },
  {
    id: "help-site",
    title: "Site",
    summary:
      "Profile local signal around biologically meaningful boundaries with the Transcription, Translation, and Splicesite site-centered modules.",
    sections: [
      {
        title: "Transcription",
        paragraphs: [
          "Transcription profiles peak density around transcription-related boundaries, typically around transcript start and end neighborhoods. This module is appropriate when your question is whether signal accumulates near transcript boundary landmarks rather than across the whole normalized transcript body.",
          "The desktop client also supports the matching heatmap view tied to the currently selected sample, so you can inspect both a summarized density pattern and a more sample-focused local structure view."
        ]
      },
      {
        title: "Translation",
        paragraphs: [
          "Translation shifts the focus to translation start and end boundaries. Use it when the biological interpretation depends on coding-sequence entry or exit neighborhoods rather than transcription-level boundaries.",
          "As with the other site modules, the summary values, density chart, and heatmap should be interpreted together rather than in isolation."
        ]
      },
      {
        title: "Splicesite",
        paragraphs: [
          "Splicesite measures signal around splice-site neighborhoods, including 5' and 3' splice-related regions. This is the most targeted module in the Site group and is useful when your question is about local enrichment near exon-intron junction logic.",
          "If the shape or heatmap looks unexpected, first verify that the uploaded samples, species, and annotation bundle all correspond to the same biological reference frame."
        ],
        lists: [
          {
            label: "Site module workflow notes",
            items: [
              "The current heatmap export follows the active sample selection.",
              "Density and heatmap outputs belong to the same underlying analysis run and should be interpreted as complementary views.",
              "Site modules are often most informative after the global context has already been checked with Meta Plot or Peak Distribution."
            ]
          }
        ]
      }
    ]
  }
];
