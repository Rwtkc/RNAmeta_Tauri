// src/store/usePsiteStore.ts
import { create } from "zustand";

interface PsiteState {
  hasAnalyzed: boolean;
  saturationData: any[];
  startData: any[];
  stopData: any[];
  selectedLen: number;

  setHasAnalyzed: (val: boolean) => void;
  setSaturationData: (data: any[]) => void;
  setDistributionData: (start: any[], stop: any[]) => void;
  setSelectedLen: (len: number) => void;
  resetResults: () => void;
}

export const usePsiteStore = create<PsiteState>((set) => ({
  hasAnalyzed: false,
  saturationData: [],
  startData: [],
  stopData: [],
  selectedLen: 0,

  setHasAnalyzed: (val) => set({ hasAnalyzed: val }),
  setSaturationData: (data) => set({ saturationData: data }),
  setDistributionData: (start, stop) =>
    set({ startData: start, stopData: stop }),
  setSelectedLen: (selectedLen) => set({ selectedLen }),

  resetResults: () =>
    set({
      hasAnalyzed: false,
      saturationData: [],
      startData: [],
      stopData: [],
      selectedLen: 0,
    }),
}));
