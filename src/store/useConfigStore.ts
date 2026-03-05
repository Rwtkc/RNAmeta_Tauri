// src/store/useConfigStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ConfigState {
  dbPath: string;
  outputPath: string;
  bamPath: string;
  species: string;
  seqType: "" | "monosome" | "disome";
  isIndexFound: boolean;
  isOffsetsConfFound: boolean;
  isTxlensFound: boolean;
  isTxdbFound: boolean;

  setDbPath: (path: string) => void;
  setOutputPath: (path: string) => void;
  setBamPath: (path: string) => void;
  setSpecies: (species: string) => void;
  setSeqType: (seqType: "" | "monosome" | "disome") => void;
  setIsIndexFound: (found: boolean) => void;
  setIsOffsetsConfFound: (found: boolean) => void;
  setIsTxlensFound: (found: boolean) => void;
  setIsTxdbFound: (found: boolean) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      dbPath: "",
      outputPath: "",
      bamPath: "",
      species: "osa_IRGSP_1",
      seqType: "",
      isIndexFound: false,
      isOffsetsConfFound: false,
      isTxlensFound: false,
      isTxdbFound: false,

      setDbPath: (path) => set({ dbPath: path }),
      setOutputPath: (path) => set({ outputPath: path }),
      setBamPath: (path) => set({ bamPath: path }),
      setSpecies: (species) => set({ species }),
      setSeqType: (seqType) => set({ seqType }),
      setIsIndexFound: (found) => set({ isIndexFound: found }),
      setIsOffsetsConfFound: (found) => set({ isOffsetsConfFound: found }),
      setIsTxlensFound: (found) => set({ isTxlensFound: found }),
      setIsTxdbFound: (found) => set({ isTxdbFound: found }),
    }),
    {
      name: "ribometa_local_key",
    }
  )
);
