import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

const mockLoadConfig = vi.fn();
const mockSaveConfig = vi.fn();
const mockPromptNgrokAuthtoken = vi.fn();
const mockIsPidAlive = vi.fn();
const mockClearDynamicFields = vi.fn();
const mockSetConfigDir = vi.fn();

vi.mock("../src/config.js", () => ({
  loadConfig: mockLoadConfig,
  saveConfig: mockSaveConfig,
  promptNgrokAuthtoken: mockPromptNgrokAuthtoken,
  isPidAlive: mockIsPidAlive,
  clearDynamicFields: mockClearDynamicFields,
  setConfigDir: mockSetConfigDir,
  CONFIG_FILENAME: ".opencode-proxy.json",
}));

const mockCheckServerHealth = vi.fn();
const mockStartServer = vi.fn();

vi.mock("../src/server.js", () => ({
  checkServerHealth: mockCheckServerHealth,
  startServer: mockStartServer,
  waitForServer: vi.fn().mockResolvedValue(true),
}));

const mockStartTunnel = vi.fn();

vi.mock("../src/tunnel.js", () => ({
  startTunnel: mockStartTunnel,
  stopTunnel: vi.fn().mockResolvedValue(undefined),
}));

const mockGenerateQR = vi.fn();

vi.mock("../src/qr.js", () => ({
  generateQR: mockGenerateQR,
}));

const mockAttachTUI = vi.fn();

vi.mock("../src/tui.js", () => ({
  attachTUI: mockAttachTUI,
}));

const mockCleanup = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/cleanup.js", () => ({
  cleanup: mockCleanup,
}));

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:readline", () => ({
  createInterface: vi.fn().mockReturnValue({
    question: (_prompt: string, cb: (answer: string) => void) => cb(""),
    close: vi.fn(),
  }),
}));

class MockExit extends Error {
  code: number;
  constructor(code: number) {
    super("MOCK_EXIT");
    this.code = code;
  }
}

const exitCalls: number[] = [];
process.exit = ((code?: number) => {
  exitCalls.push(code ?? 0);
  throw new MockExit(code ?? 0);
}) as typeof process.exit;

function makeMockChild(): any {
  const child = new EventEmitter() as any;
  child.pid = 99999;
  child.killed = false;
  child.kill = vi.fn();
  child.unref = vi.fn();
  return child;
}

let capturedTuiChild: any = null;

async function runMain(): Promise<void> {
  const { main } = await import("../src/index.js");
  try {
    await main();
  } catch (e) {
    if (e instanceof MockExit) return;
  }
}

const defaultConfig = {
  hostname: "localhost",
  port: 4096,
  ngrokAuthtoken: "test-token",
  pid: null,
  username: null,
  password: null,
  ngrokUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  exitCalls.length = 0;
  capturedTuiChild = null;

  mockLoadConfig.mockReturnValue({ ...defaultConfig });
  mockCheckServerHealth.mockResolvedValue(false);
  mockPromptNgrokAuthtoken.mockResolvedValue("entered-token");
  mockIsPidAlive.mockReturnValue(false);
  mockGenerateQR.mockResolvedValue(undefined);

  mockStartServer.mockImplementation(async (config: any) => {
    config.username = "u";
    config.password = "p";
    return { child: makeMockChild(), username: "u", password: "p" };
  });
  mockStartTunnel.mockImplementation(async (config: any) => {
    config.ngrokUrl = "https://t.ngrok-free.app";
    return "https://t.ngrok-free.app";
  });

  mockAttachTUI.mockImplementation(() => {
    const child = makeMockChild();
    capturedTuiChild = child;
    return child;
  });

  spawnMock.mockImplementation(() =>
    Object.assign(new EventEmitter(), {
      pid: 99999,
      killed: false,
      kill: vi.fn(),
      unref: vi.fn(),
    })
  );
});

afterEach(() => {
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
  process.removeAllListeners("SIGHUP");
});

