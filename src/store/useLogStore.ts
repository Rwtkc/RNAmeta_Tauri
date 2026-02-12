// src/store/useLogStore.ts
import { create } from "zustand";

interface LogEntry {
  id: string;
  type: "info" | "error" | "success" | "command";
  message: string;
  timestamp: string;
}

interface LogState {
  logs: LogEntry[];
  isExpanded: boolean;
  activeProcessCount: number;
  sessionHasError: boolean;

  addLog: (type: LogEntry["type"], message: string) => void;
  clearLogs: () => void;
  setExpanded: (expanded: boolean) => void;

  incrementProcess: () => void;
  decrementProcess: () => void;
  setSessionError: (hasError: boolean) => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  isExpanded: false,
  activeProcessCount: 0,
  sessionHasError: false,

  addLog: (type, message) =>
    set((state) => {
      const isError = type === "error";
      return {
        sessionHasError: state.sessionHasError || isError,
        logs: [
          ...state.logs,
          {
            id: Math.random().toString(36).substring(7),
            type,
            message,
            timestamp: new Date().toLocaleTimeString(),
          },
        ].slice(-500),
      };
    }),

  clearLogs: () => set({ logs: [], sessionHasError: false }),
  setExpanded: (isExpanded) => set({ isExpanded }),

  incrementProcess: () =>
    set((state) => ({
      activeProcessCount: state.activeProcessCount + 1,
      sessionHasError:
        state.activeProcessCount === 0 ? false : state.sessionHasError,
    })),

  decrementProcess: () =>
    set((state) => ({
      activeProcessCount: Math.max(0, state.activeProcessCount - 1),
    })),

  setSessionError: (sessionHasError) => set({ sessionHasError }),
}));
