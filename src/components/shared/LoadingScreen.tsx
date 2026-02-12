// src/components/shared/LoadingScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-app-bg z-50 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative">
          <div className="p-5 bg-ribo-primary/10 rounded-2xl border-2 border-ribo-primary/20">
            <Activity size={48} className="text-ribo-primary" />
          </div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-ribo-primary blur-2xl -z-10 rounded-full"
          />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-app-text font-serif italic tracking-tight">
            RiboMeta Engine
          </h2>
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
              System Initializing...
            </p>
          </div>
        </div>

        <div className="w-48 h-1 bg-stone-100 dark:bg-slate-800 rounded-full overflow-hidden mt-4">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className="w-full h-full bg-ribo-primary"
          />
        </div>
      </motion.div>
    </div>
  );
};