describe("integration: main()", () => {
  describe("first run flow", () => {
    it("prompts for authtoken, starts server, starts ngrok, shows QR, attaches TUI", async () => {
      const noTokenConfig = { ...defaultConfig, ngrokAuthtoken: null };
      const afterTokenConfig = { ...noTokenConfig, ngrokAuthtoken: "entered-token" };
      mockLoadConfig
        .mockReturnValueOnce(noTokenConfig)
        .mockReturnValueOnce(afterTokenConfig)
        .mockReturnValue(afterTokenConfig);

      mockStartServer.mockImplementation(async (config: any) => {
        config.username = "abc123";
        config.password = "def456";
        return { child: makeMockChild(), username: "abc123", password: "def456" };
      });
      mockStartTunnel.mockImplementation(async (config: any) => {
        config.ngrokUrl = "https://xyz.ngrok-free.app";
        return "https://xyz.ngrok-free.app";
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockPromptNgrokAuthtoken).toHaveBeenCalled();
      expect(mockSaveConfig).toHaveBeenCalled();
      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({ ngrokAuthtoken: "entered-token" }),
        process.cwd()
      );
      expect(mockStartTunnel).toHaveBeenCalled();
      expect(mockGenerateQR).toHaveBeenCalledWith(
        expect.stringContaining("abc123:def456@xyz.ngrok-free.app")
      );
      expect(mockAttachTUI).toHaveBeenCalledWith(
        "localhost", 4096, "abc123", "def456", process.cwd()
      );

      logSpy.mockRestore();
    });

    it("exits with code 1 when empty authtoken is provided", async () => {
      mockLoadConfig.mockReturnValue({ ...defaultConfig, ngrokAuthtoken: null });
      mockPromptNgrokAuthtoken.mockResolvedValue("");

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(exitCalls).toContain(1);
      logSpy.mockRestore();
    });

    it("exits with code 1 when whitespace-only authtoken is provided", async () => {
      mockLoadConfig.mockReturnValue({ ...defaultConfig, ngrokAuthtoken: null });
      mockPromptNgrokAuthtoken.mockResolvedValue("   ");

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(exitCalls).toContain(1);
      logSpy.mockRestore();
    });
  });

  describe("second terminal flow", () => {
    it("skips server/ngrok startup, attaches TUI directly", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        pid: 1234,
        username: "existing-user",
        password: "existing-pass",
        ngrokUrl: "https://existing.ngrok-free.app",
      });
      mockCheckServerHealth.mockResolvedValue(true);
      mockIsPidAlive.mockReturnValue(true);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockStartServer).not.toHaveBeenCalled();
      expect(mockStartTunnel).not.toHaveBeenCalled();
      expect(mockGenerateQR).not.toHaveBeenCalled();
      expect(mockAttachTUI).toHaveBeenCalledWith(
        "localhost", 4096, "existing-user", "existing-pass", process.cwd()
      );

      logSpy.mockRestore();
    });

    it("does not call promptNgrokAuthtoken when token already configured", async () => {
      mockLoadConfig.mockReturnValue({ ...defaultConfig, ngrokAuthtoken: "existing" });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockPromptNgrokAuthtoken).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("non-owner exit does NOT trigger cleanup", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        pid: 1234,
        username: "user",
        password: "pass",
        ngrokUrl: "https://x.ngrok-free.app",
      });
      mockCheckServerHealth.mockResolvedValue(true);
      mockIsPidAlive.mockReturnValue(true);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockCleanup).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("stale PID handling", () => {
    it("clears dynamic fields when PID is dead, then starts fresh", async () => {
      const staleConfig = {
        ...defaultConfig,
        pid: 99999,
        username: "old-user",
        password: "old-pass",
        ngrokUrl: "https://old.ngrok-free.app",
      };
      mockLoadConfig
        .mockReturnValueOnce(staleConfig)
        .mockReturnValueOnce({ ...defaultConfig })
        .mockReturnValue({ ...defaultConfig });
      mockIsPidAlive.mockReturnValue(false);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockClearDynamicFields).toHaveBeenCalled();
      expect(mockStartServer).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("does NOT clear fields when PID is alive", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        pid: 1234,
        username: "user",
        password: "pass",
        ngrokUrl: "https://live.ngrok-free.app",
      });
      mockCheckServerHealth.mockResolvedValue(true);
      mockIsPidAlive.mockReturnValue(true);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockClearDynamicFields).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("credential validation", () => {
    it("exits with code 1 when server running but username is null", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        pid: 1234,
        username: null,
        password: "pass",
        ngrokUrl: "https://x.ngrok-free.app",
      });
      mockCheckServerHealth.mockResolvedValue(true);
      mockIsPidAlive.mockReturnValue(true);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(exitCalls).toContain(1);
      logSpy.mockRestore();
    });

    it("exits with code 1 when server running but password is null", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        pid: 1234,
        username: "user",
        password: null,
        ngrokUrl: "https://x.ngrok-free.app",
      });
      mockCheckServerHealth.mockResolvedValue(true);
      mockIsPidAlive.mockReturnValue(true);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(exitCalls).toContain(1);
      logSpy.mockRestore();
    });
  });

  describe("auth URL format", () => {
    it("builds URL as https://user:pass@host with https:// stripped from ngrok URL", async () => {
      mockStartServer.mockImplementation(async (config: any) => {
        config.username = "myuser";
        config.password = "mypass";
        return { child: makeMockChild(), username: "myuser", password: "mypass" };
      });
      mockStartTunnel.mockImplementation(async (config: any) => {
        config.ngrokUrl = "https://abc123.ngrok-free.app";
        return "https://abc123.ngrok-free.app";
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockGenerateQR).toHaveBeenCalledWith(
        "https://myuser:mypass@abc123.ngrok-free.app"
      );
      logSpy.mockRestore();
    });
  });

  describe("watchdog spawning", () => {
    it("spawns watchdog with correct arguments when starting server", async () => {
      const mockServerChild = makeMockChild();
      mockServerChild.pid = 55555;
      mockStartServer.mockImplementation(async (config: any) => {
        config.username = "u";
        config.password = "p";
        return { child: mockServerChild, username: "u", password: "p" };
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      const spawnCall = spawnMock.mock.calls.find(
        (call: any[]) => call[0] === "node" && call[1]?.some?.((a: string) => a.includes("watchdog"))
      );
      expect(spawnCall).toBeDefined();
      expect(spawnCall[1]).toContain(String(process.pid));
      expect(spawnCall[1]).toContain(String(55555));
      expect(spawnCall[1].some((a: string) => a.includes(".opencode-proxy.json"))).toBe(true);
      expect(spawnCall[2].detached).toBe(true);
      expect(spawnCall[2].stdio).toBe("ignore");

      logSpy.mockRestore();
    });
  });

  describe("cleanup on TUI exit", () => {
    it("cleanup runs when owner process exits TUI", async () => {
      const mockServerChild = makeMockChild();
      mockStartServer.mockImplementation(async (config: any) => {
        config.username = "u";
        config.password = "p";
        return { child: mockServerChild, username: "u", password: "p" };
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(capturedTuiChild).not.toBeNull();
      try { capturedTuiChild.emit("exit", 0); } catch {}

      await vi.waitFor(() => {
        expect(mockCleanup).toHaveBeenCalledWith(
          mockServerChild,
          true,
          expect.any(Object)
        );
      });
      logSpy.mockRestore();
    });
  });

  describe("first-run console messages", () => {
    it("prints 'Don't worry!' and authtoken URL on first run", async () => {
      const noTokenConfig = { ...defaultConfig, ngrokAuthtoken: null };
      const afterTokenConfig = { ...noTokenConfig, ngrokAuthtoken: "entered-token" };
      mockLoadConfig
        .mockReturnValueOnce(noTokenConfig)
        .mockReturnValueOnce(afterTokenConfig)
        .mockReturnValue(afterTokenConfig);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      const allLogs = logSpy.mock.calls.map((c) => c.join(" "));
      expect(allLogs.some((l) => l.includes("Don't worry!"))).toBe(true);
      expect(allLogs.some((l) => l.includes("ngrok.com/get-started/your-authtoken"))).toBe(true);
      logSpy.mockRestore();
    });
  });

  describe("custom hostname and port", () => {
    it("uses custom hostname and port from config throughout the flow", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        hostname: "0.0.0.0",
        port: 5000,
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({ hostname: "0.0.0.0", port: 5000 }),
        process.cwd()
      );
      expect(mockAttachTUI).toHaveBeenCalledWith(
        "0.0.0.0", 5000, "u", "p", process.cwd()
      );
      logSpy.mockRestore();
    });
  });

  describe("signal handling", () => {
    it("deduplicates signals: second SIGINT is ignored", async () => {
      const mockTuiChild = makeMockChild();
      mockTuiChild.kill = vi.fn();
      mockAttachTUI.mockImplementation(() => {
        capturedTuiChild = mockTuiChild;
        return mockTuiChild;
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      try { process.emit("SIGINT"); } catch {}
      try { process.emit("SIGINT"); } catch {}

      await vi.waitFor(() => {
        expect(mockTuiChild.kill).toHaveBeenCalledTimes(1);
      });
      logSpy.mockRestore();
    });

    it("SIGTERM triggers cleanup and kills TUI", async () => {
      const mockTuiChild = makeMockChild();
      mockTuiChild.kill = vi.fn();
      mockAttachTUI.mockImplementation(() => {
        capturedTuiChild = mockTuiChild;
        return mockTuiChild;
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      try { process.emit("SIGTERM"); } catch {}

      await vi.waitFor(() => {
        expect(mockTuiChild.kill).toHaveBeenCalledWith("SIGTERM");
      });
      logSpy.mockRestore();
    });

    it("SIGHUP triggers cleanup and kills TUI", async () => {
      const mockTuiChild = makeMockChild();
      mockTuiChild.kill = vi.fn();
      mockAttachTUI.mockImplementation(() => {
        capturedTuiChild = mockTuiChild;
        return mockTuiChild;
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      try { process.emit("SIGHUP"); } catch {}

      await vi.waitFor(() => {
        expect(mockTuiChild.kill).toHaveBeenCalledWith("SIGHUP");
      });
      logSpy.mockRestore();
    });
  });

  describe("TUI exit code", () => {
    it("passes non-zero TUI exit code to process.exit", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(capturedTuiChild).not.toBeNull();
      try { capturedTuiChild.emit("exit", 42); } catch {}

      expect(exitCalls).toContain(42);
      logSpy.mockRestore();
    });
  });

  describe("watchdog unref", () => {
    it("calls unref() on the watchdog process", async () => {
      const mockWatchdog = makeMockChild();
      const mockServerChild = makeMockChild();
      mockStartServer.mockImplementation(async (config: any) => {
        config.username = "u";
        config.password = "p";
        return { child: mockServerChild, username: "u", password: "p" };
      });
      spawnMock.mockImplementation((cmd: string) => {
        if (cmd === "node") return mockWatchdog;
        return mockServerChild;
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockWatchdog.unref).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("startTunnel failure propagation", () => {
    it("propagates startTunnel error via main().catch()", async () => {
      mockStartTunnel.mockRejectedValue(new Error("ngrok auth failed"));

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await runMain();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ngrok auth failed"));
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("generateQR failure propagation", () => {
    it("propagates generateQR error via main().catch()", async () => {
      mockGenerateQR.mockRejectedValue(new Error("QR lib error"));

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await runMain();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("QR lib error"));
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("PID alive but server not running (stale path skipped)", () => {
    it("skips stale cleanup when pid is alive, even if server health check fails", async () => {
      mockLoadConfig.mockReturnValue({
        ...defaultConfig,
        pid: 1234,
        username: null,
        password: null,
        ngrokUrl: null,
      });
      mockIsPidAlive.mockReturnValue(true);

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await runMain();

      expect(mockClearDynamicFields).not.toHaveBeenCalled();
      expect(mockStartServer).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("main().catch() logs startServer errors", async () => {
      mockStartServer.mockRejectedValue(new Error("spawn failed"));

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await runMain();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("spawn failed"));
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
