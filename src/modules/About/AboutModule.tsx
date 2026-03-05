import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FolderTree,
  Heart,
  HelpCircle,
  Layers,
  LineChart,
  Microscope,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

const GITHUB_URL = "https://github.com/Rwtkc/RiboMeta";

const WORKFLOW = [
  {
    module: "Project Configuration",
    purpose:
      "Define species, alignment input, reference library, and output location before any downstream analysis.",
  },
  {
    module: "P-site Calibration",
    purpose:
      "Estimate read-length-specific offsets and generate calibrated positioning rules for ribosome footprints.",
  },
  {
    module: "Quality Control",
    purpose:
      "Assess frame periodicity, metagene behavior, and occupancy summaries to validate library quality.",
  },
  {
    module: "Codon",
    purpose:
      "Profile codon-level occupancy across ribosomal sites and inspect codon-resolved meta-profiles.",
  },
  {
    module: "MetaView",
    purpose:
      "Browse transcript coverage tables and render transcript-specific coverage trajectories.",
  },
  {
    module: "ORF Pause",
    purpose:
      "Evaluate translated ORF candidates and detect high-confidence pause events with transcript tracks.",
  },
];

const REQUIRED_INPUTS = [
  "Aligned RPF BAM file with matching BAI index.",
  "Species reference library containing <species>.txlens.rda and <species>.txdb.fa.",
  "Offset configuration (offsets.conf.txt), from either library or output directory.",
  "ORF candidate catalog for ORF Pause (<species>.candidateORF3.txt).",
  "coverage_mRNA.csv is used by multiple modules and can be generated when prerequisites are complete.",
];

const OUTPUTS = [
  {
    module: "P-site",
    files: "saturation.gene.txt, psite.txt, psite_stopcodon.txt, offsets.conf.txt",
  },
  {
    module: "Quality Control",
    files:
      "frameStat.txt, frameStatByLength.txt, psite_metaprofile.txt, occupancy_metagene_bin.txt, occupancy_metagene_start.txt, occupancy_metagene_end.txt, coverage_mRNA.csv",
  },
  {
    module: "Codon",
    files: "usage.txt, codon_occupancy.txt",
  },
  {
    module: "MetaView",
    files: "Interactive table/chart loading from coverage_mRNA.csv",
  },
  {
    module: "ORF Pause",
    files: "all.input.parameters.txt, orfcall.parameters.txt, pause.txt",
  },
];

const INTERPRETATION_NOTES = [
  {
    metric: "ORFscore",
    note: "Higher values generally indicate stronger frame-biased translation evidence.",
  },
  {
    metric: "-log10(pvalue)",
    note: "Larger values correspond to stronger statistical support (smaller p-values).",
  },
  {
    metric: "Pause ratio",
    note: "Represents local enrichment relative to neighborhood background; ratio > 10 marks strong pause candidates.",
  },
];

const FAQ = [
  {
    q: "Why can ORFs be detected while no pause sites are shown?",
    a: "ORF detection and pause detection apply different criteria. An ORF can pass translation evidence thresholds without any position crossing the pause ratio cutoff.",
  },
  {
    q: "What does 'No pause sites with ratio > 10 in current window' mean?",
    a: "No coordinates in the current zoom range satisfy the pause threshold. Reset zoom or inspect another transcript.",
  },
  {
    q: "Why are results cleared after changing species or output settings?",
    a: "Result views are reset when core analysis context changes, preventing interpretation of mismatched historical outputs.",
  },
  {
    q: "What should be checked first when the environment is not ready?",
    a: "Verify BAM/BAI pairing, species annotation files, offset configuration, and output write permissions.",
  },
];

const EXPORT_NOTES = [
  "Figure export supports PNG and PDF.",
  "Batch export packages multiple selected views into ZIP.",
  "Width, height, and DPI settings help standardize publication-ready output.",
];

const handleOpenLink = async (url: string) => {
  try {
    await open(url);
  } catch (error) {
    console.error("Failed to open external link:", error);
  }
};

