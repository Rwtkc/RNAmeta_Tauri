import { invoke } from "@tauri-apps/api/core";
import { Child, Command, SpawnOptions } from "@tauri-apps/plugin-shell";
import { useLogStore } from "@/store/useLogStore";

const activeChildren = new Map<Child, (reason: Error) => void>();
const abortedPids = new Set<number>();

interface RunShellOptions {
  cwd?: string;
  env?: Record<string, string>;
  encoding?: string;
  label?: string;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  captureOutput?: boolean;
}

export const abortAnalysis = async () => {
  const { addLog } = useLogStore.getState();
  if (activeChildren.size === 0) {
    return;
  }

  addLog("command", `[Engine] Aborting ${activeChildren.size} active process(es).`);
  const children = Array.from(activeChildren.entries());
  activeChildren.clear();

  await Promise.all(
    children.map(async ([child, rejecter]) => {
      abortedPids.add(child.pid);
      rejecter(new Error("Aborted"));
      await Promise.all([
        invoke("terminate_process_tree", { pid: child.pid }).catch(() => null),
        child.kill().catch(() => null)
      ]);
      abortedPids.delete(child.pid);
    })
  );
};

export function useRAnalysis() {
  const {
    activeProcessCount,
    addLog,
    incrementProcess,
    decrementProcess,
    setExpanded
  } = useLogStore();
  const isRunning = activeProcessCount > 0;

  async function runShellCommand(
    commandName: string,
    args: string[] = [],
    options: RunShellOptions = {}
  ) {
    const spawnOptions: SpawnOptions = {};
    if (options.cwd) spawnOptions.cwd = options.cwd;
    if (options.env) spawnOptions.env = options.env;
    if (options.encoding) spawnOptions.encoding = options.encoding;

    const command = Command.create(commandName, args, spawnOptions);
    incrementProcess();
    setExpanded(true);
    addLog("command", `[Engine] Dispatching ${options.label ?? commandName}`);

    return new Promise<void>(async (resolve, reject) => {
      let childInstance: Child | null = null;
      let finished = false;

      const done = (error?: Error) => {
        if (finished) return;
        finished = true;
        if (childInstance) {
          activeChildren.delete(childInstance);
        }
        decrementProcess();
        if (useLogStore.getState().activeProcessCount === 0) {
          setExpanded(false);
        }
        if (error) reject(error);
        else resolve();
      };

      command.stdout.on("data", (line) => {
        if (childInstance && abortedPids.has(childInstance.pid)) return;
        if (options.captureOutput !== false) {
          addLog("info", `[stdout] ${line}`);
        }
        options.onStdout?.(line);
      });

      command.stderr.on("data", (line) => {
        if (childInstance && abortedPids.has(childInstance.pid)) return;
        if (options.captureOutput !== false) {
          const normalized = line.toLowerCase();
          addLog(
            normalized.includes("error") || normalized.includes("failed")
              ? "error"
              : "info",
            `[stderr] ${line}`
          );
        }
        options.onStderr?.(line);
      });

      command.on("error", (error) => {
        const text = String(error);
        if (text.toLowerCase().includes("invalid utf-8 sequence")) {
          addLog("info", "[Engine] Skipped a non-UTF8 output chunk.");
          return;
        }
        done(new Error(text));
      });

      command.on("close", (data) => {
        if (childInstance && abortedPids.has(childInstance.pid)) {
          done(new Error("Aborted"));
          return;
        }
        if (data.code === 0) done();
        else done(new Error(`Exit code ${data.code}`));
      });

      try {
        childInstance = await command.spawn();
        activeChildren.set(childInstance, (reason) => done(reason));
      } catch (error) {
        done(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  return { isRunning, runShellCommand };
}
