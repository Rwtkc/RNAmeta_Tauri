import { create } from "zustand";

export type OrfPauseTableKey = "orf" | "pause";

export interface OrfPauseTableState {
  headers: string[];
  rows: string[][];
  searchInput: string;
  searchQuery: string;
  page: number;
  jumpPageInput: string;
}

interface OrfPauseState {
  hasAnalyzed: boolean;
  error: string;
  notice: string;
  lastRunSignature: string;
  orfTable: OrfPauseTableState;
  pauseTable: OrfPauseTableState;

  setOrfPauseData: (data: Partial<OrfPauseState>) => void;
  setTableData: (table: OrfPauseTableKey, data: Partial<OrfPauseTableState>) => void;
  resetResults: () => void;
}

const createInitialTable = (): OrfPauseTableState => ({
  headers: [],
  rows: [],
  searchInput: "",
  searchQuery: "",
  page: 1,
  jumpPageInput: "",
});

const initialState = {
  hasAnalyzed: false,
  error: "",
  notice: "",
  lastRunSignature: "",
  orfTable: createInitialTable(),
  pauseTable: createInitialTable(),
};

export const useOrfPauseStore = create<OrfPauseState>((set) => ({
  ...initialState,

  setOrfPauseData: (data) =>
    set((state) => ({
      ...state,
      ...data,
    })),

  setTableData: (table, data) =>
    set((state) => {
      const key = table === "orf" ? "orfTable" : "pauseTable";
      return {
        ...state,
        [key]: {
          ...state[key],
          ...data,
        },
      };
    }),

  resetResults: () =>
    set((state) => ({
      ...state,
      hasAnalyzed: false,
      error: "",
      orfTable: createInitialTable(),
      pauseTable: createInitialTable(),
    })),
}));