export const AboutModule: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-10 pb-24"
    >
      <section className="text-center py-8">
        <div className="inline-flex p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 mb-2">
          <Activity size={42} className="text-ribo-primary" />
        </div>
        <h1 className="text-4xl font-bold text-app-text tracking-tight font-serif italic">
          About & Help
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Scientific user guide for complete RiboMeta analysis workflows
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
          <ShieldCheck size={12} />
          Academic research workflow
        </div>
      </section>

      <section className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
        <SectionHeader icon={<Cpu size={15} />} title="Platform Scope" />
        <p className="text-sm text-slate-700 leading-relaxed">
          RiboMeta is an integrated environment for ribosome profiling interpretation, from
          calibration and quality assessment to codon behavior, transcript coverage review, and ORF
          pause evidence exploration.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <Tag icon={<Microscope size={12} />} text="Designed for translational profiling studies" />
          <Tag icon={<Layers size={12} />} text="Module-driven workflow with coherent data flow" />
          <Tag icon={<LineChart size={12} />} text="Interactive visual analytics for biological interpretation" />
        </div>
      </section>

      <section className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-5">
        <SectionHeader icon={<PlayCircle size={15} />} title="Recommended Workflow" />
        <div className="space-y-3">
          {WORKFLOW.map((item, idx) => (
            <div key={item.module} className="rounded-xl border border-app-border bg-slate-50/70 px-4 py-3">
              <div className="text-xs font-bold text-slate-700">
                {idx + 1}. {item.module}
              </div>
              <div className="text-xs text-slate-600 mt-1 leading-relaxed">{item.purpose}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <SectionHeader icon={<FolderTree size={15} />} title="Required Inputs" />
          <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
            {REQUIRED_INPUTS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={12} className="mt-0.5 text-emerald-600 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <SectionHeader icon={<Database size={15} />} title="Output Map" />
          <div className="space-y-2">
            {OUTPUTS.map((item) => (
              <div key={item.module} className="rounded-lg border border-app-border px-3 py-2 bg-slate-50/60">
                <div className="text-xs font-semibold text-slate-700">{item.module}</div>
                <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.files}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <SectionHeader icon={<HelpCircle size={15} />} title="Interpretation Guide" />
          <div className="space-y-2">
            {INTERPRETATION_NOTES.map((item) => (
              <div key={item.metric} className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold text-slate-700">{item.metric}</div>
                <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <SectionHeader icon={<Download size={15} />} title="Export Notes" />
          <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
            {EXPORT_NOTES.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <BookOpen size={12} className="mt-0.5 text-emerald-600 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
        <SectionHeader icon={<HelpCircle size={15} />} title="FAQ" />
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="rounded-xl border border-app-border px-4 py-3 bg-slate-50/70 open:border-emerald-200"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                {item.q}
              </summary>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3">
        <SectionHeader icon={<AlertTriangle size={15} />} title="Research Use Notice" />
        <p className="text-xs text-amber-900 leading-relaxed">
          This software is intended for research analysis and hypothesis generation. Key biological
          findings should be validated with replicate evidence, annotation consistency, and
          independent confirmation.
        </p>
      </section>

      <footer className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-app-border px-1">
        <button
          onClick={() => handleOpenLink(GITHUB_URL)}
          className="inline-flex items-center gap-2 text-sm font-bold text-app-text hover:text-ribo-primary transition-colors"
        >
          <BookOpen size={16} />
          Source Repository
        </button>
        <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 italic">
          <Heart size={13} className="text-rose-400" fill="currentColor" />
          Professional software for translational biology workflows
        </div>
      </footer>
    </motion.div>
  );
};

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 text-slate-700">
    <span className="text-emerald-600">{icon}</span>
    <h2 className="text-sm font-black uppercase tracking-wider">{title}</h2>
  </div>
);

const Tag = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2 text-slate-600 flex items-start gap-2">
    <span className="text-emerald-600 mt-0.5">{icon}</span>
    <span>{text}</span>
  </div>
);
