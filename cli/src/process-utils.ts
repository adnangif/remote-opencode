import { fork, ChildProcess } from "node:child_process";

export function send(msg: object): void {
  if (process.send) process.send(msg);
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcess(pid: number | null): void {
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
}

export type IpcError = { type: "error"; message: string };

export function waitForIpcMessage<T extends { type: string }>(
  child: ChildProcess,
  label: string
): Promise<T | IpcError> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${label} did not respond within 30 seconds`));
    }, 30_000);

    child.on("message", (msg: T | IpcError) => {
      clearTimeout(timer);
      resolve(msg);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`${label} exited with code ${code}`));
    });
  });
}
