import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, resolveResource } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/plugin-shell";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileArchive,
  FolderOpen,
  Play,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useLogStore } from "@/store/useLogStore";
import { useRAnalysis } from "@/hooks/useRAnalysis";

type SeqMode = "SE" | "PE";
type PhredType = "33" | "64";

const SE_ADAPTERS = ["TruSeq3-SE.fa", "TruSeq2-SE.fa"];
const PE_ADAPTERS = [
  "TruSeq3-PE.fa",
  "TruSeq2-PE.fa",
  "NexteraPE-PE.fa",
  "TruSeq3-PE-2.fa",
  "TruSeq3-PE-2-GGGGG.fa",
];

const joinPathPreview = (dir: string, file: string) => {
  if (!dir) return file;
  const withSep = dir.endsWith("\\") || dir.endsWith("/") ? dir : `${dir}\\`;
  return `${withSep}${file}`;
};

const derivePrefix = (path: string) => {
  const file = path.split(/[\\/]/).pop() || "trimmomatic";
  const noExt = file.replace(/(\.fastq|\.fq)(\.gz)?$/i, "");
  return noExt || "trimmomatic";
};

const FASTQ_COUNT_R = [
  "args<-commandArgs(TRUE)",
  "p<-args[1]",
  "con<-if(grepl('\\\\.gz$',p,ignore.case=TRUE)) gzfile(p,'rt') else file(p,'rt')",
  "on.exit(close(con))",
  "n<-0L",
  "repeat{",
  "  x<-readLines(con,n=200000L,warn=FALSE)",
  "  if(length(x)==0L) break",
  "  n<-n+length(x)",
  "}",
  "cat(as.integer(n/4L))",
].join(";");

const TRIMLOG_COUNT_R = [
  "args<-commandArgs(TRUE)",
  "p<-args[1]",
  "if(!file.exists(p)){cat(0L); quit(save='no',status=0)}",
  "con<-file(p,'rt')",
  "on.exit(close(con))",
  "n<-0L",
  "repeat{",
  "  x<-readLines(con,n=200000L,warn=FALSE)",
  "  if(length(x)==0L) break",
  "  n<-n+length(x)",
  "}",
  "cat(as.integer(n))",
].join(";");

const runRCount = async (scriptExpr: string, targetPath: string): Promise<number> => {
  const command = Command.create("r-engine", ["-e", scriptExpr, targetPath], {
    encoding: "utf-8",
  });

  return new Promise<number>(async (resolve, reject) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";

    command.stdout.on("data", (line) => {
      stdoutBuffer += `${line}\n`;
    });

    command.stderr.on("data", (line) => {
      stderrBuffer += `${line}\n`;
    });

    command.on("error", (err) => {
      reject(new Error(`R counter process error: ${String(err)}`));
    });

    command.on("close", ({ code }) => {
      if (code !== 0) {
        reject(
          new Error(
            stderrBuffer.trim() || `R counter command failed with exit code ${String(code)}`
          )
        );
        return;
      }

      const parsed = Number(stdoutBuffer.trim().split(/\s+/).pop());
      if (!Number.isFinite(parsed) || parsed < 0) {
        reject(new Error(`Failed to parse count from output: ${stdoutBuffer.trim()}`));
        return;
      }
      resolve(Math.floor(parsed));
    });

    try {
      await command.spawn();
    } catch (spawnError) {
      reject(new Error(`R counter spawn failed: ${String(spawnError)}`));
    }
  });
};

