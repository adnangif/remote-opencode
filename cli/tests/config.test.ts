import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  saveConfig,
  clearDynamicFields,
  generateCredentials,
  isPidAlive,
  setConfigDir,
  getConfigPath,
  promptNgrokAuthtoken,
  type Config,
} from "../src/config.js";

const TMP_DIR = path.join(os.tmpdir(), "opencode-remote-test-" + process.pid);
const CONFIG_FILENAME = ".opencode-proxy.json";

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  setConfigDir(TMP_DIR);
});

afterEach(() => {
  setConfigDir(null);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const fullConfig: Config = {
  hostname: "0.0.0.0",
  port: 5000,
  ngrokAuthtoken: "test-token",
  pid: 123,
  username: "user",
  password: "pass",
  ngrokUrl: "https://test.ngrok-free.app",
};

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const config = loadConfig();
    expect(config).toEqual({
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: null,
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    });
  });

  it("reads existing config file from disk", () => {
    fs.writeFileSync(
      path.join(TMP_DIR, CONFIG_FILENAME),
      JSON.stringify(fullConfig)
    );
    const config = loadConfig();
    expect(config).toEqual(fullConfig);
  });

  it("throws on corrupt/invalid JSON in config file", () => {
    fs.writeFileSync(path.join(TMP_DIR, CONFIG_FILENAME), "{invalid json");
    expect(() => loadConfig()).toThrow();
  });

  it("throws on empty file", () => {
    fs.writeFileSync(path.join(TMP_DIR, CONFIG_FILENAME), "");
    expect(() => loadConfig()).toThrow();
  });
});

describe("saveConfig", () => {
  it("creates the file if it doesn't exist", () => {
    const configPath = path.join(TMP_DIR, CONFIG_FILENAME);
    expect(fs.existsSync(configPath)).toBe(false);
    saveConfig({ ...fullConfig });
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("overwrites existing content completely", () => {
    const configPath = path.join(TMP_DIR, CONFIG_FILENAME);
    const first: Config = { ...fullConfig, hostname: "first-host" };
    const second: Config = { ...fullConfig, hostname: "second-host" };
    saveConfig(first);
    saveConfig(second);
    const loaded = loadConfig();
    expect(loaded.hostname).toBe("second-host");
  });

  it("writes valid JSON and loadConfig round-trips correctly", () => {
    const config: Config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "abc123",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded).toEqual(config);
  });

  it("preserves all fields on write", () => {
    saveConfig(fullConfig);
    const loaded = loadConfig();
    expect(loaded).toEqual(fullConfig);
  });
});

describe("clearDynamicFields", () => {
  it("sets pid/username/password/ngrokUrl to null while preserving static fields", () => {
    saveConfig(fullConfig);
    clearDynamicFields();
    const loaded = loadConfig();
    expect(loaded.hostname).toBe("0.0.0.0");
    expect(loaded.port).toBe(5000);
    expect(loaded.ngrokAuthtoken).toBe("test-token");
    expect(loaded.pid).toBeNull();
    expect(loaded.username).toBeNull();
    expect(loaded.password).toBeNull();
    expect(loaded.ngrokUrl).toBeNull();
  });

  it("accepts custom configPath", () => {
    const customPath = path.join(TMP_DIR, "custom-config.json");
    fs.writeFileSync(customPath, JSON.stringify(fullConfig));
    clearDynamicFields(customPath);
    const loaded = JSON.parse(fs.readFileSync(customPath, "utf-8"));
    expect(loaded.pid).toBeNull();
    expect(loaded.username).toBeNull();
    expect(loaded.password).toBeNull();
    expect(loaded.ngrokUrl).toBeNull();
    expect(loaded.ngrokAuthtoken).toBe("test-token");
  });

  it("does nothing when default config file doesn't exist", () => {
    expect(() => clearDynamicFields()).not.toThrow();
    const configPath = path.join(TMP_DIR, CONFIG_FILENAME);
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it("does nothing when custom configPath doesn't exist", () => {
    const customPath = path.join(TMP_DIR, "nonexistent.json");
    expect(() => clearDynamicFields(customPath)).not.toThrow();
    expect(fs.existsSync(customPath)).toBe(false);
  });
});

describe("setConfigDir / getConfigPath", () => {
  it("uses custom dir when set", () => {
    setConfigDir("/custom");
    expect(getConfigPath()).toBe(`/custom/${CONFIG_FILENAME}`);
    setConfigDir(null);
  });

  it("resets to home directory when set to null", () => {
    setConfigDir("/custom");
    expect(getConfigPath()).toBe(`/custom/${CONFIG_FILENAME}`);
    setConfigDir(null);
    expect(getConfigPath()).toBe(path.join(os.homedir(), CONFIG_FILENAME));
  });
});

describe("generateCredentials", () => {
  it("returns different values each call", () => {
    const a = generateCredentials();
    const b = generateCredentials();
    expect(a.username).not.toBe(b.username);
    expect(a.password).not.toBe(b.password);
  });

  it("produces username of 16 chars and password of 32 chars", () => {
    const creds = generateCredentials();
    expect(creds.username).toHaveLength(16);
    expect(creds.password).toHaveLength(32);
  });
});

describe("isPidAlive", () => {
  it("returns true for current process", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it("returns false for a dead PID", () => {
    expect(isPidAlive(999999)).toBe(false);
  });
});


