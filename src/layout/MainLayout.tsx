// src/layout/MainLayout.tsx
import React, { ReactNode, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import tuneVariant from '@iconify-icons/mdi/tune-variant';
import crosshairsGps from '@iconify-icons/mdi/crosshairs-gps';
import chartBoxOutline from '@iconify-icons/mdi/chart-box-outline';
import dna from '@iconify-icons/mdi/dna';
import chartTimelineVariantShimmer from '@iconify-icons/mdi/chart-timeline-variant-shimmer';
import helpCircleOutline from '@iconify-icons/mdi/help-circle-outline';
import { useLogStore } from '@/store/useLogStore';
import { useConfigStore } from '@/store/useConfigStore'; 
import { exists } from '@tauri-apps/plugin-fs'; 
import { ask } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path'; 
import { 
  Terminal, ChevronUp, ChevronDown, LayoutGrid, 
  Activity,
  XCircle,
  Wrench
} from 'lucide-react';
import { abortAnalysis } from '@/hooks/useRAnalysis';

interface MainLayoutProps {
  children: ReactNode;
  activeModule: string;
  onModuleChange: (module: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeModule, onModuleChange }) => {
  const { logs, isExpanded, setExpanded, activeProcessCount } = useLogStore();
  const {
    bamPath,
    dbPath,
    outputPath,
    species,
    setIsIndexFound,
    setIsOffsetsConfFound,
    setIsTxlensFound,
    setIsTxdbFound
  } = useConfigStore();

  const scrollContainerRef = useRef<HTMLElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const isProcessRunning = activeProcessCount > 0;

  useEffect(() => {
    const probeEnvironment = async () => {
      if (!bamPath) { 
        setIsIndexFound(false); 
      } else {
        try {
          const foundBai = await exists(`${bamPath}.bai`);
          setIsIndexFound(foundBai);
        } catch { setIsIndexFound(false); }
      }

      let foundOffsets = false;
      try {
        if (outputPath) {
          const customPath = await join(outputPath, 'offsets.conf.txt');
          foundOffsets = await exists(customPath);
        }
        if (!foundOffsets && dbPath) {
          const defaultPath = await join(dbPath, 'offsets.conf.txt');
          foundOffsets = await exists(defaultPath);
        }
        setIsOffsetsConfFound(foundOffsets);
      } catch { 
        setIsOffsetsConfFound(false); 
      }

      if (!dbPath || !species) {
        setIsTxlensFound(false);
        setIsTxdbFound(false);
      } else {
        try {
          const txlensPath = await join(dbPath, `${species}.txlens.rda`);
          const txdbPath = await join(dbPath, `${species}.txdb.fa`);
          setIsTxlensFound(await exists(txlensPath));
          setIsTxdbFound(await exists(txdbPath));
        } catch {
          setIsTxlensFound(false);
          setIsTxdbFound(false);
        }
      }
    };

    probeEnvironment();
    const heartbeat = window.setInterval(probeEnvironment, 2000);
    return () => clearInterval(heartbeat);
  }, [
    bamPath,
    dbPath,
    outputPath,
    species,
    setIsIndexFound,
    setIsOffsetsConfFound,
    setIsTxlensFound,
    setIsTxdbFound
  ]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeModule]);

  useEffect(() => {
    if (isExpanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  const handleAbort = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await ask(
      "System Alert: You are about to interrupt all current calculations. Continue?", 
      { title: "RiboMeta Engine", kind: "warning" }
    );
    if (confirmed) {
      await abortAnalysis();
      setExpanded(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-app-bg overflow-hidden font-sans border-t border-app-border">
      <aside className="w-52 bg-app-sidebar border-r border-app-border flex flex-col z-20 shadow-sm">
        <div className="p-6 pl-[2rem] border-b border-app-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ribo-primary rounded-lg text-white"><Activity size={18} /></div>
            <span className="text-xl font-extrabold text-ribo-primary tracking-tight">RiboMeta</span>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-0.5">
          <NavItem active={activeModule === 'Setup'} label="Project Configuration" icon={<Icon icon={tuneVariant} width={16} height={16} />} onClick={() => onModuleChange('Setup')} />
          <NavItem active={activeModule === 'Psite'} label="P-site" icon={<Icon icon={crosshairsGps} width={16} height={16} />} onClick={() => onModuleChange('Psite')} />
          <NavItem active={activeModule === 'QC'} label="Quality Control" icon={<Icon icon={chartBoxOutline} width={16} height={16} />} onClick={() => onModuleChange('QC')} />
          <NavItem active={activeModule === 'Codon'} label="Codon" icon={<Icon icon={dna} width={16} height={16} />} onClick={() => onModuleChange('Codon')} />
          <NavItem active={activeModule === 'MetaView'} label="MetaView" icon={<Icon icon={chartTimelineVariantShimmer} width={16} height={16} />} onClick={() => onModuleChange('MetaView')} />
          <NavItem active={activeModule === 'OrfPause'} label="ORF Pause" icon={<Activity size={16} />} onClick={() => onModuleChange('OrfPause')} />
          <NavItem active={activeModule === 'Tools'} label="Tools" icon={<Wrench size={16} />} onClick={() => onModuleChange('Tools')} />
          
          <div className="my-2 border-t border-app-border/30 mx-6" />
          <NavItem active={activeModule === 'About'} label="About & Help" icon={<Icon icon={helpCircleOutline} width={16} height={16} />} onClick={() => onModuleChange('About')} />
        </nav>
        <div className="p-6 border-t border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isProcessRunning ? 'animate-pulse' : ''}`} />
            {isProcessRunning ? 'Engine Active' : 'Engine Ready'}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-12 bg-app-sidebar/80 backdrop-blur-md border-b border-app-border flex items-center px-10 z-10">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <LayoutGrid size={12} className="text-ribo-primary" />
            <span>Workspace / </span><span className="text-ribo-primary">{activeModule}</span>
          </div>
        </header>

        <main ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-app-bg">
          <AnimatePresence mode="wait">
            <motion.div key={activeModule} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="p-8 pb-32 w-full min-h-full">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <section className={`absolute bottom-6 left-6 right-6 bg-slate-950 transition-all duration-500 z-30 shadow-2xl rounded-2xl border border-white/5 ${isExpanded ? 'h-72' : 'h-12'}`}>
          <div onClick={() => setExpanded(!isExpanded)} className="h-12 bg-white/5 px-6 flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-ribo-primary" />
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  Console {isProcessRunning && `(${activeProcessCount})`}
                </span>
              </div>
              <AnimatePresence>
                {isProcessRunning && (
                  <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onClick={handleAbort} className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg border border-rose-500/20 transition-all active:scale-95 group">
                    <XCircle size={12} className="group-hover:rotate-90 transition-transform" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Abort All</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-4">
              {isProcessRunning && (
                <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-500/80 tracking-widest">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  R-ENGINE ACTIVE
                </div>
              )}
              {isExpanded ? <ChevronDown size={16} className="text-stone-500" /> : <ChevronUp size={16} className="text-stone-500" />}
            </div>
          </div>
          {isExpanded && (
            <div className="p-6 font-mono text-[11px] leading-relaxed text-stone-300 overflow-y-auto h-[calc(100%-48px)]">
              {logs.map((log: any) => (
                <div key={log.id} className="mb-1.5 flex gap-3 border-l border-stone-800 pl-4">
                  <span className="text-stone-600">[{log.timestamp}]</span>
                  <span className={log.type === 'error' ? 'text-rose-500' : log.type === 'command' ? 'text-amber-500' : 'text-emerald-500'}>
                    {log.type}
                  </span>
                  <span className="text-stone-300">{log.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const NavItem = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full text-left py-4 text-[0.8rem] pl-[1.2rem] pr-[1.4rem] font-semibold relative flex items-center gap-4 transition-all ${active ? 'text-ribo-primary bg-stone-100' : 'text-slate-400 hover:text-slate-600'}`}>
    {active && <motion.div layoutId="activeNav" className="absolute left-0 top-0 bottom-0 w-1.5 bg-ribo-primary rounded-r-full" />}
    <span className={active ? 'text-ribo-primary' : ''}>{icon}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);
