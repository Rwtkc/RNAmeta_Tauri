import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Play,
  Search,
  Table,
} from "lucide-react";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { useConfigStore } from "@/store/useConfigStore";
import { useLogStore } from "@/store/useLogStore";
import { useRAnalysis } from "@/hooks/useRAnalysis";
import { useOrfPauseStore } from "@/store/useOrfPauseStore";

const PAGE_SIZE = 15;

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

const filterRows = (rows: string[][], query: string): string[][] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(normalized)));
};

const parseTsvTable = (text: string, filename: string): ParsedTable => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split("\t");
  if (headers.length === 0 || headers.every((h) => h.trim() === "")) {
    return { headers: [], rows: [] };
  }

  const rows = lines.slice(1).map((line, idx) => {
    const fields = line.split("\t");
    if (fields.length !== headers.length) {
      throw new Error(
        `[${filename}] Malformed row at line ${idx + 2}: expected ${headers.length} columns, got ${fields.length}.`
      );
    }
    return fields;
  });

  return { headers, rows };
};

const formatHeaderLabel = (header: string): string => {
  const exactHeaderMap: Record<string, string> = {
    orfscore: "ORFscore",
  };
  const tokenMap: Record<string, string> = {
    orf: "ORF",
    id: "ID",
    mrna: "mRNA",
  };
  const normalizedHeader = header.trim().toLowerCase();
  if (exactHeaderMap[normalizedHeader]) {
    return exactHeaderMap[normalizedHeader];
  }

  return header
    .split("_")
    .map((token) => {
      const normalized = token.trim();
      if (!normalized) return normalized;
      const mapped = tokenMap[normalized.toLowerCase()];
      if (mapped) return mapped;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
};

const formatPvalueCell = (
  header: string,
  rawValue: string
): {
  display: string;
  title?: string;
} => {
  if (header.trim().toLowerCase() !== "pvalue") {
    return { display: rawValue };
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return { display: rawValue };
  }

  if (value >= 1e-4) {
    return {
      display: value.toFixed(4),
      title: rawValue,
    };
  }

  return {
    display: value.toExponential(3),
    title: rawValue,
  };
};

export const OrfPauseModule: React.FC = () => {
  const {
    dbPath,
    outputPath,
    bamPath,
    species,
    isIndexFound,
    isOffsetsConfFound,
    isTxlensFound,
  } = useConfigStore();
  const { addLog, setExpanded } = useLogStore();
  const { runRScript, isRunning } = useRAnalysis();
  const {
    hasAnalyzed,
    error,
    notice,
    lastRunSignature,
    orfTable,
    pauseTable,
    setOrfPauseData,
    setTableData,
    resetResults,
  } = useOrfPauseStore();

  const [hasCoverageInOutput, setHasCoverageInOutput] = useState(false);
  const [hasCandidateOrf, setHasCandidateOrf] = useState(false);
  const [candidateOrfPath, setCandidateOrfPath] = useState("");
  const previousConfigSignature = useRef<string | null>(null);

  const configSignature = useMemo(
    () => `${dbPath}|${outputPath}|${bamPath}|${species}`,
    [dbPath, outputPath, bamPath, species]
  );

  const canGenerateCoverage = !!(
    outputPath &&
    dbPath &&
    species &&
    bamPath &&
    isIndexFound &&
    isOffsetsConfFound &&
    isTxlensFound
  );
  const canRunWithExistingCoverage = !!(outputPath && dbPath && species && hasCandidateOrf);
  const isProjectReady = hasCoverageInOutput
    ? canRunWithExistingCoverage
    : canGenerateCoverage && hasCandidateOrf;

  const filteredOrfRows = useMemo(
    () => filterRows(orfTable.rows, orfTable.searchQuery),
    [orfTable.rows, orfTable.searchQuery]
  );
  const filteredPauseRows = useMemo(
    () => filterRows(pauseTable.rows, pauseTable.searchQuery),
    [pauseTable.rows, pauseTable.searchQuery]
  );

  const orfTotalPages = Math.max(1, Math.ceil(filteredOrfRows.length / PAGE_SIZE));
  const pauseTotalPages = Math.max(1, Math.ceil(filteredPauseRows.length / PAGE_SIZE));

  const orfPageRows = filteredOrfRows.slice((orfTable.page - 1) * PAGE_SIZE, orfTable.page * PAGE_SIZE);
  const pausePageRows = filteredPauseRows.slice(
    (pauseTable.page - 1) * PAGE_SIZE,
    pauseTable.page * PAGE_SIZE
  );

  useEffect(() => {
    if (orfTable.page > orfTotalPages) setTableData("orf", { page: orfTotalPages });
  }, [orfTable.page, orfTotalPages, setTableData]);

  useEffect(() => {
    if (pauseTable.page > pauseTotalPages) setTableData("pause", { page: pauseTotalPages });
  }, [pauseTable.page, pauseTotalPages, setTableData]);

  useEffect(() => {
    if (!outputPath.trim()) {
      setHasCoverageInOutput(false);
      return;
    }

    let cancelled = false;
    const probeCoverage = async () => {
      try {
        const outputCoveragePath = await join(outputPath, "coverage_mRNA.csv");
        const found = await exists(outputCoveragePath);
        if (!cancelled) setHasCoverageInOutput(found);
      } catch {
        if (!cancelled) setHasCoverageInOutput(false);
      }
    };

    void probeCoverage();
    const timer = window.setInterval(() => void probeCoverage(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [outputPath]);

  useEffect(() => {
    if (!dbPath.trim() || !species.trim()) {
      setHasCandidateOrf(false);
      setCandidateOrfPath("");
      return;
    }

    let cancelled = false;
    const probeOrf = async () => {
      try {
        const path = await join(dbPath, `${species}.candidateORF3.txt`);
        const found = await exists(path);
        if (!cancelled) {
          setCandidateOrfPath(path);
          setHasCandidateOrf(found);
        }
      } catch {
        if (!cancelled) {
          setCandidateOrfPath("");
          setHasCandidateOrf(false);
        }
      }
    };

    void probeOrf();
    const timer = window.setInterval(() => void probeOrf(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dbPath, species]);

  useEffect(() => {
    if (previousConfigSignature.current === null) {
      previousConfigSignature.current = configSignature;
      return;
    }

    if (previousConfigSignature.current === configSignature) return;
    previousConfigSignature.current = configSignature;

    if (hasAnalyzed || orfTable.rows.length > 0 || pauseTable.rows.length > 0) {
      resetResults();
      setOrfPauseData({
        notice: "参数已变化，请重新执行 ORF Pause 分析。",
      });
      addLog("info", "[ORF Pause] Configuration changed. Results cleared.");
    }
  }, [
    configSignature,
    hasAnalyzed,
    orfTable.rows.length,
    pauseTable.rows.length,
    resetResults,
    setOrfPauseData,
    addLog,
  ]);

  const ensureCoverageCsvReady = async (): Promise<string> => {
    if (!outputPath.trim()) {
      throw new Error("Output directory is not configured.");
    }

    const outputCoveragePath = await join(outputPath, "coverage_mRNA.csv");
    if (await exists(outputCoveragePath)) {
      return outputCoveragePath;
    }

    if (!dbPath.trim()) {
      throw new Error("DB directory is required to generate coverage_mRNA.csv.");
    }

    const txlensPath = await join(dbPath, `${species}.txlens.rda`);
    const customOffsetsPath = await join(outputPath, "offsets.conf.txt");
    const defaultOffsetsPath = await join(dbPath, "offsets.conf.txt");
    const finalOffsetsPath = (await exists(customOffsetsPath)) ? customOffsetsPath : defaultOffsetsPath;
    const hasOffsets = await exists(finalOffsetsPath);

    if (!bamPath.trim() || !hasOffsets) {
      throw new Error("Missing coverage_mRNA.csv. Provide BAM and offsets.conf.txt to generate it.");
    }

    addLog("info", "[ORF Pause] coverage_mRNA.csv not found. Generating via ribo_coverage_mrna.R...");
    await runRScript("ribo_coverage_mrna", [
      "--coverage",
      outputCoveragePath,
      "--txlens",
      txlensPath,
      "--species",
      species,
      "--bam",
      bamPath,
      "--offsets",
      finalOffsetsPath,
    ]);

    if (!(await exists(outputCoveragePath))) {
      throw new Error("coverage_mRNA.csv generation failed.");
    }

    addLog("success", "[ORF Pause] coverage_mRNA.csv generated.");
    return outputCoveragePath;
  };

  const loadTableFromFile = async (filePath: string, filename: string): Promise<ParsedTable> => {
    if (!(await exists(filePath))) {
      throw new Error(`[ORF Pause] ${filename} was not generated.`);
    }
    const content = await readTextFile(filePath);
    return parseTsvTable(content, filename);
  };

  const handleExecuteAnalysis = async () => {
    if (!isProjectReady || isRunning) return;

    setExpanded(true);
    resetResults();
    setOrfPauseData({ error: "", notice: "" });

    try {
      if (!dbPath.trim()) throw new Error("DB directory is not configured.");
      if (!outputPath.trim()) throw new Error("Output directory is not configured.");

      const finalCoveragePath = await ensureCoverageCsvReady();
      const finalOrfPath = candidateOrfPath || (await join(dbPath, `${species}.candidateORF3.txt`));

      if (!(await exists(finalOrfPath))) {
        throw new Error(`Candidate ORF file not found: ${finalOrfPath}`);
      }

      addLog("info", "[ORF Pause] Executing R Script: ribo_orf_pause.R");
      await runRScript("ribo_orf_pause", [
        "--outdir",
        outputPath,
        "--species",
        species,
        "--coverage",
        finalCoveragePath,
        "--orf",
        finalOrfPath,
        "--half-window",
        "20",
      ]);

      const orfOutputPath = await join(outputPath, "orfcall.parameters.txt");
      const pauseOutputPath = await join(outputPath, "pause.txt");
      const [orfParsed, pauseParsed] = await Promise.all([
        loadTableFromFile(orfOutputPath, "orfcall.parameters.txt"),
        loadTableFromFile(pauseOutputPath, "pause.txt"),
      ]);

      setOrfPauseData({
        hasAnalyzed: true,
        error: "",
        notice: "",
        lastRunSignature: configSignature,
      });
      setTableData("orf", {
        headers: orfParsed.headers,
        rows: orfParsed.rows,
        searchInput: "",
        searchQuery: "",
        page: 1,
        jumpPageInput: "",
      });
      setTableData("pause", {
        headers: pauseParsed.headers,
        rows: pauseParsed.rows,
        searchInput: "",
        searchQuery: "",
        page: 1,
        jumpPageInput: "",
      });

      addLog("success", "[ORF Pause] Analysis complete.");
      setTimeout(() => {
        const { activeProcessCount, sessionHasError } = useLogStore.getState();
        if (activeProcessCount === 0 && !sessionHasError) setExpanded(false);
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const normalized = message.toLowerCase();
      const isAbortLike = normalized.includes("aborted") || normalized === "exit code 1";
      if (isAbortLike) {
        setOrfPauseData({ error: "", notice: "Aborted" });
        addLog("command", "[ORF Pause] Aborted.");
        setExpanded(false);
        window.setTimeout(() => setOrfPauseData({ notice: "" }), 2000);
        return;
      }
      setOrfPauseData({ error: message });
      addLog("error", `[ORF Pause] ${message}`);
    }
  };

  const handleSearch = (table: "orf" | "pause") => {
    const current = table === "orf" ? orfTable : pauseTable;
    setTableData(table, {
      searchQuery: current.searchInput.trim(),
      page: 1,
      jumpPageInput: "",
    });
  };

  const handleClearSearch = (table: "orf" | "pause") => {
    setTableData(table, {
      searchInput: "",
      searchQuery: "",
      page: 1,
      jumpPageInput: "",
    });
  };

  const handleJumpSubmit = (table: "orf" | "pause", totalPages: number, rawInput: string) => {
    const target = Number(rawInput);
    if (!Number.isFinite(target)) return;
    const bounded = Math.max(1, Math.min(totalPages, Math.trunc(target)));
    setTableData(table, { page: bounded, jumpPageInput: "" });
  };

  const isConfigChangedAfterRun = hasAnalyzed && lastRunSignature !== configSignature;

  return (
    <div className="w-full space-y-12 pb-24">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">ORF Pause</h1>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <ChevronRight size={12} className="text-emerald-500" />
            ORF calling and pause-site profiling from transcript coverage.
          </p>
        </div>
        <div className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl border border-app-border shadow-sm">
          <div className="flex flex-col items-start px-2 border-r border-app-border pr-5 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>Environment</span>
            <div className="mt-0.5">
              {isProjectReady ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Verified
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertCircle size={10} /> Pending
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              void handleExecuteAnalysis();
            }}
            disabled={!isProjectReady || isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${
              isProjectReady && !isRunning ? "bg-emerald-600 text-white shadow-lg" : "bg-slate-200 text-slate-400"
            }`}
          >
            {isRunning ? <LoaderCircle size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            Execute Analysis
          </button>
        </div>
      </header>

      <section className="bg-white border border-app-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Coverage status:</span>
            <span>{hasCoverageInOutput ? "coverage_mRNA.csv found in output directory." : "coverage_mRNA.csv will be generated if missing."}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Candidate ORF:</span>
            <span className={hasCandidateOrf ? "text-emerald-700" : "text-rose-600"}>
              {hasCandidateOrf ? candidateOrfPath : `${species}.candidateORF3.txt not found in DB directory.`}
            </span>
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {isConfigChangedAfterRun && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            <span>Configuration changed after last run. Re-run analysis to refresh results.</span>
          </div>
        )}
      </section>

      <ResultTableSection
        title="orfcall.parameters.txt"
        tableKey="orf"
        tableState={orfTable}
        totalPages={orfTotalPages}
        pageRows={orfPageRows}
        filteredRowsCount={filteredOrfRows.length}
        isBusy={isRunning}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onSetTableData={setTableData}
        onJumpSubmit={handleJumpSubmit}
      />

      <ResultTableSection
        title="pause.txt"
        tableKey="pause"
        tableState={pauseTable}
        totalPages={pauseTotalPages}
        pageRows={pausePageRows}
        filteredRowsCount={filteredPauseRows.length}
        isBusy={isRunning}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onSetTableData={setTableData}
        onJumpSubmit={handleJumpSubmit}
      />
    </div>
  );
};

interface ResultTableSectionProps {
  title: string;
  tableKey: "orf" | "pause";
  tableState: {
    headers: string[];
    rows: string[][];
    searchInput: string;
    searchQuery: string;
    page: number;
    jumpPageInput: string;
  };
  totalPages: number;
  pageRows: string[][];
  filteredRowsCount: number;
  isBusy: boolean;
  onSearch: (table: "orf" | "pause") => void;
  onClearSearch: (table: "orf" | "pause") => void;
  onSetTableData: (
    table: "orf" | "pause",
    data: Partial<{
      headers: string[];
      rows: string[][];
      searchInput: string;
      searchQuery: string;
      page: number;
      jumpPageInput: string;
    }>
  ) => void;
  onJumpSubmit: (table: "orf" | "pause", totalPages: number, rawInput: string) => void;
}

const ResultTableSection: React.FC<ResultTableSectionProps> = ({
  title,
  tableKey,
  tableState,
  totalPages,
  pageRows,
  filteredRowsCount,
  isBusy,
  onSearch,
  onClearSearch,
  onSetTableData,
  onJumpSubmit,
}) => {
  const orfIdColumnIndex =
    tableKey === "orf" ? tableState.headers.findIndex((header) => header.toLowerCase() === "orfid") : -1;
  const tableMinHeight = "calc(15 * 2rem + 3rem)";
  const tableViewportHeight = tableKey === "orf" ? "min(66vh, 46rem)" : "min(54vh, 38rem)";
  const shouldSplitOrfId = tableKey === "orf" && orfIdColumnIndex >= 0;
  const hiddenSplitDuplicateHeaders = new Set(["orf_type", "start_codon", "mrna", "transcript_id"]);
  const hiddenSplitDuplicateIndexes = shouldSplitOrfId
    ? new Set(
        tableState.headers
          .map((header, idx) => (hiddenSplitDuplicateHeaders.has(header.toLowerCase()) ? idx : -1))
          .filter((idx) => idx >= 0)
      )
    : new Set<number>();
  const remainingHeaders = shouldSplitOrfId
    ? tableState.headers.filter(
        (header, idx) => idx !== orfIdColumnIndex && !hiddenSplitDuplicateHeaders.has(header.toLowerCase())
      )
    : tableState.headers;
  const displayHeaders = shouldSplitOrfId
    ? [
        "orf_transcript",
        "orf_chr",
        "orf_strand",
        "orf_rank",
        "orf_region",
        "orf_type_id",
        "start_codon_id",
        ...remainingHeaders,
      ]
    : remainingHeaders;
  const displayRows = shouldSplitOrfId
    ? pageRows.map((row) => {
        const rawOrfId = row[orfIdColumnIndex] ?? "";
        const split = rawOrfId.split("|").map((item) => item.trim());
        const orfTranscriptRaw = split[0] ?? "";
        const transcriptParts = orfTranscriptRaw.split(":").map((item) => item.trim());
        const orfTranscript = transcriptParts[0] ?? "";
        const orfChr = transcriptParts[1] ?? "";
        const orfStrand =
          transcriptParts.length <= 2 ? transcriptParts[2] ?? "" : transcriptParts.slice(2).join(":");
        const orfRank = split[1] ?? "";
        const orfRegion = split[2] ?? "";
        const orfTypeId = split[3] ?? "";
        const startCodonId = split.length <= 4 ? split[4] ?? "" : split.slice(4).join("|");
        const remainingCells = row.filter(
          (_cell, idx) => idx !== orfIdColumnIndex && !hiddenSplitDuplicateIndexes.has(idx)
        );
        return [
          orfTranscript,
          orfChr,
          orfStrand,
          orfRank,
          orfRegion,
          orfTypeId,
          startCodonId,
          ...remainingCells,
        ];
      })
    : pageRows;

  return (
    <section className="bg-white border border-app-border rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
          <Table size={14} />
          {title}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] w-[320px] max-w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={tableState.searchInput}
              onChange={(e) => onSetTableData(tableKey, { searchInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch(tableKey);
              }}
              className="w-full bg-app-input border border-app-border rounded-lg pl-9 pr-3 py-2 text-xs"
              placeholder="Search all columns..."
            />
          </div>

          <button
            onClick={() => onSearch(tableKey)}
            disabled={isBusy || tableState.headers.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              isBusy || tableState.headers.length === 0
                ? "bg-slate-200 text-slate-500"
                : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            <Search size={14} />
            Search
          </button>

          {(tableState.searchInput || tableState.searchQuery) && (
            <button
              onClick={() => onClearSearch(tableKey)}
              disabled={isBusy}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-app-border text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className="relative overflow-auto border border-app-border rounded-lg"
        style={{
          minHeight: tableMinHeight,
          height: tableViewportHeight,
        }}
      >
        {tableState.headers.length === 0 ? (
          <div className="p-4 text-xs text-slate-400 italic">Run analysis to load {title}.</div>
        ) : (
          <table className="min-w-full text-xs text-center">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr>
                {displayHeaders.map((h) => (
                  <th
                    key={`${title}-${h}`}
                    className="px-3 py-2.5 border-b border-app-border whitespace-nowrap text-center font-semibold text-slate-700"
                  >
                    {formatHeaderLabel(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayHeaders.length || 1}
                    className="px-3 py-6 text-center text-slate-400 italic border-b border-app-border/70"
                  >
                    {filteredRowsCount === 0 ? "No rows available." : "No rows on this page."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row, rowIdx) => (
                  <tr
                    key={`${title}-${rowIdx}`}
                    className={rowIdx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 hover:bg-slate-100/70"}
                  >
                    {row.map((cell, colIdx) => {
                      const formattedCell = formatPvalueCell(displayHeaders[colIdx] ?? "", cell);
                      return (
                        <td
                          key={`${title}-${rowIdx}-${colIdx}`}
                          title={formattedCell.title}
                          className="px-3 py-2 border-b border-app-border/70 whitespace-nowrap text-slate-700 text-center align-middle"
                        >
                          {formattedCell.display}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {tableState.headers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500">
            Rows: <span className="font-semibold">{filteredRowsCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetTableData(tableKey, { page: Math.max(1, tableState.page - 1) })}
              disabled={isBusy || tableState.page <= 1}
              className="px-3 py-1.5 rounded-md text-xs border border-app-border text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>

            <span className="text-xs text-slate-600 min-w-[86px] text-center">
              Page {tableState.page}/{totalPages}
            </span>

            <button
              onClick={() => onSetTableData(tableKey, { page: Math.min(totalPages, tableState.page + 1) })}
              disabled={isBusy || tableState.page >= totalPages}
              className="px-3 py-1.5 rounded-md text-xs border border-app-border text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>

            <input
              value={tableState.jumpPageInput}
              onChange={(e) => onSetTableData(tableKey, { jumpPageInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onJumpSubmit(tableKey, totalPages, tableState.jumpPageInput);
              }}
              className="w-16 bg-app-input border border-app-border rounded-md px-2 py-1.5 text-xs text-center"
              placeholder="#"
            />
            <button
              onClick={() => onJumpSubmit(tableKey, totalPages, tableState.jumpPageInput)}
              disabled={isBusy}
              className="px-2.5 py-1.5 rounded-md text-xs border border-app-border text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Jump
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
