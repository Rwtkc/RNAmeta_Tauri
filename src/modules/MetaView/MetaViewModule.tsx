import React, { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dna,
  FlaskConical,
  LoaderCircle,
  Play,
  AlertCircle,
  Table,
  Search,
  ChevronRight,
  CheckCircle2,
  Download,
  X,
  Settings2,
  Check,
} from "lucide-react";
import { D3MetaViewChart, type CoverageProfile } from "./D3MetaViewChart";
import { useConfigStore } from "@/store/useConfigStore";
import { useLogStore } from "@/store/useLogStore";
import { useMetaViewStore } from "@/store/useMetaViewStore";
import { useRAnalysis } from "@/hooks/useRAnalysis";
import { exists, writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import JSZip from "jszip";

interface CoverageTablePage {
  headers: string[];
  rows: string[][];
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
}

const PAGE_SIZE = 15;
// PDF-only x-axis tick label offsets (no impact on in-app chart / PNG export).
const PDF_X_TICK_DY_EM = "0.40em";
const PDF_X_TICK_Y_OFFSET_PX = -5;
const EXPORT_OPTIONS = [
  { id: "meta-view-bar-svg", label: "Bar Chart" },
  { id: "meta-view-line-svg", label: "Line Chart" },
];

export const MetaViewModule: React.FC = () => {
  const {
    dbPath,
    outputPath,
    bamPath,
    species,
    seqType,
    isIndexFound,
    isOffsetsConfFound,
    isTxlensFound,
  } = useConfigStore();
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [chartLoadProgress, setChartLoadProgress] = useState(0);
  const [error, setError] = useState("");
  const chartProgressTimerRef = useRef<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedPlots, setSelectedPlots] = useState<string[]>([
    "meta-view-bar-svg",
    "meta-view-line-svg",
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportSettings, setExportSettings] = useState({
    width: 210,
    height: 148,
    dpi: 300,
    format: "png" as "png" | "pdf",
  });
  const {
    hasAnalyzed,
    csvPath,
    tableHeaders,
    tableRows,
    page,
    totalPages,
    searchInput,
    searchQuery,
    jumpPageInput,
    selectedRowKey,
    profile,
    hasCoverageInOutput,
    setMetaViewData,
  } = useMetaViewStore();
  const { addLog, setExpanded } = useLogStore();
  const { runRScript, isRunning } = useRAnalysis();
  const hasSeqType = seqType === "monosome" || seqType === "disome";
  const canGenerateCoverage = !!(
    outputPath &&
    dbPath &&
    species &&
    bamPath &&
    hasSeqType &&
    isIndexFound &&
    isOffsetsConfFound &&
    isTxlensFound
  );
  const isProjectReady = hasSeqType && (hasCoverageInOutput || canGenerateCoverage);

  const transcriptIdCol = useMemo(
    () => tableHeaders.findIndex((h) => h === "transcript_id"),
    [tableHeaders]
  );
  const codonValCol = useMemo(
    () => tableHeaders.findIndex((h) => h === "codon_val"),
    [tableHeaders]
  );

  const paginationItems = useMemo<(number | "ellipsis")[]>(() => {
    if (totalPages <= 1) return [1];

    const result: (number | "ellipsis")[] = [];
    const start = page <= 6 ? 1 : Math.max(1, page - 5);
    const end = page <= 6 ? Math.min(totalPages, Math.max(6, page + 1)) : Math.min(totalPages, page + 1);

    for (let p = start; p <= end; p += 1) {
      result.push(p);
    }

    if (end < totalPages - 2) {
      result.push("ellipsis");
      result.push(totalPages - 1, totalPages);
    } else if (end < totalPages) {
      for (let p = end + 1; p <= totalPages; p += 1) {
        result.push(p);
      }
    }

    return result;
  }, [page, totalPages]);

  const loadTablePage = async (
    targetPage: number,
    targetSearchQuery = searchQuery
  ): Promise<boolean> => {
    setIsTableLoading(true);
    setError("");

    try {
      const finalCsvPath = await ensureCoverageCsvReady(csvPath.trim());
      addLog(
        "command",
        `[MetaView] Loading table page ${targetPage} (search='${targetSearchQuery || "all"}')...`
      );
      const result = await invoke<CoverageTablePage>("load_coverage_table_page", {
        csvPath: finalCsvPath,
        page: targetPage,
        pageSize: PAGE_SIZE,
        searchQuery: targetSearchQuery,
      });
      setMetaViewData({
        tableHeaders: result.headers,
        tableRows: result.rows,
        page: result.page,
        totalPages: result.total_pages,
        loadedCsvPath: finalCsvPath,
      });
      addLog(
        "success",
        `[MetaView] Table loaded: page ${result.page}/${result.total_pages}, filtered_rows=${result.total_rows}.`
      );
      return true;
    } catch (err: any) {
      const msg = err?.toString?.() ?? "Failed to load coverage table.";
      setError(msg);
      addLog("error", `[MetaView] ${msg}`);
      return false;
    } finally {
      setIsTableLoading(false);
    }
  };

  const loadProfileByTranscript = async (transcriptId: string, rowKey: string) => {
    if (!transcriptId) return;

    if (chartProgressTimerRef.current !== null) {
      window.clearInterval(chartProgressTimerRef.current);
      chartProgressTimerRef.current = null;
    }
    setChartLoadProgress(6);
    chartProgressTimerRef.current = window.setInterval(() => {
      setChartLoadProgress((prev) => {
        if (prev >= 92) return prev;
        if (prev < 40) return prev + 8;
        if (prev < 70) return prev + 4;
        return prev + 2;
      });
    }, 180);

    setIsChartLoading(true);
    setError("");
    setMetaViewData({ selectedRowKey: rowKey, profile: null });
    addLog("command", `[MetaView] Loading chart for: ${transcriptId}`);

    try {
      const finalCsvPath = await ensureCoverageCsvReady(csvPath.trim());
      const result = await invoke<CoverageProfile>("load_coverage_profile", {
        csvPath: finalCsvPath,
        transcriptId,
      });
      setMetaViewData({ profile: result });
      addLog("success", `[MetaView] Loaded ${result.points.length} points.`);
    } catch (err: any) {
      const msg = err?.toString?.() ?? "Failed to load coverage profile.";
      setError(msg);
      addLog("error", `[MetaView] ${msg}`);
    } finally {
      if (chartProgressTimerRef.current !== null) {
        window.clearInterval(chartProgressTimerRef.current);
        chartProgressTimerRef.current = null;
      }
      setChartLoadProgress(100);
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (chartProgressTimerRef.current !== null) {
        window.clearInterval(chartProgressTimerRef.current);
        chartProgressTimerRef.current = null;
      }
    };
  }, []);

  const handleFirstLoad = async () => {
    setMetaViewData({
      selectedRowKey: "",
      profile: null,
      searchInput: "",
      searchQuery: "",
    });
    const loaded = await loadTablePage(1, "");
    if (loaded) {
      setMetaViewData({ hasAnalyzed: true });
    }
  };

  const handleExecuteAnalysis = async () => {
    if (!isProjectReady || isTableLoading || isChartLoading || isRunning) return;

    setExpanded(true);
    await handleFirstLoad();

    setTimeout(() => {
      const { activeProcessCount, sessionHasError } = useLogStore.getState();
      if (activeProcessCount === 0 && !sessionHasError) setExpanded(false);
    }, 800);
  };

  const handleSearch = async () => {
    const query = searchInput.trim();
    setMetaViewData({
      selectedRowKey: "",
      profile: null,
      searchQuery: query,
    });
    await loadTablePage(1, query);
  };

  const formatCodonVal = (value: string): string => {
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    return num.toFixed(4);
  };

  const jumpToPage = async (targetPage: number) => {
    const bounded = Math.max(1, Math.min(totalPages, Math.trunc(targetPage)));
    if (bounded === page) return;
    await loadTablePage(bounded, searchQuery);
  };

  const handleJumpSubmit = async () => {
    const target = Number(jumpPageInput);
    if (!Number.isFinite(target)) return;
    await jumpToPage(target);
    setMetaViewData({ jumpPageInput: "" });
  };

  const generateBuffer = async (svgId: string): Promise<{ name: string; buffer: Uint8Array } | null> => {
    const svg = document.getElementById(svgId) as unknown as SVGSVGElement | null;
    if (!svg) return null;

    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute("width", "980");
    clonedSvg.setAttribute("height", "460");

    if (exportSettings.format === "pdf") {
      clonedSvg.querySelectorAll("text").forEach((node) => {
        const text = node as SVGTextElement;
        if (text.getAttribute("dy") === "0.71em") {
          const rawY = Number(text.getAttribute("y") ?? "9");
          text.setAttribute("dy", PDF_X_TICK_DY_EM);
          text.setAttribute("y", String(rawY + PDF_X_TICK_Y_OFFSET_PX));
        }
      });

      const pdf = new jsPDF({
        orientation: exportSettings.width > exportSettings.height ? "l" : "p",
        unit: "mm",
        format: [exportSettings.width, exportSettings.height],
      });
      await svg2pdf(clonedSvg, pdf, {
        x: 0,
        y: 0,
        width: exportSettings.width,
        height: exportSettings.height,
      });
      const kind = svgId.includes("bar") ? "bar" : "line";
      return {
        name: `${kind}.pdf`,
        buffer: new Uint8Array(pdf.output("arraybuffer")),
      };
    }

    const scaleFactor = Math.max(1, exportSettings.dpi / 96);
    const pxWidth = exportSettings.width * 3.78 * scaleFactor;
    const pxHeight = exportSettings.height * 3.78 * scaleFactor;
    const canvas = document.createElement("canvas");
    canvas.width = pxWidth;
    canvas.height = pxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const serializer = new XMLSerializer();
    const svgBlob = new Blob([serializer.serializeToString(clonedSvg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pxWidth, pxHeight);
        ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
        URL.revokeObjectURL(url);
        const kind = svgId.includes("bar") ? "bar" : "line";
        resolve({ name: `${kind}.png`, buffer: array });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  const handleExportExecute = async () => {
    if (selectedPlots.length === 0 || !profile) return;

    const transcriptSafe = profile.transcript_id.replace(/[^\w.-]+/g, "_");
    try {
      setIsExporting(true);
      setExportProgress({ current: 0, total: selectedPlots.length });

      if (selectedPlots.length === 1) {
        const result = await generateBuffer(selectedPlots[0]);
        if (!result) return;
        setExportProgress({ current: 1, total: 1 });
        const savePath = await save({
          filters: [{ name: exportSettings.format.toUpperCase(), extensions: [exportSettings.format] }],
          defaultPath: `RiboMeta_MetaView_${transcriptSafe}_${result.name}`,
        });
        if (!savePath) return;
        await writeFile(savePath, result.buffer);
      } else {
        const zipPath = await save({
          filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
          defaultPath: `RiboMeta_MetaView_${transcriptSafe}.zip`,
        });
        if (!zipPath) return;

        const zip = new JSZip();

        for (let i = 0; i < selectedPlots.length; i += 1) {
          const id = selectedPlots[i];
          setExportProgress({ current: i + 1, total: selectedPlots.length });
          const result = await generateBuffer(id);
          if (result) {
            zip.file(`RiboMeta_MetaView_${transcriptSafe}_${result.name}`, result.buffer);
          }
        }

        const zipBuffer = await zip.generateAsync({ type: "uint8array" });
        await writeFile(zipPath, zipBuffer);
      }

      setShowExportModal(false);
      addLog("success", "[MetaView] Export complete.");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      addLog("error", `[MetaView] Export failed: ${msg}`);
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const ensureCoverageCsvReady = async (inputCsvPath: string): Promise<string> => {
    if (!outputPath.trim()) {
      throw new Error("Output directory is not configured.");
    }

    const outputCoveragePath = await join(outputPath, "coverage_mRNA.csv");
    const candidatePath = inputCsvPath || outputCoveragePath;

    if (await exists(candidatePath)) {
      return candidatePath;
    }

    if (await exists(outputCoveragePath)) {
      if (csvPath !== outputCoveragePath) setMetaViewData({ csvPath: outputCoveragePath });
      addLog("info", "[MetaView] coverage_mRNA.csv found in output directory.");
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
      throw new Error(
        "Missing coverage_mRNA.csv. Provide BAM and offsets.conf.txt (same requirement as Codon module)."
      );
    }

    addLog("info", "[MetaView] coverage_mRNA.csv not found. Generating via ribo_coverage_mrna.R...");
    await runRScript("ribo_coverage_mrna", [
      "--coverage", outputCoveragePath,
      "--txlens", txlensPath,
      "--species", species,
      "--bam", bamPath,
      "--offsets", finalOffsetsPath,
    ]);

    if (!(await exists(outputCoveragePath))) {
      throw new Error("coverage_mRNA.csv generation failed.");
    }

    setMetaViewData({
      csvPath: outputCoveragePath,
      hasCoverageInOutput: true,
    });
    addLog("success", "[MetaView] coverage_mRNA.csv generated.");
    return outputCoveragePath;
  };

  useEffect(() => {
    if (!outputPath.trim()) {
      setMetaViewData({ hasCoverageInOutput: false });
      return;
    }

    let cancelled = false;
    const probeCoverage = async () => {
      try {
        const outputCoveragePath = await join(outputPath, "coverage_mRNA.csv");
        const found = await exists(outputCoveragePath);
        if (!cancelled) setMetaViewData({ hasCoverageInOutput: found });
      } catch {
        if (!cancelled) setMetaViewData({ hasCoverageInOutput: false });
      }
    };

    void probeCoverage();
    const heartbeat = window.setInterval(() => {
      void probeCoverage();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
    };
  }, [outputPath]);

  useEffect(() => {
    if (!outputPath.trim()) {
      setMetaViewData({
        hasAnalyzed: false,
        csvPath: "",
        loadedCsvPath: "",
        tableHeaders: [],
        tableRows: [],
        page: 1,
        totalPages: 1,
        selectedRowKey: "",
        profile: null,
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      const outputCoveragePath = await join(outputPath, "coverage_mRNA.csv");
      if (cancelled) return;
      const state = useMetaViewStore.getState();

      const pathChanged =
        (state.loadedCsvPath.trim().length > 0 && state.loadedCsvPath !== outputCoveragePath) ||
        ((state.hasAnalyzed || state.tableRows.length > 0) &&
          state.csvPath.trim().length > 0 &&
          state.csvPath !== outputCoveragePath);

      if (state.csvPath !== outputCoveragePath) {
        setMetaViewData({ csvPath: outputCoveragePath });
      }

      if (pathChanged) {
        setMetaViewData({
          hasAnalyzed: false,
          loadedCsvPath: "",
          tableHeaders: [],
          tableRows: [],
          page: 1,
          totalPages: 1,
          searchInput: "",
          searchQuery: "",
          jumpPageInput: "",
          selectedRowKey: "",
          profile: null,
        });
      }

      const found = await exists(outputCoveragePath);
      if (cancelled) return;

      if (found) {
        setMetaViewData({ hasCoverageInOutput: true });
      } else {
        setMetaViewData({
          hasAnalyzed: false,
          hasCoverageInOutput: false,
          loadedCsvPath: "",
          tableHeaders: [],
          tableRows: [],
          page: 1,
          totalPages: 1,
          selectedRowKey: "",
          profile: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [outputPath]);

  const showPreAnalysisPlaceholder = !hasAnalyzed;

  return (
    <div className="w-full space-y-12 pb-24">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">
            Transcript MetaView
          </h1>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <ChevronRight size={12} className="text-emerald-500" />
            Table-first coverage browsing with transcript-level bar/line rendering.
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
            disabled={!isProjectReady || isTableLoading || isChartLoading || isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${
              isProjectReady && !isTableLoading && !isChartLoading && !isRunning
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-slate-200 text-slate-400"
            }`}
          >
            {isTableLoading || isRunning ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : (
              <Play size={12} fill="currentColor" />
            )}
            Execute Analysis
          </button>
        </div>
      </header>

      {error && (
        <section className="bg-white border border-app-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        </section>
      )}

      {showPreAnalysisPlaceholder ? (
        <section className="h-96 w-full rounded-[2.5rem] border-2 border-dashed border-app-border flex flex-col items-center justify-center space-y-4">
          <Dna size={48} className="text-slate-200" />
          <p className="text-xs font-medium text-slate-400 italic">
            No MetaView metrics found. Execute analysis pipeline.
          </p>
        </section>
      ) : (
        <>
          <section className="bg-white border border-app-border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <Table size={14} />
                coverage_mRNA.csv
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] w-[320px] max-w-full">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchInput}
                    onChange={(e) => setMetaViewData({ searchInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleSearch();
                      }
                    }}
                    className="w-full bg-app-input border border-app-border rounded-lg pl-9 pr-3 py-2 text-xs"
                    placeholder="Search all columns..."
                  />
                </div>

                <button
                  onClick={handleSearch}
                  disabled={isTableLoading || tableHeaders.length === 0}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    isTableLoading || tableHeaders.length === 0
                      ? "bg-slate-200 text-slate-500"
                      : "bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                >
                  <Search size={14} />
                  Search
                </button>

                {(searchInput || searchQuery) && (
                  <button
                    onClick={handleFirstLoad}
                    disabled={isTableLoading}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-app-border text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="relative overflow-auto max-h-[62vh] border border-app-border rounded-lg">
              {tableHeaders.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 italic">
                  Load coverage_mRNA.csv to show table.
                </div>
              ) : (
                <table className="min-w-full text-xs text-center">
                  <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr>
                      {tableHeaders.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 border-b border-app-border whitespace-nowrap text-center font-semibold text-slate-700"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={tableHeaders.length}
                          className="px-3 py-6 text-center text-slate-400 italic border-b border-app-border/70"
                        >
                          No rows match the current search.
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((row, rowIdx) => {
                        const tid = transcriptIdCol >= 0 ? row[transcriptIdCol] : "";
                        const rowKey = `${page}-${rowIdx}`;
                        const active = rowKey === selectedRowKey;
                        const rowClass = active
                          ? "bg-emerald-50"
                          : rowIdx % 2 === 0
                          ? "bg-white hover:bg-slate-50"
                          : "bg-slate-50/70 hover:bg-slate-100/70";

                        return (
                          <tr key={`${rowIdx}-${tid}`} className={rowClass}>
                            {row.map((cell, colIdx) => {
                              const isTid = colIdx === transcriptIdCol;
                              return (
                                <td
                                  key={`${rowIdx}-${colIdx}`}
                                  className="px-3 py-1.5 border-b border-app-border/70 whitespace-nowrap text-slate-700 text-center align-middle"
                                >
                                  {isTid ? (
                                    <button
                                      onClick={() => loadProfileByTranscript(cell, rowKey)}
                                      className={`w-full text-center font-semibold underline-offset-2 hover:underline ${
                                        active ? "text-emerald-700" : "text-emerald-600"
                                      }`}
                                    >
                                      {cell}
                                    </button>
                                  ) : (
                                    colIdx === codonValCol ? formatCodonVal(cell) : cell
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {isTableLoading && (
                <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-white border border-app-border text-xs text-slate-600 shadow-sm">
                    <LoaderCircle size={14} className="animate-spin" />
                    Loading page...
                  </div>
                </div>
              )}
            </div>

            {tableHeaders.length > 0 && totalPages > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1">
                  {paginationItems.map((item, idx) =>
                    item === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${item}`}
                        disabled={isTableLoading}
                        onClick={() => {
                          void jumpToPage(item);
                        }}
                        className={`min-w-8 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                          item === page
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "border-app-border text-slate-700 hover:bg-slate-50"
                        } disabled:opacity-50`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Page</span>
                  <input
                    value={jumpPageInput}
                    onChange={(e) => setMetaViewData({ jumpPageInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleJumpSubmit();
                      }
                    }}
                    className="w-20 border border-app-border rounded px-2 py-1 text-xs text-center bg-white"
                    placeholder={`${page}`}
                  />
                  <button
                    disabled={isTableLoading}
                    onClick={() => {
                      void handleJumpSubmit();
                    }}
                    className="px-3 py-1.5 rounded border border-app-border text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Jump
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white border border-app-border rounded-2xl p-3 shadow-sm">
            <div className="px-2 pb-2 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                Coverage Charts
              </div>
              <button
                onClick={() => {
                  setSelectedPlots(["meta-view-bar-svg", "meta-view-line-svg"]);
                  setShowExportModal(true);
                }}
                disabled={!profile || isChartLoading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                  !profile || isChartLoading
                    ? "bg-slate-200 text-slate-500 border-slate-200"
                    : "bg-stone-100 border-app-border text-slate-700 hover:bg-emerald-600 hover:text-white"
                }`}
              >
                <Download size={12} />
                Export
              </button>
            </div>

            {isChartLoading ? (
              <div className="h-72 flex items-center justify-center px-6">
                <div className="w-full max-w-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={14} className="animate-spin" />
                      Loading chart...
                    </span>
                    <span className="font-semibold text-slate-600">
                      {Math.min(100, Math.max(0, Math.round(chartLoadProgress)))}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-out"
                      style={{ width: `${Math.max(4, Math.min(100, chartLoadProgress))}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : profile ? (
              <div className="space-y-7">
                <div className="border border-app-border rounded-2xl p-2">
                  <D3MetaViewChart id="meta-view-bar-svg" profile={profile} chartType="bar" />
                </div>
                <div className="border border-app-border rounded-2xl p-2">
                  <D3MetaViewChart id="meta-view-line-svg" profile={profile} chartType="line" />
                </div>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
                <div className="flex items-center gap-2">
                  <FlaskConical size={16} />
                  <span>Click transcript_id in table to render charts.</span>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-app-card w-full max-w-md rounded-[2rem] border border-app-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-app-border flex justify-between items-center bg-stone-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 rounded-lg text-white">
                    <Settings2 size={18} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">
                    {isExporting ? "Exporting..." : "Figure Export"}
                  </h3>
                </div>
                {!isExporting && (
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 scrollbar-thin">
                <fieldset disabled={isExporting} className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        Select Charts
                      </label>
                      <button
                        onClick={() =>
                          setSelectedPlots(["meta-view-bar-svg", "meta-view-line-svg"])
                        }
                        className="text-[9px] text-emerald-600 font-bold hover:underline"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {EXPORT_OPTIONS.map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            setSelectedPlots((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((v) => v !== item.id)
                                : [...prev, item.id]
                            )
                          }
                          className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                            selectedPlots.includes(item.id)
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-app-border text-slate-400 hover:border-emerald-500"
                          }`}
                        >
                          {selectedPlots.includes(item.id) && <Check size={10} />}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Format
                    </label>
                    <div className="flex gap-4">
                      {["png", "pdf"].map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() =>
                            setExportSettings({
                              ...exportSettings,
                              format: fmt as "png" | "pdf",
                            })
                          }
                          className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase border-2 transition-all ${
                            exportSettings.format === fmt
                              ? "border-emerald-600 bg-emerald-600/5 text-emerald-600"
                              : "border-app-border text-slate-400"
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        Width (mm)
                      </label>
                      <input
                        type="number"
                        value={exportSettings.width}
                        onChange={(e) =>
                          setExportSettings({
                            ...exportSettings,
                            width: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        Height (mm)
                      </label>
                      <input
                        type="number"
                        value={exportSettings.height}
                        onChange={(e) =>
                          setExportSettings({
                            ...exportSettings,
                            height: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      DPI (#PNG Only)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={exportSettings.dpi}
                      onChange={(e) =>
                        setExportSettings({
                          ...exportSettings,
                          dpi: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-600"
                    />
                  </div>
                </fieldset>
              </div>

              <div className="p-8 pt-6 pb-10 border-t border-app-border bg-stone-50/30 shrink-0">
                <button
                  onClick={handleExportExecute}
                  disabled={isExporting || selectedPlots.length === 0}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${
                    isExporting
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-500"
                  }`}
                >
                  {isExporting ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      Generating: {exportProgress.current} / {exportProgress.total}
                    </>
                  ) : selectedPlots.length > 1 ? (
                    "Export 2 Files (ZIP)"
                  ) : (
                    "Download Figure"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

