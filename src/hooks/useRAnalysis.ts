// src/hooks/useRAnalysis.ts
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Command, Child, SpawnOptions } from "@tauri-apps/plugin-shell";
import { useLogStore } from "@/store/useLogStore";

const analysisRegistry = new Map<Child, (reason: Error) => void>();
const abortedPids = new Set<number>();

interface ShellRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  encoding?: string;
  label?: string;
  onStdout?: (line: string, child: Child | null) => void;
  onStderr?: (line: string, child: Child | null) => void;
}

interface StreamHooks {
  onStdout?: (line: string, child: Child | null) => void;
  onStderr?: (line: string, child: Child | null) => void;
}

export const abortAnalysis = async () => {
  const { addLog } = useLogStore.getState();
  if (analysisRegistry.size === 0) return;

  addLog(
    "command",
    `[Engine] SYSTEM_SIGNAL_SIGKILL: Terminating ${analysisRegistry.size} active process(es)...`
  );

  const tasks = Array.from(analysisRegistry.entries());
  tasks.forEach(([child]) => abortedPids.add(child.pid));

  // Mark active tasks as aborted immediately so UI does not display "Exit code 1".
  analysisRegistry.clear();
  tasks.forEach(([_, rejecter]) => rejecter(new Error("Aborted")));

  await Promise.all(
    tasks.map(async ([child]) => {
      await Promise.all([
        invoke("terminate_process_tree", { pid: child.pid }).catch((e) =>
          console.warn("[Engine] Process tree cleanup warning:", e)
        ),
        child.kill().catch((e) => console.warn("[Engine] Process cleanup warning:", e)),
      ]);
      abortedPids.delete(child.pid);
    })
  );
};

export const useRAnalysis = () => {
  const [isRunning, setIsRunning] = useState(false);
  const { addLog, incrementProcess, decrementProcess } = useLogStore();

  const spawnTrackedCommand = useCallback(
    async (
      command: Command<string>,
      streamTag: string,
      dispatchLog: string,
      hooks?: StreamHooks
    ) => {
      setIsRunning(true);
      incrementProcess();

      return new Promise<void>(async (resolve, reject) => {
        let childInstance: Child | null = null;
        let done = false;

        const handleTaskEnd = (err?: Error) => {
          if (done) return;
          done = true;
          if (childInstance) analysisRegistry.delete(childInstance);
          decrementProcess();
          setIsRunning(false);
          if (err) reject(err);
          else resolve();
        };

        try {
          addLog("command", dispatchLog);

          command.stdout.on("data", (line) => {
            if (childInstance && abortedPids.has(childInstance.pid)) return;
            if (hooks?.onStdout) {
              hooks.onStdout(line, childInstance);
              return;
            }
            addLog("info", `[${streamTag}-Out]: ${line}`);
          });

          command.stderr.on("data", (line) => {
            if (childInstance && abortedPids.has(childInstance.pid)) return;
            if (hooks?.onStderr) {
              hooks.onStderr(line, childInstance);
              return;
            }
            const normalized = line.toLowerCase().trim();
            if (normalized.includes("error") || normalized.includes("failed")) {
              addLog("error", `[${streamTag}-Stderr]: ${line}`);
              return;
            }
            addLog("info", `[${streamTag}-Stderr]: ${line}`);
          });

          command.on("close", (data) => {
            if (childInstance && analysisRegistry.has(childInstance)) {
              if (abortedPids.has(childInstance.pid)) {
                handleTaskEnd(new Error("Aborted"));
                return;
              }
              if (data.code === 0) handleTaskEnd();
              else handleTaskEnd(new Error(`Exit code ${data.code}`));
            }
          });

          command.on("error", (err) => {
            const rawErr = String(err || "");
            const normalized = rawErr.toLowerCase();

            // Some Windows tools emit non-UTF8 chunks even when process succeeds.
            // Do not treat this decode issue as a fatal process failure.
            if (normalized.includes("invalid utf-8 sequence")) {
              addLog(
                "info",
                `[${streamTag}] Non-UTF8 output chunk skipped by shell decoder: ${rawErr}`
              );
              return;
            }

            handleTaskEnd(new Error(`Process Error: ${err}`));
          });

          childInstance = await command.spawn();
          analysisRegistry.set(childInstance, handleTaskEnd);
        } catch (error: any) {
          handleTaskEnd(error);
        }
      });
    },
    [addLog, decrementProcess, incrementProcess]
  );

  const runRScript = useCallback(
    async (scriptId: string, args: string[] = []) => {
      return new Promise<void>(async (resolve, reject) => {
        let tempScriptPath = "";

        try {
          tempScriptPath = await invoke<string>("prepare_secure_script", {
            scriptId,
          });

          const command = Command.create("r-engine", [tempScriptPath, ...args]);

          await spawnTrackedCommand(
            command,
            "R",
            "[Engine] Dispatching R-analytics engine...",
            {
              onStderr: (line) => {
                const normalized = line.toLowerCase().trim();
                const raw = line.trim();

                const isWarningHeader =
                  normalized === "warning message:" ||
                  normalized === "warning messages:";
                const isDataTableBuildNotice =
                  raw.includes("data.table") &&
                  (normalized.includes("built under r version") ||
                    raw.includes("\u5efa\u9020") ||
                    raw.includes("\u7248\u672c"));

                if (isWarningHeader || isDataTableBuildNotice) {
                  return;
                }

                if (normalized.includes("error") || raw.includes("\u9519\u8bef")) {
                  addLog("error", `[R-Stderr]: ${line}`);
                  return;
                }

                addLog("info", `[R-Stderr]: ${line}`);
              },
            }
          );
          resolve();
        } catch (error: any) {
          reject(error);
        } finally {
          if (tempScriptPath) {
            invoke("cleanup_secure_script", { path: tempScriptPath }).catch(() => {});
          }
        }
      });
    },
    [addLog, spawnTrackedCommand]
  );

  const runShellCommand = useCallback(
    async (
      commandName: string,
      args: string[] = [],
      options: ShellRunOptions = {}
    ) => {
      const spawnOptions: SpawnOptions = {};
      if (options.cwd) spawnOptions.cwd = options.cwd;
      if (options.env) spawnOptions.env = options.env;
      if (options.encoding) spawnOptions.encoding = options.encoding;

      const command = Command.create(commandName, args, spawnOptions);
      const label = options.label ?? commandName;
      await spawnTrackedCommand(
        command,
        label,
        `[Engine] Dispatching ${label}...`,
        {
          onStdout: options.onStdout,
          onStderr: options.onStderr,
        }
      );
    },
    [spawnTrackedCommand]
  );

  return { runRScript, runShellCommand, isRunning };
};
