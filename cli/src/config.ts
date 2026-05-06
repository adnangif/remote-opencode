import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createInterface } from "node:readline";

export interface Config {
  hostname: string;
  port: number;
  ngrokAuthtoken: string | null;
  pid: number | null;
  username: string | null;
  password: string | null;
  ngrokUrl: string | null;
}

export const CONFIG_FILENAME = ".opencode-proxy.json";

let _configDir: string | null = null;

export function setConfigDir(dir: string | null): void {
  _configDir = dir;
}

export function getConfigPath(): string {
  const dir = _configDir ?? os.homedir();
  return path.join(dir, CONFIG_FILENAME);
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: null,
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function clearDynamicFields(configPath?: string): void {
  const target = configPath ?? getConfigPath();
  let config: Config;
  try {
    config = JSON.parse(fs.readFileSync(target, "utf-8")) as Config;
  } catch {
    return;
  }
  config.pid = null;
  config.username = null;
  config.password = null;
  config.ngrokUrl = null;
  fs.writeFileSync(target, JSON.stringify(config, null, 2) + "\n", "utf-8");
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

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
