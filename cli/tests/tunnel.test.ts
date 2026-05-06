import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { startTunnel, stopTunnel } from "../src/tunnel.js";
import { setConfigDir, loadConfig } from "../src/config.js";

const TMP_DIR = path.join(os.tmpdir(), "opencode-remote-tunnel-test-" + process.pid);

vi.mock("@ngrok/ngrok", () => ({
  default: {
    forward: vi.fn().mockResolvedValue({
      url: () => "https://test.ngrok-free.app",
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  setConfigDir(TMP_DIR);
});

afterEach(() => {
  setConfigDir(null);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("startTunnel", () => {
  it("calls ngrok.forward with correct addr and authtoken", async () => {
    const ngrok = (await import("@ngrok/ngrok")).default;
    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "my-ngrok-token",
      pid: null,
      username: "user",
      password: "pass",
      ngrokUrl: null,
    };

    await startTunnel(config);

    expect(ngrok.forward).toHaveBeenCalledWith({
      addr: 4096,
      authtoken: "my-ngrok-token",
    });
  });

  it("passes config port as addr (not hardcoded)", async () => {
    const ngrok = (await import("@ngrok/ngrok")).default;
    const config = {
      hostname: "localhost",
      port: 5000,
      ngrokAuthtoken: "tok",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    await startTunnel(config);

    expect(ngrok.forward).toHaveBeenCalledWith(
      expect.objectContaining({ addr: 5000 })
    );
  });

  it("returns the URL from listener.url()", async () => {
    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "tok",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    const url = await startTunnel(config);
    expect(url).toBe("https://test.ngrok-free.app");
  });

  it("saves URL to config object in memory", async () => {
    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "tok",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    await startTunnel(config);
    expect(config.ngrokUrl).toBe("https://test.ngrok-free.app");
  });

  it("saves URL to config file on disk", async () => {
    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "tok",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    await startTunnel(config);
    const saved = loadConfig();
    expect(saved.ngrokUrl).toBe("https://test.ngrok-free.app");
  });
});

describe("stopTunnel", () => {
  it("calls ngrok.disconnect without throwing", async () => {
    const ngrok = (await import("@ngrok/ngrok")).default;
    await expect(stopTunnel()).resolves.toBeUndefined();
    expect(ngrok.disconnect).toHaveBeenCalled();
  });

  it("handles ngrok.disconnect throwing an error", async () => {
    const ngrok = (await import("@ngrok/ngrok")).default;
    vi.mocked(ngrok.disconnect).mockRejectedValueOnce(new Error("not connected"));
    await expect(stopTunnel()).resolves.toBeUndefined();
  });
});
