// src/modules/QC/QCModule.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfigStore } from '@/store/useConfigStore';
import { useLogStore } from '@/store/useLogStore';
import { useQCStore } from '@/store/useQCStore';
import { useRAnalysis } from '@/hooks/useRAnalysis';
import { D3FrameChart } from './D3FrameChart';
import { D3LengthFrameChart } from './D3LengthFrameChart';
import { D3MetaProfileChart } from './D3MetaProfileChart';
import { D3OccupancyChart } from './D3OccupancyChart';
import { 
  Play, RefreshCw, BarChart3, Binary, ChevronRight, Activity, Zap, PieChart, 
  AlertCircle, Download, X, Settings2, Check, CheckCircle2
} from 'lucide-react';
import { readTextFile, writeFile, exists } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import JSZip from 'jszip';

export const QCModule: React.FC = () => {
  const { bamPath, dbPath, outputPath, species, seqType, isIndexFound, isOffsetsConfFound } = useConfigStore();
  const { setExpanded, addLog } = useLogStore();
  const { runRScript, isRunning } = useRAnalysis();
  const { hasAnalyzed, frameData, lengthFrameData, metaProfileData, occupancyBinData, occupancyStartData, occupancyEndData, setQCData } = useQCStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTargetType, setExportTargetType] = useState<'single' | 'meta' | 'terminal'>('single');
  const [selectedPlots, setSelectedPlots] = useState<string[]>([]);
  const [exportSettings, setExportSettings] = useState({ width: 210, height: 148, dpi: 300, format: 'png' as 'png' | 'pdf' });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const isProjectReady = !!(bamPath && dbPath && outputPath && species && seqType && isIndexFound && isOffsetsConfFound);

  const parseTsv = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].trim().split('\t'); 
    return lines.slice(1).map(line => {
      const values = line.trim().split('\t');
      return headers.reduce((obj, header, i) => {
        const val = values[i]?.trim();
        obj[header] = isNaN(Number(val)) ? val : Number(val);
        return obj;
      }, {} as any);
    });
  };

  const handleStartAnalysis = async () => {
    if (!isProjectReady) return;
    setExpanded(true);
    try {
      const scriptId = 'ribo_qc';
      const TXLENS_PATH = await join(dbPath, `${species}.txlens.rda`);
      const customOffsetsPath = await join(outputPath, 'offsets.conf.txt');
      const defaultOffsetsPath = await join(dbPath, 'offsets.conf.txt');
      const hasCustom = await exists(customOffsetsPath);
      const finalOffsetsPath = hasCustom ? customOffsetsPath : defaultOffsetsPath;
      
      if (hasCustom) addLog("info", "[QC] Using freshly calibrated offsets from output directory.");
      else addLog("info", "[QC] Using default offsets from library directory.");

      const args = ["--bam", bamPath, "--txlens", TXLENS_PATH, "--offsets", finalOffsetsPath, "--outdir", outputPath, "--species", species];
      await runRScript(scriptId, args);
      
      const [f, lf, mp, ob, os, oe] = await Promise.all([
        readTextFile(await join(outputPath, 'frameStat.txt')),
        readTextFile(await join(outputPath, 'frameStatByLength.txt')),
        readTextFile(await join(outputPath, 'psite_metaprofile.txt')),
        readTextFile(await join(outputPath, 'occupancy_metagene_bin.txt')),
        readTextFile(await join(outputPath, 'occupancy_metagene_start.txt')),
        readTextFile(await join(outputPath, 'occupancy_metagene_end.txt'))
      ]);
      
      setQCData({ frameData: parseTsv(f), lengthFrameData: parseTsv(lf), metaProfileData: parseTsv(mp), occupancyBinData: parseTsv(ob), occupancyStartData: parseTsv(os), occupancyEndData: parseTsv(oe) });
      addLog("success", "[QC] Analysis synchronized.");
      setTimeout(() => {
        const { activeProcessCount, sessionHasError } = useLogStore.getState();
        if (activeProcessCount === 0 && !sessionHasError) setExpanded(false);
      }, 800);
    } catch (error: any) { 
      if (error.message === "Aborted") addLog("command", "[System] Analysis aborted.");
      else addLog("error", `[QC] Pipeline failed: ${error.message || error}`); 
    }
  };

  const generateBuffer = async (svgId: string): Promise<{name: string, buffer: Uint8Array} | null> => {
    const svg = document.getElementById(svgId) as unknown as SVGSVGElement;
    if (!svg) return null;
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', '900'); clonedSvg.setAttribute('height', '450');
    clonedSvg.querySelectorAll('circle').forEach(c => c.setAttribute('r', '3.5'));

    if (exportSettings.format === 'pdf') {
      const pdf = new jsPDF({ orientation: exportSettings.width > exportSettings.height ? 'l' : 'p', unit: 'mm', format: [exportSettings.width, exportSettings.height] });
      await svg2pdf(clonedSvg, pdf, { x: 0, y: 0, width: exportSettings.width, height: exportSettings.height });
      return { name: `${svgId}.pdf`, buffer: new Uint8Array(pdf.output('arraybuffer')) };
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
          URL.revokeObjectURL(url); resolve({ name: `${svgId}.png`, buffer: array });
        };
        img.src = url;
      });
    }
  };

  const handleExportExecute = async () => {
    if (selectedPlots.length === 0) return;
    try {
      setIsExporting(true);
      if (selectedPlots.length === 1) {
        const res = await generateBuffer(selectedPlots[0]);
        if (!res) { setIsExporting(false); return; }
        const savePath = await save({ filters: [{ name: exportSettings.format.toUpperCase(), extensions: [exportSettings.format] }], defaultPath: `RiboMeta_QC_${res.name}` });
        if (savePath) await writeFile(savePath, res.buffer);
      } else {
        const zipPath = await save({ filters: [{ name: 'ZIP Archive', extensions: ['zip'] }], defaultPath: `RiboMeta_QC_Batch_Export.zip` });
        if (!zipPath) { setIsExporting(false); return; }
        
        const zip = new JSZip();
        setExportProgress({ current: 0, total: selectedPlots.length });
        let counter = 0;
        for (const id of selectedPlots) {
          counter++;
          setExportProgress(p => ({ ...p, current: counter }));
          const res = await generateBuffer(id);
          if (res) zip.file(res.name, res.buffer);
        }
        const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
        await writeFile(zipPath, zipBuffer);
      }
      setShowExportModal(false);
      addLog("success", "[Export] Process complete.");
    } catch (err: any) { addLog("error", `[Export] Error: ${err.message}`); }
    finally { setIsExporting(false); }
  };

  const openExportModal = (type: 'single' | 'meta' | 'terminal', baseId: string) => {
    setExportTargetType(type);
    if (type === 'single') { setSelectedPlots([baseId]); } 
    else if (type === 'meta') { setSelectedPlots(['qc-meta-start-svg', 'qc-meta-stop-svg']); } 
    else { setSelectedPlots(['qc-occupancy-start-svg', 'qc-occupancy-end-svg']); }
    setShowExportModal(true);
  };

  return (
    <div className="w-full space-y-12 pb-24">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">Library Quality Control</h1>
          <p className="text-xs text-slate-500 flex items-center gap-2"><ChevronRight size={12} className="text-emerald-500" /> Multi-dimensional library validation and occupancy profiling.</p>
        </div>
        <div className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl border border-app-border shadow-sm">
          <div className="flex flex-col items-start px-2 border-r border-app-border pr-5 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>Environment</span>
            <div className="mt-0.5">{isProjectReady ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Verified</span> : <span className="text-rose-400 flex items-center gap-1"><AlertCircle size={10} /> Pending</span>}</div>
          </div>
          <button onClick={handleStartAnalysis} disabled={!isProjectReady || isRunning} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${isProjectReady && !isRunning ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
            {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            Execute Analysis
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!hasAnalyzed ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-96 w-full rounded-[2.5rem] border-2 border-dashed border-app-border flex flex-col items-center justify-center space-y-4">
             <Activity size={48} className="text-slate-200" />
             <p className="text-xs font-medium text-slate-400 italic">No metrics detected. Run analysis to proceed.</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-16 pb-24">
            <QCSection icon={<BarChart3 size={16}/>} title="Genomic Frame Enrichment" onExport={() => openExportModal('single', 'qc-frame-svg')}><D3FrameChart id="qc-frame-svg" data={frameData} /></QCSection>
            <QCSection icon={<Binary size={16}/>} title="Length-Frame Distribution" onExport={() => openExportModal('single', 'qc-length-svg')}><D3LengthFrameChart id="qc-length-svg" data={lengthFrameData} /></QCSection>
            <QCSection icon={<Zap size={16}/>} title="Metagene Distribution Profile" onExport={() => openExportModal('meta', 'qc-meta')}>
              <div className="space-y-5">
                <D3MetaProfileChart id="qc-meta-start-svg" data={metaProfileData} type="start" />
                <div className="border-t border-app-border pt-5"><D3MetaProfileChart id="qc-meta-stop-svg" data={metaProfileData} type="stop" /></div>
              </div>
            </QCSection>
            <QCSection icon={<PieChart size={16}/>} title="Global CDS Occupancy" onExport={() => openExportModal('single', 'qc-occupancy-bin-svg')}><D3OccupancyChart id="qc-occupancy-bin-svg" data={occupancyBinData} type="bin" /></QCSection>
            <QCSection icon={<Activity size={16}/>} title="Terminal kinetic profiling" onExport={() => openExportModal('terminal', 'qc-occupancy')}>
                <div className="space-y-5">
                  <D3OccupancyChart id="qc-occupancy-start-svg" data={occupancyStartData} type="start" />
                  <div className="border-t border-app-border pt-5"><D3OccupancyChart id="qc-occupancy-end-svg" data={occupancyEndData} type="end" /></div>
                </div>
            </QCSection>
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
                  {(exportTargetType === 'meta' || exportTargetType === 'terminal') && (
                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Sub-panels</label><div className="grid grid-cols-2 gap-2">
                      {exportTargetType === 'meta' ? (<><ExportCheck label="Start Panel" id="qc-meta-start-svg" selected={selectedPlots} onToggle={setSelectedPlots} /><ExportCheck label="Stop Panel" id="qc-meta-stop-svg" selected={selectedPlots} onToggle={setSelectedPlots} /></>) 
                      : (<><ExportCheck label="Start Profile" id="qc-occupancy-start-svg" selected={selectedPlots} onToggle={setSelectedPlots} /><ExportCheck label="End Profile" id="qc-occupancy-end-svg" selected={selectedPlots} onToggle={setSelectedPlots} /></>)}
                    </div></div>
                  )}
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Format</label><div className="flex gap-4">{['png', 'pdf'].map((fmt) => (<button key={fmt} onClick={() => setExportSettings({...exportSettings, format: fmt as any})} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase border-2 transition-all ${exportSettings.format === fmt ? 'border-emerald-600 bg-emerald-600/5 text-emerald-600' : 'border-app-border text-slate-400'}`}>{fmt}</button>))}</div></div>
                  <div className="grid grid-cols-2 gap-5"><div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Width (mm)</label><input type="number" value={exportSettings.width} onChange={(e) => setExportSettings({...exportSettings, width: Math.max(1, Number(e.target.value))})} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500" /></div><div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Height (mm)</label><input type="number" value={exportSettings.height} onChange={(e) => setExportSettings({...exportSettings, height: Math.max(1, Number(e.target.value))})} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs focus:border-emerald-500" /></div></div>
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">DPI (#PNG Only)</label><input type="number" min={1} value={exportSettings.dpi} onChange={(e) => setExportSettings({...exportSettings, dpi: Math.max(1, Number(e.target.value))})} className="w-full bg-app-input border-2 border-app-border rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-600" /></div>
                </fieldset>
              </div>
              <div className="p-8 pt-6 pb-10 border-t border-app-border bg-stone-50/30 shrink-0">
                <button 
                  onClick={handleExportExecute} 
                  disabled={isExporting || selectedPlots.length === 0} 
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${isExporting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                >
                  {isExporting ? (
                    <><RefreshCw size={14} className="animate-spin" /> Generating: {exportProgress.current} / {exportProgress.total}</>
                  ) : (
                    selectedPlots.length > 1 ? `Export ${selectedPlots.length} Files (ZIP)` : 'Download Figure'
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

const ExportCheck = ({ label, id, selected, onToggle }: any) => (
  <button onClick={() => onToggle((prev: string[]) => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${selected.includes(id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-app-border text-slate-400 hover:border-emerald-500'}`}>{selected.includes(id) && <Check size={10} />} {label}</button>
);

const QCSection = ({ icon, title, children, onExport }: any) => (
  <section className="space-y-6">
    <div className="flex items-center justify-between px-1"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">{icon}</div><h2 className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</h2></div>{onExport && (<button onClick={onExport} className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-lg text-[10px] font-bold border border-app-border hover:bg-emerald-600 hover:text-white transition-all"><Download size={12} /> Export</button>)}</div>
    <div className="bg-white border border-app-border rounded-[2.5rem] p-1 shadow-sm relative">{children}</div>
  </section>
);

