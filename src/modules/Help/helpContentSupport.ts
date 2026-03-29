import type { HelpPage } from "./helpTypes";

export const helpContentSupport: HelpPage[] = [
  {
    id: "help-export-cache",
    title: "Export & Cache",
    summary:
      "Understand how figure export, table export, session cache, console control, and local desktop runtime behavior work in the current RNAmeta Desktop build.",
    sections: [
      {
        title: "Figure export",
        paragraphs: [
          "Each analysis module exposes an export panel inside the module workspace. Figure export is intended for chart-oriented outputs such as presentation figures, supplemental images, or PDF-ready graphics.",
          "Use figure export when the immediate goal is visual communication, manuscript assembly, slide preparation, or preserving the rendered chart exactly as seen in the desktop client."
        ]
      },
      {
        title: "Data export",
        paragraphs: [
          "The same export panel also supports data-oriented output. CSV files use commas, TXT files use tab separators, and both formats export the normalized table underlying the current chart instead of embedding narrative summary prose.",
          "This makes the exported tables suitable for external plotting, spreadsheet inspection, statistical follow-up, or archiving with clear machine-readable structure."
        ],
        lists: [
          {
            label: "Practical export guidance",
            items: [
              "Use PNG or PDF when the chart itself is the deliverable.",
              "Use CSV or TXT when you need the values behind the current view.",
              "If a module has sample or feature visibility controls, the exported table reflects the active rendered state."
            ]
          }
        ]
      },
      {
        title: "Session cache behavior",
        paragraphs: [
          "RNAmeta Desktop uses a session-scoped cache to speed up repeated analysis within the current application run. The cache is temporary and is stored in the local application cache area rather than the project directory.",
          "This cache is designed for workflow acceleration, not long-term result storage. It is cleaned with the application session lifecycle, so you should not treat it as a permanent output location."
        ],
        lists: [
          {
            label: "What the cache is good for",
            items: [
              "Repeated local analysis during one desktop session",
              "Reusing work when the same input files are uploaded again in the same session",
              "Reducing unnecessary reruns while tuning parameters"
            ]
          }
        ]
      },
      {
        title: "Console and process control",
        paragraphs: [
          "The bottom console shows runtime logs and process state. When an analysis is actively running, the console exposes a terminate action that stops the current local process tree.",
          "If you terminate a run, the module can briefly show an Aborted state before the status clears automatically. This is normal and is meant to acknowledge the interruption without leaving a permanent stale error on the page."
        ]
      }
    ]
  },
  {
    id: "help-faq",
    title: "FAQ / Troubleshooting",
    summary:
      "Use this page to resolve the most common local workflow issues, including setup mismatch, stale expectations after file changes, cache assumptions, and platform-scope confusion between desktop and web.",
    sections: [
      {
        title: "The module shows old-looking results after I changed something",
        paragraphs: [
          "If you re-upload BED files, the client clears the previous module results. If you change species or annotation directory, it also invalidates old analysis results. This behavior is intentional and protects you from reading charts tied to the wrong biological context.",
          "If a page still looks inconsistent, rerun the module after checking Project Configuration and Upload / Run."
        ]
      },
      {
        title: "The annotation directory is not accepted",
        paragraphs: [
          "A directory is only considered valid when the selected species can be matched to the expected annotation resources. If validation fails, confirm that the species selection is correct and that the directory contains the required files for that specific species entry.",
          "Do not continue into interpretation if the setup panel still reports missing items."
        ]
      },
      {
        title: "I cannot find a website feature inside the desktop app",
        paragraphs: [
          "The desktop app and the website share the RNAmeta project identity, but they do not expose exactly the same screens. The website is a valid project reference at https://rnainformatics.cn/RNAmeta/, yet some workflows shown there may not exist in the current local desktop build.",
          "In particular, if you are looking for Motif job submission, treat that as a web-platform workflow rather than a currently available desktop page."
        ]
      },
      {
        title: "The app feels faster on repeated runs, but where are those files",
        paragraphs: [
          "Repeated local analysis can benefit from session cache, but the cache is not meant to be browsed as a stable project output folder. It lives under the application cache directory and is cleaned with session lifecycle events.",
          "For permanent outputs, use the export panel and save the figures or normalized tables to a location you control."
        ]
      },
      {
        title: "Where should I go for broader project context",
        paragraphs: [
          "Use this desktop Help group for client-specific operational guidance. Use the public project site at https://rnainformatics.cn/RNAmeta/ when you want the broader RNAmeta presentation, external project framing, or a web-based reference point.",
          "When there is any conflict between a desktop interaction you can see and older descriptive wording elsewhere, follow the current desktop behavior."
        ]
      }
    ]
  }
];
