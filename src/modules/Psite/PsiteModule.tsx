// src/modules/Psite/PsiteModule.tsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfigStore } from '@/store/useConfigStore';
import { useLogStore } from '@/store/useLogStore';
import { usePsiteStore } from '@/store/usePsiteStore';
import { useRAnalysis } from '@/hooks/useRAnalysis';
import { D3SaturationChart } from './D3SaturationChart'; 
import { D3PsiteChart } from './D3PsiteChart';
import { 
  Play, CheckCircle2, RefreshCw, AlertCircle,
  Activity, Download, X, Settings2, Binary, ChevronRight, Check
} from 'lucide-react';
import { readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import JSZip from 'jszip';

export const PsiteModule: React.FC = () => {
  const { bamPath, dbPath, outputPath, species, seqType, isIndexFound } = useConfigStore();
  const { setExpanded, addLog } = useLogStore(); 
  const { runRScript, isRunning } = useRAnalysis();
  
  const { 
    hasAnalyzed, saturationData, startData, stopData, selectedLen,
    setHasAnalyzed, setSaturationData, setDistributionData, setSelectedLen
  } = usePsiteStore();

  const [activeAnchor, setActiveAnchor] = useState<'start' | 'stop'>('start');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTarget, setExportTarget] = useState<'saturation' | 'distribution'>('saturation');
  const [selectedExportLens, setSelectedExportLens] = useState<number[]>([]);
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const [exportSettings, setExportSettings] = useState({
    width: 210, 
    height: 148, 
    dpi: 300,
    format: 'png' as 'png' | 'pdf'
  });

  const isProjectReady = !!(bamPath && dbPath && outputPath && species && seqType && isIndexFound);

  const parseTsv = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].trim().split(/\s+/);
    return lines.slice(1).map(line => {
      const values = line.trim().split(/\s+/);
      return headers.reduce((obj, header, i) => {
        const val = values[i];
        obj[header] = isNaN(Number(val)) ? val : Number(val);
        return obj;
      }, {} as any);
    });
  };

  const handleStartAnalysis = async () => {
    if (!isProjectReady) return;
    setExpanded(true);
    try {
      const scriptId = 'ribo_psite_calib';
      const TXLENS_PATH = await join(dbPath, `${species}.txlens.rda`);
      const args = ["--bam", bamPath, "--txlens", TXLENS_PATH, "--outdir", outputPath, "--species", species, "--seqType", seqType];
      
      await runRScript(scriptId, args);
      await loadResults();
      
      addLog("success", "[Analysis] Pipeline complete. New offsets generated in output directory.");
      setTimeout(() => {
        const { activeProcessCount, sessionHasError } = useLogStore.getState();
        if (activeProcessCount === 0 && !sessionHasError) setExpanded(false);
      }, 800);
    } catch (error: any) {
      if (error.message === "Aborted") {
        addLog("command", "[System] Analysis aborted: R-process terminated and workspace state preserved.");
      } else {
        addLog("error", `[Analysis] Critical failure: ${error.message || error}`);
      }
    }
  };

  const loadResults = async () => {
    try {
      const saturationPath = await join(outputPath, 'saturation.gene.txt');
      const startPath = await join(outputPath, 'psite.txt');
      const stopPath = await join(outputPath, 'psite_stopcodon.txt');
      const [satText, startText, stopText] = await Promise.all([
        readTextFile(saturationPath), readTextFile(startPath), readTextFile(stopPath)
      ]);
      const parsedStart = parseTsv(startText);
      setSaturationData(parseTsv(satText));
      setDistributionData(parsedStart, parseTsv(stopText));
      const lens = Array.from(new Set(parsedStart.map(d => d.length)));
      if (lens.length > 0) {
        setSelectedLen(lens[0]);
        setSelectedExportLens([lens[0]]);
      }
      setHasAnalyzed(true);
    } catch (e) {
      addLog("error", "[FS] IO Error while reading R outputs.");
    }
  };

  const generateBuffer = async (svg: SVGSVGElement): Promise<Uint8Array | null> => {
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', '850');
    clonedSvg.setAttribute('height', '550');
    if (exportSettings.format === 'pdf') {
      const pdf = new jsPDF({ 
        orientation: exportSettings.width > exportSettings.height ? 'l' : 'p', 
        unit: 'mm', 
        format: [exportSettings.width, exportSettings.height] 
      });
      await svg2pdf(clonedSvg, pdf, { x: 0, y: 0, width: exportSettings.width, height: exportSettings.height });
      return new Uint8Array(pdf.output('arraybuffer'));
    } else {
      const scaleFactor = Math.max(1, exportSettings.dpi / 96);
      const pxWidth = (exportSettings.width * 3.78) * scaleFactor;
      const pxHeight = (exportSettings.height * 3.78) * scaleFactor;
      const canvas = document.createElement('canvas');
      canvas.width = pxWidth; canvas.height = pxHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const serializer = new XMLSerializer();
      const svgBlob = new Blob([serializer.serializeToString(clonedSvg)], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      return new Promise((resolve) => {
        img.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pxWidth, pxHeight);
          ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
          const base64 = canvas.toDataURL("image/png").split(',')[1];
          const binary = atob(base64);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
          URL.revokeObjectURL(url);
          resolve(array);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }
  };

  const handleExport = async () => {
    if (exportSettings.dpi <= 0) return;
    try {
      setIsExporting(true); 
      if (exportTarget === 'saturation') {
        const svg = document.getElementById('psite-saturation-svg') as unknown as SVGSVGElement;
        if (!svg) { setIsExporting(false); return; }
        const savePath = await save({
          filters: [{ name: exportSettings.format.toUpperCase(), extensions: [exportSettings.format] }],
          defaultPath: `RiboMeta_Saturation_Analysis.${exportSettings.format}`
        });
        if (!savePath) { setIsExporting(false); return; }
        const buffer = await generateBuffer(svg);
        if (buffer) await writeFile(savePath, buffer);
      } else {
        if (selectedExportLens.length === 1) {
          const nt = selectedExportLens[0];
          setSelectedLen(nt); 
          await new Promise(r => setTimeout(r, 100)); 
          const svg = document.getElementById('psite-distribution-svg') as unknown as SVGSVGElement;
          if (!svg) { setIsExporting(false); return; }
          const savePath = await save({
            filters: [{ name: exportSettings.format.toUpperCase(), extensions: [exportSettings.format] }],
            defaultPath: `RiboMeta_Stratification_${nt}nt_${activeAnchor}.${exportSettings.format}`
          });
          if (!savePath) { setIsExporting(false); return; }
          const buffer = await generateBuffer(svg);
          if (buffer) await writeFile(savePath, buffer);
        } else {
          const zipPath = await save({
            filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
            defaultPath: `RiboMeta_Stratification_Batch_${activeAnchor}.zip`
          });
          if (!zipPath) { setIsExporting(false); return; }
          
          const zip = new JSZip();
          setExportProgress({ current: 0, total: selectedExportLens.length });
          addLog("info", `[Batch] Exporting ${selectedExportLens.length} files...`);
          
          let counter = 0;
          for (const nt of selectedExportLens) {
            counter++;
            setExportProgress(p => ({ ...p, current: counter }));
            setSelectedLen(nt);
            await new Promise(r => setTimeout(r, 1500)); 
            const svg = document.getElementById('psite-distribution-svg') as unknown as SVGSVGElement;
            if (!svg) continue;
            const buffer = await generateBuffer(svg);
            if (buffer) {
              zip.file(`Stratification_${nt}nt_${activeAnchor}.${exportSettings.format}`, buffer);
            }
          }
          const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
          await writeFile(zipPath, zipBuffer);
        }
      }
      setShowExportModal(false);
      addLog("success", "[Export] Process complete.");
    } catch (err: any) {
      addLog("error", `[Export] Error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const activeDataset = activeAnchor === 'start' ? startData : stopData;
  const availableLengths = useMemo(() => Array.from(new Set(activeDataset.map(d => d.length))), [activeDataset]);
  const currentChartData = useMemo(() => activeDataset.filter(d => d.length === selectedLen), [activeDataset, selectedLen]);

  return (
    <div className="w-full space-y-10">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">P-site Offset Calibration</h1>
          <p className="text-xs text-slate-500 flex items-center gap-2"><ChevronRight size={12} className="text-emerald-500" /> Precise nucleotide positioning via multi-anchor stratification.</p>
        </div>
        <div className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl border border-app-border shadow-sm">
          <div className="flex flex-col items-start px-2 border-r border-app-border pr-5 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>Environment</span>
            <div className="mt-0.5">{isProjectReady ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Verified</span> : <span className="text-rose-400 flex items-center gap-1"><AlertCircle size={10} /> Pending</span>}</div>
          </div>
          <button onClick={handleStartAnalysis} disabled={!isProjectReady || isRunning} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${isProjectReady && !isRunning ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
            {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            {isRunning ? 'Running Analysis' : 'Execute Analysis'}
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!hasAnalyzed ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-96 w-full rounded-[2rem] border-2 border-dashed border-app-border flex flex-col items-center justify-center space-y-4">
             <Settings2 size={48} className="text-slate-200" />
             <p className="text-xs font-medium text-slate-400 italic">No buffer found. Execute workflow to generate distributions.</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-12 pb-24">
            <section className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><Binary size={16} /></div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Rarefaction Analysis</h2>
                </div>
                <button onClick={() => { setExportTarget('saturation'); setShowExportModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-xl text-[10px] font-bold border border-app-border hover:bg-emerald-600 hover:text-white transition-all group">
                  <Download size={14} className="group-hover:scale-110" /> Export
                </button>
              </div>
              <div className="bg-white border border-app-border rounded-[2.5rem] p-4 shadow-sm"><D3SaturationChart data={saturationData} /></div>
            </section>

            <section className="space-y-6">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><Activity size={16} /></div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">P-site Stratification</h2>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setExportTarget('distribution'); setShowExportModal(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-lg text-[10px] font-bold border border-app-border hover:bg-emerald-600 hover:text-white transition-all"><Download size={12} /> Export</button>
                  <div className="flex gap-1.5 p-1 bg-stone-100 rounded-xl border border-app-border">
                    <button onClick={() => setActiveAnchor('start')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeAnchor === 'start' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Start</button>
                    <button onClick={() => setActiveAnchor('stop')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeAnchor === 'stop' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Stop</button>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-app-border rounded-[2.5rem] p-8 shadow-sm">
                <div className="mb-8 flex flex-wrap gap-1.5">
                   {availableLengths.map(len => (
                     <button key={len} onClick={() => setSelectedLen(len)} className={`px-3.5 py-1.5 rounded-md text-[10px] font-black transition-all ${selectedLen === len ? 'bg-emerald-600 text-white shadow-md' : 'bg-stone-50 text-slate-400'}`}>{len}nt</button>
                   ))}
                </div>
                <D3PsiteChart data={currentChartData} anchor={activeAnchor} />
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-app-card w-full max-w-md rounded-[2rem] border border-app-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-8 py-6 border-b border-app-border flex justify-between items-center bg-stone-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 rounded-lg text-white"><Settings2 size={18} /></div>
                  <h3 className="text-sm font-black uppercase tracking-widest">{isExporting ? 'Exporting...' : 'Figure Export'}</h3>
                </div>
                {!isExporting && (
                  <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 transition-colors"><X size={20} /></button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 scrollbar-thin">
                <fieldset disabled={isExporting} className="space-y-6">
                  {exportTarget === 'distribution' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Fragments (NT)</label>
                        <button onClick={() => setSelectedExportLens(availableLengths)} className="text-[9px] text-emerald-600 font-bold hover:underline">Select All</button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                        {availableLengths.map(len => (
                          <button key={len} onClick={() => setSelectedExportLens(prev => prev.includes(len) ? prev.filter(l => l !== len) : [...prev, len])} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${selectedExportLens.includes(len) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-app-border text-slate-400'}`}>
                            {selectedExportLens.includes(len) && <Check size={10} />} {len}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Format</label>
                    <div className="flex gap-4">
                      {['png', 'pdf'].map((fmt) => (
                        <button key={fmt} onClick={() => setExportSettings({...exportSettings, format: fmt as any})} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase border-2 transition-all ${exportSettings.format === fmt ? 'border-emerald-600 bg-emerald-600/5 text-emerald-600' : 'border-app-border text-slate-400'}`}>{fmt}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Width (mm)</label><input type="number" value={exportSettings.width} onChange={(e) => setExportSettings({...exportSettings, width: Math.max(1, Number(e.target.value))})} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Height (mm)</label><input type="number" value={exportSettings.height} onChange={(e) => setExportSettings({...exportSettings, height: Math.max(1, Number(e.target.value))})} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500" /></div>
                  </div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">DPI (#PNG Only)</label><input type="number" min={1} value={exportSettings.dpi} onChange={(e) => setExportSettings({...exportSettings, dpi: Math.max(1, Number(e.target.value))})} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-600" /></div>
                </fieldset>
              </div>
              
              <div className="p-8 pt-6 pb-10 border-t border-app-border bg-stone-50/30 shrink-0">
                <button 
                  onClick={handleExport} 
                  disabled={isExporting || (exportTarget === 'distribution' && selectedExportLens.length === 0)}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${isExporting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                >
                  {isExporting ? (
                    <><RefreshCw size={14} className="animate-spin" /> Generating: {exportProgress.current} / {exportProgress.total}</>
                  ) : (
                    selectedExportLens.length > 1 && exportTarget === 'distribution' ? `Download ${selectedExportLens.length} Files (ZIP)` : 'Download Figure'
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

