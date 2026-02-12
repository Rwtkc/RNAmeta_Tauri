// src/store/useCodonStore.ts
import { create } from "zustand";

interface UsageData {
  codon: string;
  aminoacid: string;
  [key: string]: string | number;
}

interface OccupancyData {
  codons_seq: string;
  normalized_value: number[];
}

interface CodonState {
  hasAnalyzed: boolean;
  usageData: UsageData[];
  occupancyData: OccupancyData[];
  selectedCodon: string;
  selectedSite: string;
  selectedSort: "default" | "desc" | "asc";

  setHasAnalyzed: (val: boolean) => void;
  setCodonData: (usage: any[], occupancy: any[]) => void;
  setSelectedCodon: (codon: string) => void;
  setSelectedSite: (site: string) => void;
  setSelectedSort: (sort: "default" | "desc" | "asc") => void;
  resetResults: () => void;
}

export const useCodonStore = create<CodonState>((set) => ({
  hasAnalyzed: false,
  usageData: [],
  occupancyData: [],
  selectedCodon: "AAA",
  selectedSite: "position_+1",
  selectedSort: "default",

  setHasAnalyzed: (val) => set({ hasAnalyzed: val }),

  setCodonData: (usage, occupancy) => {
    const firstCodon = occupancy.length > 0 ? occupancy[0].codons_seq : "AAA";
    set({
      usageData: usage,
      occupancyData: occupancy,
      hasAnalyzed: true,
      selectedCodon: firstCodon,
    });
  },

  setSelectedCodon: (codon) => set({ selectedCodon: codon }),
  setSelectedSite: (site) => set({ selectedSite: site }),
  setSelectedSort: (selectedSort) => set({ selectedSort }),

  resetResults: () =>
    set({
      hasAnalyzed: false,
      usageData: [],
      occupancyData: [],
      selectedCodon: "AAA",
      selectedSite: "position_+1",
      selectedSort: "default",
    }),
}));
