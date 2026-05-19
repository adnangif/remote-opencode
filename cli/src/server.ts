import { spawn } from "node:child_process";
import { Config, saveConfig, generateCredentials } from "./config.js";
import { killProcess } from "./process-utils.js";

export { isProcessAlive } from "./process-utils.js";

const START_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 1_000;

export async function isServerReachable(hostname: string, port: number): Promise<boolean> {
  try {
    const url = `http://${hostname}:${port}/global/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export async function checkServerHealth(
  hostname: string,
  port: number,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const url = `http://${hostname}:${port}/global/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const headers: Record<string, string> = {};
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function startServer(config: Config, cwd: string): Promise<void> {
  let username: string;
  let password: string;

  const env: Record<string, string | undefined> = {
    ...process.env,
    BROWSER: "none",
  };

  if (config.tunnelProvider === "tailscale") {
    username = "";
    password = "";
    delete env.OPENCODE_SERVER_USERNAME;
    delete env.OPENCODE_SERVER_PASSWORD;
  } else {
    const creds = generateCredentials();
    username = creds.username;
    password = creds.password;
    env.OPENCODE_SERVER_USERNAME = username;
    env.OPENCODE_SERVER_PASSWORD = password;
  }

  const child = spawn("opencode", ["serve", "--hostname", config.hostname, "--port", String(config.port)], {
    cwd,
    env,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  config.opencodePid = child.pid!;
  config.username = username || null;
  config.password = password || null;
  saveConfig(config);

  const start = Date.now();
  let healthy = false;
  while (Date.now() - start < START_TIMEOUT_MS) {
    healthy = await checkServerHealth(config.hostname, config.port, username, password);
    if (healthy) break;
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }

  if (!healthy) {
    killProcess(config.opencodePid);
    config.opencodePid = null;
    config.username = null;
    config.password = null;
    saveConfig(config);
    throw new Error("opencode server did not start within 30 seconds");
  }
}

export function stopServer(config: Config): void {
  killProcess(config.opencodePid);
  config.opencodePid = null;
  config.username = null;
  config.password = null;
  saveConfig(config);
}