export const ToolsModule: React.FC = () => {
  const { setExpanded, addLog } = useLogStore();
  const { runShellCommand, isRunning } = useRAnalysis();

  const [seqMode, setSeqMode] = useState<SeqMode>("SE");
  const [phredType, setPhredType] = useState<PhredType>("33");

  const [inputSE, setInputSE] = useState("");
  const [inputR1, setInputR1] = useState("");
  const [inputR2, setInputR2] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [outputPrefix, setOutputPrefix] = useState("trimmomatic");

  const [adapterSE, setAdapterSE] = useState(SE_ADAPTERS[0]);
  const [adapterPE, setAdapterPE] = useState(PE_ADAPTERS[0]);

  const defaultThreads = Math.max(Math.floor((navigator.hardwareConcurrency || 8) / 2), 1);
  const [threads, setThreads] = useState(defaultThreads);
  const [compressLevel, setCompressLevel] = useState(4);

  const [seedMismatches, setSeedMismatches] = useState(2);
  const [palindromeClip, setPalindromeClip] = useState(30);
  const [simpleClip, setSimpleClip] = useState(10);
  const [leadingQ, setLeadingQ] = useState(3);
  const [trailingQ, setTrailingQ] = useState(3);
  const [windowSize, setWindowSize] = useState(4);
  const [windowQuality, setWindowQuality] = useState(20);
  const [minLen, setMinLen] = useState(20);
  const [maxLen, setMaxLen] = useState(35);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [progressHint, setProgressHint] = useState("");

  const isReady =
    !!outputDir &&
    (seqMode === "SE" ? !!inputSE : !!inputR1 && !!inputR2) &&
    !!outputPrefix.trim();

  const outputPlan = useMemo(() => {
    const summary = joinPathPreview(outputDir, `${outputPrefix}.summary.txt`);
    const trimlog = joinPathPreview(outputDir, `${outputPrefix}.trimlog.txt`);

    if (seqMode === "SE") {
      return {
        summary,
        trimlog,
        outputs: [
          joinPathPreview(outputDir, `${outputPrefix}.trim.fastq.gz`),
        ],
      };
    }

    return {
      summary,
      trimlog,
      outputs: [
        joinPathPreview(outputDir, `${outputPrefix}_R1.paired.fastq.gz`),
        joinPathPreview(outputDir, `${outputPrefix}_R1.unpaired.fastq.gz`),
        joinPathPreview(outputDir, `${outputPrefix}_R2.paired.fastq.gz`),
        joinPathPreview(outputDir, `${outputPrefix}_R2.unpaired.fastq.gz`),
      ],
    };
  }, [outputDir, outputPrefix, seqMode]);

  const pickFastq = async (setter: (path: string) => void) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "FASTQ", extensions: ["fastq", "fq", "gz"] }],
    });
    if (selected && typeof selected === "string") {
      setter(selected);
      if (outputPrefix === "trimmomatic") {
        setOutputPrefix(derivePrefix(selected));
      }
    }
  };

  const pickDirectory = async (setter: (path: string) => void) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") setter(selected);
  };

  const handleRun = async () => {
    if (!isReady) return;
    setExpanded(true);
    addLog("command", "[Tools] Starting Trimmomatic workflow...");
    addLog("info", "[Tools] Initializing task context...");
    setProgressPct(0);
    setProgressHint("Preparing...");

    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let isPolling = false;
    let lastProgressLog = -10;
    let runCompleted = false;

    try {
      addLog("info", "[Tools] Resolving bundled resources...");
      const jarPath = await resolveResource("resources/Trimmomatic/trimmomatic-0.40.jar");
      const hasJar = await exists(jarPath);
      if (!hasJar) {
        throw new Error(`Trimmomatic jar not found: ${jarPath}`);
      }
      addLog("info", `[Tools] Trimmomatic jar ready: ${jarPath}`);

      const summaryPath = await join(outputDir, `${outputPrefix}.summary.txt`);
      const trimlogPath = await join(outputDir, `${outputPrefix}.trimlog.txt`);
      const progressInputPath = seqMode === "SE" ? inputSE : inputR1;

      // Avoid stale counters from previous runs.
      addLog("info", "[Tools] Preparing output logs...");
      if (await exists(summaryPath)) {
        await writeTextFile(summaryPath, "");
      }
      if (await exists(trimlogPath)) {
        await writeTextFile(trimlogPath, "");
      }

      let totalReads = 0;
      try {
        addLog("info", "[Tools] Counting input reads for progress estimation...");
        setProgressHint("Counting input reads...");
        totalReads = await runRCount(FASTQ_COUNT_R, progressInputPath);
        if (totalReads > 0) {
          setProgressPct(0);
          setProgressHint(`0% (0/${totalReads.toLocaleString()} reads)`);
          addLog("info", `[Tools] Progress: 0% (0/${totalReads.toLocaleString()} reads)`);
        }
      } catch (countError) {
        totalReads = 0;
        setProgressPct(null);
        setProgressHint("Running (progress unavailable)");
        addLog("info", `[Tools] Read counting skipped: ${String(countError)}`);
      }

      const qualityFlag = phredType === "33" ? "-phred33" : "-phred64";
      const adapter = seqMode === "SE" ? adapterSE : adapterPE;
      const trimmers: string[] = [
        `ILLUMINACLIP:${adapter}:${seedMismatches}:${palindromeClip}:${simpleClip}`,
        `LEADING:${leadingQ}`,
        `TRAILING:${trailingQ}`,
        `SLIDINGWINDOW:${windowSize}:${windowQuality}`,
        `MINLEN:${minLen}`,
      ];
      if (maxLen > 0) {
        trimmers.push(`MAXLEN:${maxLen}`);
      }

      const args: string[] = [
        "-Dfile.encoding=UTF-8",
        "-Dsun.jnu.encoding=UTF-8",
        "-jar",
        jarPath,
        seqMode,
        "-threads",
        String(Math.max(1, threads)),
        "-compressLevel",
        String(Math.min(9, Math.max(1, compressLevel))),
        qualityFlag,
        "-summary",
        summaryPath,
        "-trimlog",
        trimlogPath,
      ];

      if (seqMode === "SE") {
        const outSE = await join(outputDir, `${outputPrefix}.trim.fastq.gz`);
        args.push(inputSE, outSE, ...trimmers);
      } else {
        const outR1P = await join(outputDir, `${outputPrefix}_R1.paired.fastq.gz`);
        const outR1U = await join(outputDir, `${outputPrefix}_R1.unpaired.fastq.gz`);
        const outR2P = await join(outputDir, `${outputPrefix}_R2.paired.fastq.gz`);
        const outR2U = await join(outputDir, `${outputPrefix}_R2.unpaired.fastq.gz`);
        args.push(inputR1, inputR2, outR1P, outR1U, outR2P, outR2U, ...trimmers);
      }

      addLog("command", `[Tools] Trimmomatic mode=${seqMode}, threads=${threads}, compress=${compressLevel}`);
      if (totalReads > 0) {
        progressTimer = setInterval(async () => {
          if (runCompleted) return;
          if (isPolling) return;
          isPolling = true;
          try {
            const processedReads = await runRCount(TRIMLOG_COUNT_R, trimlogPath);
            if (runCompleted) return;
            const effectiveProcessed = Math.min(totalReads, Math.max(0, processedReads));
            const pct = Math.min(99, Math.floor((effectiveProcessed * 100) / totalReads));
            setProgressPct((prev) => {
              if (prev === null) return pct;
              return pct > prev ? pct : prev;
            });
            setProgressHint(
              `${pct}% (${effectiveProcessed.toLocaleString()}/${totalReads.toLocaleString()} reads)`
            );
            if (pct >= lastProgressLog + 10) {
              lastProgressLog = pct - (pct % 10);
              addLog(
                "info",
                `[Tools] Progress: ${pct}% (${effectiveProcessed.toLocaleString()}/${totalReads.toLocaleString()} reads)`
              );
            }
          } catch {
            // Ignore transient progress polling failures while file is being written.
          } finally {
            isPolling = false;
          }
        }, 2000);
      }

      await runShellCommand("java-engine", args, {
        label: "Trimmomatic",
        onStderr: (line) => {
          const normalized = line.trim().toLowerCase();
          if (!normalized) return;
          if (normalized.includes("queue for log")) return;

          if (normalized.includes("error") || normalized.includes("failed")) {
            addLog("error", `[Trimmomatic-Stderr]: ${line}`);
            return;
          }
          addLog("info", `[Trimmomatic-Stderr]: ${line}`);
        },
      });

      runCompleted = true;
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      lastProgressLog = 100;
      setProgressPct(100);
      setProgressHint("100% Completed");
      addLog("info", "[Tools] Progress: 100% Completed");
      addLog("success", "[Tools] Trimmomatic completed successfully.");
      addLog("info", `[Tools] summary saved: ${summaryPath}`);
      addLog("info", `[Tools] trimlog saved: ${trimlogPath}`);
    } catch (error: any) {
      runCompleted = true;
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      setProgressPct(null);
      setProgressHint("");
      if (error.message === "Aborted") {
        addLog("command", "[Tools] Trimmomatic aborted by user.");
      } else {
        addLog("error", `[Tools] Trimmomatic failed: ${error.message || error}`);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full space-y-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">
          Tools / Trimmomatic
        </h1>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
          <ChevronRight size={12} className="text-emerald-500" />
          Standalone FASTQ preprocessing module with configurable trimming policy.
        </p>
      </div>

      <Card
        icon={<Settings2 size={18} />}
        title="Read Mode"
        desc="Select sequencing layout before choosing inputs."
      >
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => setSeqMode("SE")}
            className={`px-4 py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition-all ${
              seqMode === "SE"
                ? "border-emerald-600 bg-emerald-600/10 text-emerald-700"
                : "border-app-border text-slate-500 hover:border-emerald-300"
            }`}
          >
            Single-End (SE)
          </button>
          <button
            onClick={() => setSeqMode("PE")}
            className={`px-4 py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition-all ${
              seqMode === "PE"
                ? "border-emerald-600 bg-emerald-600/10 text-emerald-700"
                : "border-app-border text-slate-500 hover:border-emerald-300"
            }`}
          >
            Paired-End (PE)
          </button>
        </div>
      </Card>

      <Card
        icon={<FolderOpen size={18} />}
        title="Input / Output"
        desc="Pick FASTQ files and output directory."
      >
        {seqMode === "SE" ? (
          <PathInput
            value={inputSE}
            placeholder="Select input FASTQ(.gz)..."
            onSelect={() => pickFastq(setInputSE)}
          />
        ) : (
          <div className="space-y-3">
            <PathInput
              value={inputR1}
              placeholder="Select R1 FASTQ(.gz)..."
              onSelect={() => pickFastq(setInputR1)}
            />
            <PathInput
              value={inputR2}
              placeholder="Select R2 FASTQ(.gz)..."
              onSelect={() => pickFastq(setInputR2)}
            />
          </div>
        )}

        <div className="mt-3">
          <PathInput
            value={outputDir}
            placeholder="Select output directory..."
            onSelect={() => pickDirectory(setOutputDir)}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledNumberInput
            label="Threads"
            value={threads}
            min={1}
            max={64}
            onChange={(v) => setThreads(v)}
          />
          <LabeledNumberInput
            label="Compress Level"
            value={compressLevel}
            min={1}
            max={9}
            onChange={(v) => setCompressLevel(v)}
          />
        </div>

        <div className="mt-3">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            Output Prefix
          </label>
          <input
            value={outputPrefix}
            onChange={(e) => setOutputPrefix(e.target.value)}
            className="mt-2 w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500"
          />
        </div>
      </Card>

      <Card
        icon={<Cpu size={18} />}
        title="Trim Parameters"
        desc="Customize Trimmomatic arguments."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <LabeledNumberInput label="Seed Mismatch" value={seedMismatches} min={0} max={10} onChange={setSeedMismatches} />
          <LabeledNumberInput label="Palindrome Clip" value={palindromeClip} min={1} max={100} onChange={setPalindromeClip} />
          <LabeledNumberInput label="Simple Clip" value={simpleClip} min={1} max={100} onChange={setSimpleClip} />
          <SelectBox
            label="Phred"
            value={phredType}
            options={[
              { label: "Phred33", value: "33" },
              { label: "Phred64", value: "64" },
            ]}
            onChange={(v) => setPhredType(v as PhredType)}
          />
          <LabeledNumberInput label="Leading Q" value={leadingQ} min={0} max={40} onChange={setLeadingQ} />
          <LabeledNumberInput label="Trailing Q" value={trailingQ} min={0} max={40} onChange={setTrailingQ} />
          <LabeledNumberInput label="Window Size" value={windowSize} min={1} max={20} onChange={setWindowSize} />
          <LabeledNumberInput label="Window Q" value={windowQuality} min={0} max={40} onChange={setWindowQuality} />
          <LabeledNumberInput label="Min Length" value={minLen} min={1} max={1000} onChange={setMinLen} />
          <LabeledNumberInput label="Max Length" value={maxLen} min={0} max={1000} onChange={setMaxLen} />
          <SelectBox
            label="Adapter"
            value={seqMode === "SE" ? adapterSE : adapterPE}
            options={(seqMode === "SE" ? SE_ADAPTERS : PE_ADAPTERS).map((x) => ({ label: x, value: x }))}
            onChange={(v) => {
              if (seqMode === "SE") setAdapterSE(v);
              else setAdapterPE(v);
            }}
          />
        </div>
      </Card>

      <Card
        icon={<FileArchive size={18} />}
        title="Outputs"
        desc="The module writes output FASTQ, summary, and trimlog files."
      >
        <div className="space-y-1 text-[11px] font-mono text-slate-600">
          {outputPlan.outputs.map((path) => (
            <div key={path}>out: {path}</div>
          ))}
          <div>summary: {outputPlan.summary}</div>
          <div>trimlog: {outputPlan.trimlog}</div>
        </div>
      </Card>

      <div
        className={`w-full p-1.5 pl-6 rounded-2xl border-2 transition-all duration-500 flex items-center justify-between ${
          isReady
            ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5"
            : "bg-stone-50 border-slate-200"
        }`}
      >
        <div className="flex flex-col gap-2 py-3 min-w-[420px]">
          <div className="flex items-center gap-3">
            {isReady ? (
              <>
                <div className="p-1 bg-emerald-500 rounded-full text-white">
                  <CheckCircle2 size={12} />
                </div>
                <span className="text-sm font-bold text-emerald-600 tracking-tight">
                  Tool Status: Ready to Execute
                </span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-sm font-bold text-amber-600">
                  Tool Status: {outputDir ? "Awaiting FASTQ input" : "Awaiting output directory"}
                </span>
              </div>
            )}
          </div>

          {(isRunning || progressPct !== null) && (
            <div className="w-full max-w-xl">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1">
                <span>Progress</span>
                <span>{progressPct === null ? "..." : `${progressPct}%`}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPct === null ? 15 : progressPct}%` }}
                />
              </div>
              {progressHint && (
                <div className="mt-1 text-[10px] text-slate-500">{progressHint}</div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleRun}
          disabled={!isReady || isRunning}
          className={`group h-12 flex items-center gap-3 px-8 rounded-xl font-bold text-xs uppercase tracking-[0.15em] transition-all duration-300 ${
            isReady && !isRunning
              ? "bg-emerald-600 text-white cursor-pointer shadow-lg shadow-emerald-600/20"
              : "bg-transparent text-slate-300 cursor-not-allowed border border-dashed border-slate-200"
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw size={12} className="animate-spin" /> Running
            </>
          ) : (
            <>
              <Play size={12} /> Execute Trimmomatic
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

const Card = ({ icon, title, desc, children }: any) => (
  <div className="bg-app-card border-2 border-app-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-2.5 bg-stone-100 text-ribo-primary rounded-xl">{icon}</div>
      <div>
        <h3 className="text-lg font-bold text-app-text tracking-tight leading-none">{title}</h3>
        <p className="text-xs text-slate-400 mt-1.5">{desc}</p>
      </div>
    </div>
    {children}
  </div>
);

const PathInput = ({ value, placeholder, onSelect }: any) => (
  <div className="flex gap-3 mt-2">
    <div className="flex-1 bg-[var(--app-input-bg)] border-2 border-app-border rounded-xl px-4 py-2 text-xs font-mono text-app-text flex items-center min-h-[42px] overflow-hidden group">
      {value ? (
        <span className="truncate w-full font-bold text-ribo-primary" title={value}>
          {value}
        </span>
      ) : (
        <span className="text-app-placeholder italic">{placeholder}</span>
      )}
    </div>
    <button
      onClick={onSelect}
      className="px-5 py-2 border-2 border-app-border rounded-xl text-xs font-bold hover:bg-ribo-primary hover:text-white transition-all cursor-pointer bg-app-card text-app-text active:scale-95"
    >
      Browse
    </button>
  </div>
);

const LabeledNumberInput = ({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) => (
  <div>
    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
      {label}
    </label>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      className="mt-2 w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500"
    />
  </div>
);

const SelectBox = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (v: string) => void;
}) => (
  <div>
    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 w-full bg-app-input border-2 border-app-border rounded-xl px-3 py-2.5 text-xs focus:border-emerald-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);
