// src/modules/Setup/SpeciesSearchSelector.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Search, Check, Dna } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPECIES_LIST, SpeciesEntry } from './SpeciesRegistry';

const SpeciesItem = React.memo(({ 
  species, 
  isSelected, 
  onClick 
}: { 
  species: SpeciesEntry, 
  isSelected: boolean, 
  onClick: (id: string) => void 
}) => {
  return (
    <button
      onClick={() => onClick(species.id)}
      className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors duration-300 group relative"
    >
      {isSelected && (
        <motion.div 
          layoutId="active-bg"
          className="absolute inset-0 bg-ribo-primary/[0.06] z-0"
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}

      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-2 rounded-lg transition-all duration-300 ${
          isSelected 
          ? 'bg-ribo-primary text-white shadow-md scale-105' 
          : 'bg-stone-100 dark:bg-slate-800 text-slate-400 group-hover:text-ribo-primary group-hover:bg-ribo-primary/10'
        }`}>
          <Dna size={14} />
        </div>
        <div>
          <h4 className={`text-[11px] font-bold tracking-tight transition-colors duration-300 ${isSelected ? 'text-ribo-primary' : 'text-app-text'}`}>
            {species.name}
          </h4>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {species.assembly}
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            ID: {species.id}
          </p>
        </div>
      </div>
      
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {isSelected && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="w-5 h-5 bg-ribo-primary rounded-full flex items-center justify-center text-white shadow-sm"
            >
              <Check size={10} strokeWidth={4} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
});

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export const SpeciesSearchSelector: React.FC<Props> = ({ selectedId, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredList = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return SPECIES_LIST.filter((s: SpeciesEntry) => 
      s.name.toLowerCase().includes(query) || 
      s.assembly.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const selectedSpecies = useMemo(() => 
    SPECIES_LIST.find((s: SpeciesEntry) => s.id === selectedId),
  [selectedId]);

  const handleItemClick = useCallback((id: string) => {
    onSelect(selectedId === id ? '' : id);
  }, [selectedId, onSelect]);

  return (
    <div className="space-y-4">
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-ribo-primary transition-colors">
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Search species / assembly / ID (e.g. hg38, Oryza, hsa_hg38_v46)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-app-input border-2 border-app-border rounded-xl py-2.5 pl-11 pr-4 text-xs font-medium focus:border-ribo-primary focus:outline-none transition-all placeholder:italic placeholder:text-slate-400"
        />
      </div>

      <div className="border-2 border-app-border rounded-xl bg-app-card overflow-hidden flex flex-col shadow-sm">
        <div className="max-h-58 overflow-y-auto pr-[2px] scrollbar-thin">
          {filteredList.length > 0 ? (
            <div className="divide-y divide-app-border">
              {filteredList.map((s: SpeciesEntry) => (
                <SpeciesItem 
                  key={s.id}
                  species={s}
                  isSelected={selectedId === s.id}
                  onClick={handleItemClick}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              No matching species found.
            </div>
          )}
        </div>
        
        <div className="bg-stone-50 dark:bg-slate-900/50 px-5 py-2.5 border-t border-app-border flex justify-between items-center shrink-0">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Selected Genome</span>
          <AnimatePresence mode="wait">
            <motion.span 
              key={selectedId || 'none'}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              className="text-[10px] font-bold text-ribo-primary font-mono italic"
            >
              {selectedSpecies
                ? `${selectedSpecies.name} (${selectedSpecies.assembly}) | ID: ${selectedSpecies.id}`
                : 'None Selected'}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

