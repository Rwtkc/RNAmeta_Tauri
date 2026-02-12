// src/modules/About/AboutModule.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen,
  Cpu, Microscope, Heart,
  ShieldCheck, Command, Layers, BarChart2, Database
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

export const AboutModule: React.FC = () => {
  const GITHUB_URL = "https://github.com/Rwtkc/RiboMeta"; 

  const handleOpenLink = async (url: string) => {
    try {
      await open(url);
    } catch (error) {
      console.error("Failed to open external link:", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-4xl mx-auto space-y-16 pb-24"
    >
      <section className="text-center py-8">
        <div className="inline-flex p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 mb-2">
          <ActivityIcon size={44} className="text-ribo-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-app-text tracking-tight font-serif italic">
            RiboMeta Engine
          </h1>
          <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <span>Version 0.1.0 Alpha</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="flex items-center gap-1 text-emerald-600">
              <ShieldCheck size={12} /> Academic Licensed
            </span>
          </div>
        </div>
      </section>

      <section className="bg-white border-2 border-app-border rounded-[2.5rem] p-12 shadow-sm relative group overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
          <Microscope size={200} />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3 text-ribo-primary">
            <Cpu size={20} />
            <h2 className="text-xs font-black uppercase tracking-widest">System Architecture & Philosophy</h2>
          </div>
          <p className="text-xl font-serif leading-relaxed text-slate-700 italic max-w-4xl">
            "RiboMeta is a specialized analytical ecosystem engineered to decode the hidden complexities of the translatome. By combining high-fidelity R-scripts with a precision-driven D3 visualization engine, it transforms raw Ribo-seq data into publication-ready scientific narratives."
          </p>
        </div>
      </section>

      <section className="space-y-10">
        <div className="flex items-center gap-6 px-2">
           <div className="h-px flex-1 bg-app-border" />
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
             <BookOpen size={14} /> Analysis Workflow
           </div>
           <div className="h-px flex-1 bg-app-border" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GuideCard 
            icon={<Command size={20}/>}
            title="Project Configuration" 
            desc="Map your RPF alignments (.bam) to corresponding reference libraries. Automated heartbeats monitor index and configuration integrity."
          />
          <GuideCard 
            icon={<Layers size={20}/>}
            title="P-site Stratification" 
            desc="Calibrate nucleotide offsets across fragment populations using dual-anchor landmarks for precision mapping."
          />
          <GuideCard 
            icon={<BarChart2 size={20}/>}
            title="Quality Control" 
            desc="Evaluate triplet periodicity and meta-gene coverage to ensure the biological fidelity of captured ribosome footprints."
          />
          <GuideCard 
            icon={<Database size={20}/>}
            title="Codon Dynamics" 
            desc="Explore codon-level occupancy and metacodon profiles to quantify translational pausing and elongation kinetics."
          />
        </div>
      </section>

      <footer className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-app-border px-4">
        <div className="flex items-center gap-10">
          <button 
            onClick={() => handleOpenLink(GITHUB_URL)}
            className="flex items-center gap-2.5 text-sm font-bold text-app-text hover:text-ribo-primary transition-all cursor-pointer group"
          >
            <GitHubMarkIcon size={20} className="group-hover:scale-110 transition-transform" /> 
            Source Repository
          </button>
          <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-medium italic">
            <Heart size={14} className="text-rose-400" fill="currentColor" />
            Designed for the Global Genomics Community
          </div>
        </div>
        
        <div className="px-5 py-2.5 bg-stone-50 rounded-2xl border border-app-border text-[10px] font-mono text-slate-500 font-bold">
          OPEN-SOURCE / MIT LICENSE
        </div>
      </footer>
    </motion.div>
  );
};


const GuideCard = ({ icon, title, desc }: any) => (
  <div className="p-10 bg-white border-2 border-app-border rounded-[2rem] hover:border-emerald-500/30 transition-all group">
    <div className="flex items-center gap-5 mb-5">
      <div className="p-3 bg-stone-50 rounded-2xl text-slate-400 group-hover:text-ribo-primary group-hover:bg-emerald-50 transition-all">
        {icon}
      </div>
      <h3 className="text-base font-bold text-app-text tracking-tight">{title}</h3>
    </div>
    <p className="text-xs text-slate-500 leading-relaxed font-medium">
      {desc}
    </p>
  </div>
);

const ActivityIcon = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const GitHubMarkIcon = ({ size, className }: any) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 .297C5.37.297 0 5.667 0 12.297c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.386-1.333-1.755-1.333-1.755-1.09-.745.084-.729.084-.729 1.204.085 1.838 1.237 1.838 1.237 1.07 1.833 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.304-5.467-1.333-5.467-5.93 0-1.31.467-2.381 1.235-3.221-.124-.303-.535-1.526.117-3.176 0 0 1.008-.322 3.3 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.65.242 2.873.118 3.176.77.84 1.233 1.911 1.233 3.221 0 4.609-2.807 5.623-5.48 5.921.43.372.814 1.102.814 2.222 0 1.606-.015 2.902-.015 3.297 0 .32.216.694.825.576C20.565 22.093 24 17.597 24 12.297 24 5.667 18.627.297 12 .297z" />
  </svg>
);
