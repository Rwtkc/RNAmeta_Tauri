import { create } from "zustand";

type LogType = "info" | "error" | "success" | "command";

interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  timestamp: string;
}

interface LogState {
  logs: LogEntry[];
  isExpanded: boolean;
  activeProcessCount: number;
  addLog: (type: LogType, message: string) => void;
  clearLogs: () => void;
  setExpanded: (expanded: boolean) => void;
  incrementProcess: () => void;
  decrementProcess: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  isExpanded: false,
  activeProcessCount: 0,
  addLog: (type, message) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type,
          message,
          timestamp: new Date().toLocaleTimeString()
        }
      ].slice(-500)
    })),
  clearLogs: () => set({ logs: [] }),
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  incrementProcess: () =>
    set((state) => ({
      activeProcessCount: state.activeProcessCount + 1
    })),
  decrementProcess: () =>
    set((state) => ({
      activeProcessCount: Math.max(0, state.activeProcessCount - 1)
    }))
}));
