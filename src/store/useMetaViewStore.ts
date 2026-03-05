import { create } from "zustand";

interface CoveragePoint {
  transcript_coordinate: number;
  coverage: number;
}

export interface MetaViewCoverageProfile {
  transcript_id: string;
  tx_len: number;
  utr5_len: number;
  cds_len: number;
  utr3_len: number;
  start_pos: number;
  stop_pos: number;
  points: CoveragePoint[];
}

interface MetaViewState {
  hasAnalyzed: boolean;
  csvPath: string;
  loadedCsvPath: string;
  tableHeaders: string[];
  tableRows: string[][];
  page: number;
  totalPages: number;
  searchInput: string;
  searchQuery: string;
  jumpPageInput: string;
  selectedRowKey: string;
  profile: MetaViewCoverageProfile | null;
  hasCoverageInOutput: boolean;

  setMetaViewData: (data: Partial<MetaViewState>) => void;
  resetMetaViewData: () => void;
}

const initialState = {
  hasAnalyzed: false,
  csvPath: "",
  loadedCsvPath: "",
  tableHeaders: [],
  tableRows: [],
  page: 1,
  totalPages: 1,
  searchInput: "",
  searchQuery: "",
  jumpPageInput: "",
  selectedRowKey: "",
  profile: null,
  hasCoverageInOutput: false,
};

export const useMetaViewStore = create<MetaViewState>((set) => ({
  ...initialState,
  setMetaViewData: (data) => set((state) => ({ ...state, ...data })),
  resetMetaViewData: () => set({ ...initialState }),
}));
