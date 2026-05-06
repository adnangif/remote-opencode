import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { cleanup } from "../src/cleanup.js";

vi.mock("../src/tunnel.js", () => ({
  stopTunnel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/config.js", () => ({
  clearDynamicFields: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeMockChild(killed = false) {
  const child = new EventEmitter() as any;
  child.pid = 1234;
  child.killed = killed;
  child.kill = vi.fn();
  return child;
}

describe("cleanup", () => {
  it("stops ngrok tunnel if ngrokStarted=true", async () => {
    const { stopTunnel } = await import("../src/tunnel.js");
    const { clearDynamicFields } = await import("../src/config.js");

    await cleanup(null, true, {} as any);

    expect(stopTunnel).toHaveBeenCalled();
    expect(clearDynamicFields).toHaveBeenCalled();
  });

  it("does not stop tunnel if ngrokStarted=false", async () => {
    const { stopTunnel } = await import("../src/tunnel.js");

    await cleanup(null, false, {} as any);

    expect(stopTunnel).not.toHaveBeenCalled();
  });

  it("kills server process if alive", async () => {
    const mockProcess = makeMockChild(false);

    await cleanup(mockProcess, false, {} as any);

    expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("does not kill server process if already killed", async () => {
    const mockProcess = makeMockChild(true);

    await cleanup(mockProcess, false, {} as any);

    expect(mockProcess.kill).not.toHaveBeenCalled();
  });

  it("does not kill server process if null", async () => {
    const { stopTunnel } = await import("../src/tunnel.js");

    await cleanup(null, false, {} as any);

    expect(stopTunnel).not.toHaveBeenCalled();
  });

  it("always calls clearDynamicFields regardless of other conditions", async () => {
    const { clearDynamicFields } = await import("../src/config.js");

    await cleanup(null, false, {} as any);
    expect(clearDynamicFields).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    await cleanup(makeMockChild(false), true, {} as any);
    expect(clearDynamicFields).toHaveBeenCalledTimes(1);
  });

  it("handles serverProcess.kill throwing without crashing", async () => {
    const mockProcess = makeMockChild(false);
    mockProcess.kill.mockImplementation(() => {
      throw new Error("ESRCH");
    });

    await expect(cleanup(mockProcess, false, {} as any)).resolves.toBeUndefined();
  });

  it("with both server and ngrok running: stops tunnel, kills server, clears config", async () => {
    const { stopTunnel } = await import("../src/tunnel.js");
    const { clearDynamicFields } = await import("../src/config.js");
    const mockProcess = makeMockChild(false);

    await cleanup(mockProcess, true, {} as any);

    expect(stopTunnel).toHaveBeenCalled();
    expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
    expect(clearDynamicFields).toHaveBeenCalled();
  });

  it("with neither running: only clears config", async () => {
    const { stopTunnel } = await import("../src/tunnel.js");
    const { clearDynamicFields } = await import("../src/config.js");

    await cleanup(null, false, {} as any);

    expect(stopTunnel).not.toHaveBeenCalled();
    expect(clearDynamicFields).toHaveBeenCalled();
  });

  it("propagates stopTunnel rejection (no try/catch around it)", async () => {
    const { stopTunnel } = await import("../src/tunnel.js");
    (stopTunnel as any).mockRejectedValueOnce(new Error("ngrok disconnect failed"));

    await expect(cleanup(null, true, {} as any)).rejects.toThrow("ngrok disconnect failed");
  });
});
