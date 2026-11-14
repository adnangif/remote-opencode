import { spawn, execFile } from "node:child_process";
import { Config, saveConfig, generateCredentials } from "./config.js";
import { killProcess } from "./process-utils.js";

export { isProcessAlive } from "./process-utils.js";

const START_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 1_000;
const MIN_OPENCODE_MAJOR = 2;

export function checkOpencodeVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("opencode", ["--version"], { timeout: 15_000 }, (error, stdout) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new Error("opencode is not installed. Install it from https://opencode.ai"));
          return;
        }
        reject(new Error(`Failed to run 'opencode --version': ${error.message}`));
        return;
      }
      const match = stdout.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (!match) {
        reject(new Error(`Could not parse opencode version from: ${stdout.trim()}`));
        return;
      }
      const version = `${match[1]}.${match[2]}.${match[3]}`;
      if (Number(match[1]) < MIN_OPENCODE_MAJOR) {
        reject(new Error(`opencode v${MIN_OPENCODE_MAJOR}+ is required (found v${version}). Run 'opencode upgrade'.`));
        return;
      }
      resolve(version);
    });
  });
}

export async function isServerReachable(hostname: string, port: number): Promise<boolean> {
  try {
    const url = `http://${hostname}:${port}/api/info`;
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
    const url = `http://${hostname}:${port}/api/info`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const headers: Record<string, string> = {};
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    // Unknown routes fall back to the web UI's HTML, so require the JSON server info.
    return res.ok && (res.headers.get("content-type") ?? "").includes("application/json");
  } catch {
    return false;
  }
}

export async function startServer(config: Config, cwd: string): Promise<void> {
  // opencode v2 always requires a password. For tailscale, the local proxy
  // injects it so the tailnet keeps password-less access.
  const { username, password } = generateCredentials();

  const env: Record<string, string | undefined> = {
    ...process.env,
    BROWSER: "none",
    OPENCODE_SERVER_PASSWORD: password,
  };
  // OPENCODE_PASSWORD takes precedence over OPENCODE_SERVER_PASSWORD in v2.
  delete env.OPENCODE_PASSWORD;
  delete env.OPENCODE_SERVER_USERNAME;

  const child = spawn("opencode", ["serve", "--hostname", config.hostname, "--port", String(config.port)], {
    cwd,
    env,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  config.opencodePid = child.pid!;
  config.username = username;
  config.password = password;
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
