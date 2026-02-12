// src/store/useQCStore.ts
import { create } from "zustand";

interface QCState {
  hasAnalyzed: boolean;
  frameData: any[];
  lengthFrameData: any[];
  metaProfileData: any[];
  occupancyBinData: any[];
  occupancyStartData: any[];
  occupancyEndData: any[];

  setHasAnalyzed: (val: boolean) => void;
  setQCData: (data: Partial<QCState>) => void;
  resetResults: () => void;
}

export const useQCStore = create<QCState>((set) => ({
  hasAnalyzed: false,
  frameData: [],
  lengthFrameData: [],
  metaProfileData: [],
  occupancyBinData: [],
  occupancyStartData: [],
  occupancyEndData: [],

  setHasAnalyzed: (val) => set({ hasAnalyzed: val }),
  setQCData: (data) =>
    set((state) => ({ ...state, ...data, hasAnalyzed: true })),
  resetResults: () =>
    set({
      hasAnalyzed: false,
      frameData: [],
      lengthFrameData: [],
      metaProfileData: [],
      occupancyBinData: [],
      occupancyStartData: [],
      occupancyEndData: [],
    }),
}));
