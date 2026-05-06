import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const TMP_DIR = path.join(os.tmpdir(), "opencode-remote-watchdog-test-" + process.pid);
const CONFIG_PATH = path.join(TMP_DIR, ".opencode-proxy.json");
const WATCHDOG_PATH = path.join(import.meta.dirname, "..", "dist", "watchdog.js");

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const sampleConfig = {
  hostname: "localhost",
  port: 4096,
  ngrokAuthtoken: "test-token",
  pid: 1234,
  username: "testuser",
  password: "testpass",
  ngrokUrl: "https://test.ngrok-free.app",
};

describe("watchdog", () => {
  it("exits with code 1 if no arguments provided", async () => {
    const child = spawn("node", [WATCHDOG_PATH], { stdio: "ignore" });
    const code = await new Promise<number | null>((resolve) => {
      child.on("exit", (c) => resolve(c));
    });
    expect(code).toBe(1);
  });

  it("exits with code 1 if only parentPid is provided (missing serverPid and configPath)", async () => {
    const child = spawn("node", [WATCHDOG_PATH, "12345"], { stdio: "ignore" });
    const code = await new Promise<number | null>((resolve) => {
      child.on("exit", (c) => resolve(c));
    });
    expect(code).toBe(1);
  });

  it("exits with code 1 if parentPid is 0 (falsy)", async () => {
    const child = spawn("node", [WATCHDOG_PATH, "0", "999", CONFIG_PATH], { stdio: "ignore" });
    const code = await new Promise<number | null>((resolve) => {
      child.on("exit", (c) => resolve(c));
    });
    expect(code).toBe(1);
  });

  it("kills server process and clears config when parent dies", async () => {
    const serverChild = spawn("node", ["-e", "setInterval(()=>{}, 60000)"], { stdio: "ignore" });
    const serverPid = serverChild.pid!;

    const parentChild = spawn("node", ["-e", "setTimeout(()=>process.exit(0), 1000)"], { stdio: "ignore" });
    const parentPid = parentChild.pid!;

    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...sampleConfig, pid: serverPid }));

    spawn("node", [WATCHDOG_PATH, String(parentPid), String(serverPid), CONFIG_PATH], {
      detached: true,
      stdio: "ignore",
    }).unref();

    await new Promise((r) => setTimeout(r, 15000));

    const cleared = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    expect(cleared.pid).toBeNull();
    expect(cleared.username).toBeNull();
    expect(cleared.password).toBeNull();
    expect(cleared.ngrokUrl).toBeNull();
    expect(cleared.ngrokAuthtoken).toBe("test-token");
    expect(cleared.hostname).toBe("localhost");
    expect(cleared.port).toBe(4096);

    try { process.kill(serverPid, 0); expect.unreachable("server should be dead"); } catch {}
  }, 20000);

  it("does nothing while parent is alive", async () => {
    const dummyServer = spawn("node", ["-e", "setInterval(()=>{}, 60000)"], { stdio: "ignore" });
    const dummyServerPid = dummyServer.pid!;

    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...sampleConfig, pid: dummyServerPid }));

    const watchdog = spawn(
      "node",
      [WATCHDOG_PATH, String(process.pid), String(dummyServerPid), CONFIG_PATH],
      { detached: true, stdio: "ignore" }
    );
    watchdog.unref();

    await new Promise((r) => setTimeout(r, 2000));

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    expect(config.pid).toBe(dummyServerPid);
    expect(config.username).toBe("testuser");
    expect(config.password).toBe("testpass");
    expect(config.ngrokUrl).toBe("https://test.ngrok-free.app");

    try { process.kill(watchdog.pid!, "SIGKILL"); } catch {}
    try { process.kill(dummyServerPid, "SIGKILL"); } catch {}
  }, 10000);

  it("handles corrupt config file gracefully when parent dies", async () => {
    const serverChild = spawn("node", ["-e", "setInterval(()=>{}, 60000)"], { stdio: "ignore" });
    const serverPid = serverChild.pid!;

    const parentChild = spawn("node", ["-e", "setTimeout(()=>process.exit(0), 1000)"], { stdio: "ignore" });
    const parentPid = parentChild.pid!;

    fs.writeFileSync(CONFIG_PATH, "{invalid json");

    spawn("node", [WATCHDOG_PATH, String(parentPid), String(serverPid), CONFIG_PATH], {
      detached: true,
      stdio: "ignore",
    }).unref();

    await new Promise((r) => setTimeout(r, 15000));

    expect(fs.existsSync(CONFIG_PATH)).toBe(true);
    expect(fs.readFileSync(CONFIG_PATH, "utf-8")).toBe("{invalid json");

    try { process.kill(serverPid, "SIGKILL"); } catch {}
  }, 20000);

  it("preserves all static fields when clearing config", async () => {
    const serverChild = spawn("node", ["-e", "setInterval(()=>{}, 60000)"], { stdio: "ignore" });
    const serverPid = serverChild.pid!;

    const parentChild = spawn("node", ["-e", "setTimeout(()=>process.exit(0), 1000)"], { stdio: "ignore" });
    const parentPid = parentChild.pid!;

    const customConfig = {
      hostname: "custom-host",
      port: 9999,
      ngrokAuthtoken: "custom-token",
      pid: serverPid,
      username: "u",
      password: "p",
      ngrokUrl: "https://custom.ngrok-free.app",
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(customConfig));

    spawn("node", [WATCHDOG_PATH, String(parentPid), String(serverPid), CONFIG_PATH], {
      detached: true,
      stdio: "ignore",
    }).unref();

    await new Promise((r) => setTimeout(r, 15000));

    const cleared = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    expect(cleared.hostname).toBe("custom-host");
    expect(cleared.port).toBe(9999);
    expect(cleared.ngrokAuthtoken).toBe("custom-token");

    try { process.kill(serverPid, "SIGKILL"); } catch {}
  }, 20000);
});
