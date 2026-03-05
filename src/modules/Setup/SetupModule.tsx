// src/modules/Setup/SetupModule.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useConfigStore } from '@/store/useConfigStore';
import { open } from '@tauri-apps/plugin-dialog';
import {
  FolderOpen, Database, FileCode, CheckCircle2,
  AlertTriangle, FileWarning, ArrowRight, Lock, LayoutGrid, Layers3,
  ChevronRight, FileKey
} from 'lucide-react';
import { SpeciesSearchSelector } from './SpeciesSearchSelector';

interface SetupProps {
  onNavigate?: () => void;
}

export const SetupModule: React.FC<SetupProps> = ({ onNavigate }) => {
  const {
    dbPath,
    outputPath,
    bamPath,
    species,
    seqType,
    isIndexFound,
    isOffsetsConfFound,
    isTxlensFound,
    isTxdbFound,
    setDbPath,
    setOutputPath,
    setBamPath,
    setSpecies,
    setSeqType
  } = useConfigStore();

  const handleSelectBam = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Alignment Files', extensions: ['bam'] }]
    });
    if (selected) setBamPath(selected as string);
  };

  const handleSelectDir = async (setter: (path: string) => void) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setter(selected as string);
  };

  const isProjectReady = !!(
    bamPath &&
    dbPath &&
    outputPath &&
    species &&
    seqType &&
    isIndexFound &&
    isOffsetsConfFound &&
    isTxlensFound &&
    isTxdbFound
  );

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-app-text tracking-tight font-serif italic">
          Project Initialization
        </h1>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
          <ChevronRight size={12} className="text-emerald-500" />
          Establish secure data connectivity and identify reference libraries.
        </p>
      </div>

      <div className="grid gap-5">
        <ConfigCard icon={<LayoutGrid size={18}/>} title="Reference Genome" desc="Select the target assembly from the global registry.">
          <SpeciesSearchSelector selectedId={species} onSelect={setSpecies} />
        </ConfigCard>

        <ConfigCard icon={<Layers3 size={18}/>} title="Ribosome Type" desc="Select footprint mode before running any analysis.">
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={() => setSeqType('monosome')}
              className={`px-4 py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition-all ${
                seqType === 'monosome'
                  ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700'
                  : 'border-app-border text-slate-500 hover:border-emerald-300'
              }`}
            >
              Monosome
            </button>
            <button
              onClick={() => setSeqType('disome')}
              className={`px-4 py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition-all ${
                seqType === 'disome'
                  ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700'
                  : 'border-app-border text-slate-500 hover:border-emerald-300'
              }`}
            >
              Disome
            </button>
          </div>
          {!seqType && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={14} className="text-amber-600" />
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-tight">
                  Selection Required: choose monosome or disome.
                </p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
            </div>
          )}
        </ConfigCard>

        <ConfigCard icon={<FileCode size={18}/>} title="Sequencing Data (BAM)" desc="Select the aligned RPF reads file (.bam).">
          <PathInput value={bamPath} placeholder="Select .bam file..." onSelect={handleSelectBam} />
          {bamPath && !isIndexFound && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileWarning size={14} className="text-rose-500" />
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-tight">
                  Missing Index: Ensure "{bamPath.split(/[/\\]/).pop()}.bai" exists in the folder.
                </p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse mr-1" />
            </motion.div>
          )}
        </ConfigCard>

        <ConfigCard icon={<Database size={18}/>} title="Reference Library" desc="Folder containing annotation files (.rda, .sqlite).">
          <PathInput value={dbPath} placeholder="Select library directory..." onSelect={() => handleSelectDir(setDbPath)} />

          {dbPath && !isOffsetsConfFound && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileKey size={14} className="text-amber-600" />
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-tight">
                  Calibration Required: "offsets.conf.txt" not found in the library directory.
                </p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
            </motion.div>
          )}

          {dbPath && species && !isTxlensFound && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileWarning size={14} className="text-rose-500" />
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-tight">
                  Missing Annotation: "{species}.txlens.rda" not found in the library directory.
                </p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse mr-1" />
            </motion.div>
          )}

          {dbPath && species && !isTxdbFound && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileWarning size={14} className="text-rose-500" />
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest leading-tight">
                  Missing Annotation: "{species}.txdb.fa" not found in the library directory.
                </p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse mr-1" />
            </motion.div>
          )}
        </ConfigCard>

        <ConfigCard icon={<FolderOpen size={18}/>} title="Output Directory" desc="Target partition for systematic result storage.">
          <PathInput value={outputPath} placeholder="Select output folder..." onSelect={() => handleSelectDir(setOutputPath)} />
        </ConfigCard>
      </div>

      <div className="pt-4">
        <div className={`w-full p-1.5 pl-6 rounded-2xl border-2 transition-all duration-500 flex items-center justify-between ${
          isProjectReady ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-stone-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-3 py-3">
            {isProjectReady ? (
              <>
                <div className="p-1 bg-emerald-500 rounded-full text-white"><CheckCircle2 size={12} /></div>
                <span className="text-sm font-bold text-emerald-600 tracking-tight">Project Status: Ready for Analysis</span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-sm font-bold text-amber-600">
                  Project Status: {
                    !seqType ? 'Awaiting Mode (Monosome/Disome)' :
                    !species ? 'Awaiting Species' :
                    !bamPath || !dbPath || !outputPath ? 'Awaiting Paths' :
                    !isIndexFound ? 'Missing Index (.bai)' :
                    !isOffsetsConfFound ? 'Missing Calibration (offsets.conf.txt)' :
                    !isTxlensFound ? `Missing Annotation (${species}.txlens.rda)` :
                    !isTxdbFound ? `Missing Annotation (${species}.txdb.fa)` :
                    'Awaiting Parameters'
                  }
                </span>
              </div>
            )}
          </div>

          <motion.button disabled={!isProjectReady} onClick={() => isProjectReady && onNavigate?.()} className={`group h-12 flex items-center gap-3 px-8 rounded-xl font-bold text-xs uppercase tracking-[0.15em] transition-all duration-300 ${isProjectReady ? 'bg-emerald-600 text-white cursor-pointer shadow-lg shadow-emerald-600/20' : 'bg-transparent text-slate-300 cursor-not-allowed border border-dashed border-slate-200 dark:border-slate-800'}`}>
            {isProjectReady ? <>Proceed to Analysis <ArrowRight size={14} /></> : <><Lock size={12} className="opacity-50" /> Locked</>}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const ConfigCard = ({ icon, title, desc, children }: any) => (
  <div className="bg-app-card border-2 border-app-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-2.5 bg-stone-100 dark:bg-slate-800 text-ribo-primary rounded-xl">{icon}</div>
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
      {value ? <span className="truncate w-full font-bold text-ribo-primary" title={value}>{value}</span> : <span className="text-app-placeholder italic">{placeholder}</span>}
    </div>
    <button onClick={onSelect} className="px-5 py-2 border-2 border-app-border rounded-xl text-xs font-bold hover:bg-ribo-primary hover:text-white transition-all cursor-pointer bg-app-card text-app-text active:scale-95">Browse</button>
  </div>
);
