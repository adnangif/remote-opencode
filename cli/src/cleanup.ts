import { ChildProcess } from "node:child_process";
import { stopTunnel } from "./tunnel.js";
import { clearDynamicFields, Config } from "./config.js";

export async function cleanup(
  serverProcess: ChildProcess | null,
  ngrokStarted: boolean,
  config: Config
): Promise<void> {
  if (ngrokStarted) {
    await stopTunnel();
  }

  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {
      // already dead
    }
  }

  clearDynamicFields();
}
