// src/hooks/useRAnalysis.ts
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { useLogStore } from "@/store/useLogStore";

const analysisRegistry = new Map<Child, (reason: Error) => void>();

export const abortAnalysis = async () => {
  const { addLog } = useLogStore.getState();
  if (analysisRegistry.size === 0) return;

  addLog(
    "command",
    `[Engine] SYSTEM_SIGNAL_SIGKILL: Terminating ${analysisRegistry.size} active process(es)...`
  );

  const tasks = Array.from(analysisRegistry.entries());
  analysisRegistry.clear();

  tasks.forEach(([_, rejecter]) => rejecter(new Error("Aborted")));

  await Promise.all(
    tasks.map(([child]) =>
      child
        .kill()
        .catch((e) => console.warn("[Engine] Process cleanup warning:", e))
    )
  );
};

export const useRAnalysis = () => {
  const [isRunning, setIsRunning] = useState(false);
  const { addLog, incrementProcess, decrementProcess } = useLogStore();

  const runRScript = useCallback(
    async (scriptId: string, args: string[] = []) => {
      setIsRunning(true);
      incrementProcess();

      return new Promise<void>(async (resolve, reject) => {
        let childInstance: Child | null = null;
        let tempScriptPath = "";
        let done = false;

        const handleTaskEnd = (err?: Error) => {
          if (done) return;
          done = true;
          if (childInstance) analysisRegistry.delete(childInstance);
          if (tempScriptPath) {
            invoke("cleanup_secure_script", { path: tempScriptPath }).catch(() => {});
          }
          decrementProcess();
          setIsRunning(false);
          if (err) reject(err);
          else resolve();
        };

        try {
          addLog("command", "[Engine] Dispatching R-analytics engine...");
          tempScriptPath = await invoke<string>("prepare_secure_script", {
            scriptId,
          });

          const command = Command.create("r-engine", [tempScriptPath, ...args]);

          command.stdout.on("data", (line) =>
            addLog("info", `[R-Out]: ${line}`)
          );

          command.stderr.on("data", (line) => {
            const isWarning =
              line.toLowerCase().includes("warning") &&
              !line.toLowerCase().includes("error");
            if (!isWarning) addLog("error", `[R-Stderr]: ${line}`);
          });

          command.on("close", (data) => {
            if (childInstance && analysisRegistry.has(childInstance)) {
              if (data.code === 0) handleTaskEnd();
              else handleTaskEnd(new Error(`Exit code ${data.code}`));
            }
          });

          command.on("error", (err) =>
            handleTaskEnd(new Error(`Process Error: ${err}`))
          );

          childInstance = await command.spawn();
          analysisRegistry.set(childInstance, handleTaskEnd);
        } catch (error: any) {
          handleTaskEnd(error);
        }
      });
    },
    [addLog, incrementProcess, decrementProcess]
  );

  return { runRScript, isRunning };
};
