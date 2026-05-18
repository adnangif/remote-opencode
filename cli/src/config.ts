import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createInterface } from "node:readline";

export interface Config {
  hostname: string;
  port: number;
  ngrokAuthtoken: string | null;
  username: string | null;
  password: string | null;
  ngrokUrl: string | null;
  tunnelWorkerPid: number | null;
  opencodePid: number | null;
}

export const CONFIG_FILENAME = ".opencode-proxy.json";

export function getConfigPath(): string {
  return path.join(os.homedir(), CONFIG_FILENAME);
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: null,
      username: null,
      password: null,
      ngrokUrl: null,
      tunnelWorkerPid: null,
      opencodePid: null,
    };
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: null,
      username: null,
      password: null,
      ngrokUrl: null,
      tunnelWorkerPid: null,
      opencodePid: null,
    };
  }
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function generateCredentials(): { username: string; password: string } {
  return {
    username: crypto.randomBytes(8).toString("hex"),
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
    const hint = currentValue ? " [press Enter to keep existing]" : "";
    rl.question(`${question}${suffix}${hint}: `, (answer) => {
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
    const hint = defaultValue ? " [press Enter to keep existing]" : "";
    rl.question(`${question}${suffix}${hint}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}
