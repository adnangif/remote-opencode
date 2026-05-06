import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { checkServerHealth, waitForServer, startServer } from "../src/server.js";
import { setConfigDir } from "../src/config.js";

const TMP_DIR = path.join(os.tmpdir(), "opencode-remote-server-test-" + process.pid);

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  setConfigDir(TMP_DIR);
});

afterEach(() => {
  setConfigDir(null);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function makeMockChild(pid = 12345) {
  const child = new EventEmitter() as any;
  child.pid = pid;
  child.kill = vi.fn();
  child.killed = false;
  return child;
}

describe("checkServerHealth", () => {
  it("returns true when server responds OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect(await checkServerHealth("localhost", 4096)).toBe(true);
  });

  it("returns false on connection refused", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await checkServerHealth("localhost", 4096)).toBe(false);
  });

  it("returns false on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await checkServerHealth("localhost", 4096)).toBe(false);
  });

  it("constructs correct URL with hostname and port", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await checkServerHealth("myhost", 5000);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://myhost:5000/global/health",
      expect.any(Object)
    );
  });

  it("uses an AbortSignal with 5s timeout", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: any) => {
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      expect(opts.signal.aborted).toBe(false);
      return { ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    await checkServerHealth("localhost", 4096);
  });

  it("clears the timeout timer on successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    await checkServerHealth("localhost", 4096);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("aborts request after 5s timeout", async () => {
    vi.useFakeTimers();
    let abortSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, opts: any) => {
        abortSignal = opts.signal;
        return new Promise((resolve) => {
          const onAbort = () => resolve({ ok: false });
          opts.signal.addEventListener("abort", onAbort, { once: true });
        });
      })
    );

    const promise = checkServerHealth("localhost", 4096);
    vi.advanceTimersByTime(5000);
    const result = await promise;

    expect(result).toBe(false);
    expect(abortSignal?.aborted).toBe(true);

    vi.useRealTimers();
  });
});

describe("waitForServer", () => {
  it("returns true when health check passes on first try", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect(await waitForServer("localhost", 4096)).toBe(true);
  });

  it("retries multiple times before success", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) return { ok: false, status: 503 };
        return { ok: true };
      })
    );
    const result = await waitForServer("localhost", 4096);
    expect(result).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(3);
  });

  it("returns false after timeout when server never responds OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const start = Date.now();
    const result = await waitForServer("localhost", 4096);
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(29000);
  }, 35000);
});

describe("startServer", () => {
  it("spawns opencode web with correct args, env vars, and cwd", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(mockChild);

    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "test-token",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    const result = await startServer(config, "/tmp/my-project");

    expect(spawnMock).toHaveBeenCalledWith(
      "opencode",
      ["web", "--hostname", "localhost", "--port", "4096"],
      expect.objectContaining({ cwd: "/tmp/my-project" })
    );
    expect(result.username).toHaveLength(16);
    expect(result.password).toHaveLength(32);
    expect(result.child).toBe(mockChild);
    expect(config.pid).toBe(12345);
    expect(config.username).toBe(result.username);
    expect(config.password).toBe(result.password);
  });

  it("passes OPENCODE_SERVER_USERNAME and PASSWORD matching generated credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(mockChild);

    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "t",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    const result = await startServer(config, "/tmp");

    const spawnCall = spawnMock.mock.calls[0];
    const env = spawnCall[2].env;
    expect(env.OPENCODE_SERVER_USERNAME).toHaveLength(16);
    expect(env.OPENCODE_SERVER_PASSWORD).toHaveLength(32);
    expect(env.OPENCODE_SERVER_USERNAME).toMatch(/^[0-9a-f]{16}$/);
    expect(env.OPENCODE_SERVER_PASSWORD).toMatch(/^[0-9a-f]{32}$/);
  });

  it("spawns with detached: false and stdio: ignore", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(mockChild);

    await startServer(
      { hostname: "localhost", port: 4096, ngrokAuthtoken: "t", pid: null, username: null, password: null, ngrokUrl: null },
      "/tmp"
    );

    const spawnCall = spawnMock.mock.calls[0];
    expect(spawnCall[2].detached).toBe(false);
    expect(spawnCall[2].stdio).toBe("ignore");
  });

  it("throws error when server never becomes healthy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue(mockChild);

    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "t",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    await expect(startServer(config, "/tmp")).rejects.toThrow(
      "opencode web server did not start within 30 seconds"
    );
  }, 35000);

  it("kills child process when health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue(mockChild);

    try {
      await startServer(
        { hostname: "localhost", port: 4096, ngrokAuthtoken: "t", pid: null, username: null, password: null, ngrokUrl: null },
        "/tmp"
      );
    } catch {}

    expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
  }, 35000);

  it("saves config to disk with pid and credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue(mockChild);

    const config = {
      hostname: "localhost",
      port: 4096,
      ngrokAuthtoken: "t",
      pid: null,
      username: null,
      password: null,
      ngrokUrl: null,
    };

    await startServer(config, "/tmp");

    const { loadConfig } = await import("../src/config.js");
    const saved = loadConfig();
    expect(saved.pid).toBe(12345);
    expect(saved.username).toBe(config.username);
    expect(saved.password).toBe(config.password);
  });
});
