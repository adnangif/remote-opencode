import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config, saveConfig } from "./config.js";
import { killProcess, waitForIpcMessage } from "./process-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TunnelReady = { type: "ready"; url: string };

export async function startTunnel(config: Config): Promise<void> {
  const workerPath = path.join(__dirname, "tunnel-worker.js");
  const child = fork(workerPath, [config.ngrokAuthtoken!, config.hostname, String(config.port)], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.unref();

  const msg = await waitForIpcMessage<TunnelReady>(child, "Tunnel worker");

  if (msg.type === "error") {
    throw new Error(msg.message);
  }

  config.tunnelWorkerPid = child.pid!;
  config.ngrokUrl = msg.url;
  saveConfig(config);
}

export function stopTunnel(config: Config): void {
  killProcess(config.tunnelWorkerPid);
  config.tunnelWorkerPid = null;
  config.ngrokUrl = null;
  saveConfig(config);
}
