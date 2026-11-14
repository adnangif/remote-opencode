import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createInterface } from "node:readline";

export interface Config {
  hostname: string;
  port: number;
  tunnelProvider: "ngrok" | "tailscale";
  ngrokAuthtoken: string | null;
  username: string | null;
  password: string | null;
  ngrokUrl: string | null;
  tailscaleUrl: string | null;
  tunnelWorkerPid: number | null;
  proxyWorkerPid: number | null;
  opencodePid: number | null;
}

// opencode v2 ignores OPENCODE_SERVER_USERNAME; basic auth always uses this username.
export const SERVER_USERNAME = "opencode";

export function getProxyPort(config: Config): number {
  return config.port + 1;
}

export function getTunnelUrl(config: Config): string | null {
  return config.tunnelProvider === "tailscale" ? config.tailscaleUrl : config.ngrokUrl;
}

export const CONFIG_FILENAME = ".opencode-proxy.json";

export function getConfigPath(): string {
  return path.join(os.homedir(), CONFIG_FILENAME);
}

const DEFAULT_CONFIG: Config = {
  hostname: "localhost",
  port: 4096,
  tunnelProvider: "ngrok",
  ngrokAuthtoken: null,
  username: null,
  password: null,
  ngrokUrl: null,
  tailscaleUrl: null,
  tunnelWorkerPid: null,
  proxyWorkerPid: null,
  opencodePid: null,
};

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Config>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function generateCredentials(): { username: string; password: string } {
  return {
    username: SERVER_USERNAME,
    password: crypto.randomBytes(16).toString("hex"),
  };
}

export async function promptNgrokAuthtoken(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your ngrok authtoken: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function maskToken(token: string, visibleCount: number = 10): string {
  if (token.length <= visibleCount) return token;
  return token.slice(0, visibleCount) + "*".repeat(token.length - visibleCount);
}

export async function promptMasked(question: string, currentValue: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const suffix = currentValue ? ` (${maskToken(currentValue)})` : "";
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptWithDefault(question: string, defaultValue: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}
