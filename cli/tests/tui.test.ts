import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { attachTUI } from "../src/tui.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeMockChild() {
  const child = new EventEmitter() as any;
  child.killed = false;
  child.pid = 54321;
  return child;
}

describe("attachTUI", () => {
  it("spawns opencode with correct --hostname and --port flags", async () => {
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(mockChild);

    const result = attachTUI("localhost", 4096, "user", "pass", "/tmp/project");

    expect(spawnMock).toHaveBeenCalledWith(
      "opencode",
      ["--hostname", "localhost", "--port", "4096"],
      expect.any(Object)
    );
    expect(result).toBe(mockChild);
  });

  it("uses cwd from parameter", async () => {
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(mockChild);

    attachTUI("0.0.0.0", 5000, "admin", "secret123", "/home/user/my-project");

    const opts = spawnMock.mock.calls[0][2] as Record<string, any>;
    expect(opts.cwd).toBe("/home/user/my-project");
  });

  it("sets OPENCODE_SERVER_USERNAME matching the username parameter exactly", async () => {
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(makeMockChild());

    attachTUI("localhost", 4096, "exact-user", "pass", "/tmp");

    const env = spawnMock.mock.calls[0][2].env;
    expect(env.OPENCODE_SERVER_USERNAME).toBe("exact-user");
  });

  it("sets OPENCODE_SERVER_PASSWORD matching the password parameter exactly", async () => {
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(makeMockChild());

    attachTUI("localhost", 4096, "user", "exact-pass-123!", "/tmp");

    const env = spawnMock.mock.calls[0][2].env;
    expect(env.OPENCODE_SERVER_PASSWORD).toBe("exact-pass-123!");
  });

  it("includes all existing env vars from process.env", async () => {
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(makeMockChild());

    process.env._TEST_VAR = "test-value";
    attachTUI("localhost", 4096, "u", "p", "/tmp");

    const env = spawnMock.mock.calls[0][2].env;
    expect(env._TEST_VAR).toBe("test-value");
    delete process.env._TEST_VAR;
  });

  it("overrides existing OPENCODE_SERVER_* env vars with new values", async () => {
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(makeMockChild());

    process.env.OPENCODE_SERVER_USERNAME = "old-user";
    process.env.OPENCODE_SERVER_PASSWORD = "old-pass";
    attachTUI("localhost", 4096, "new-user", "new-pass", "/tmp");

    const env = spawnMock.mock.calls[0][2].env;
    expect(env.OPENCODE_SERVER_USERNAME).toBe("new-user");
    expect(env.OPENCODE_SERVER_PASSWORD).toBe("new-pass");
    delete process.env.OPENCODE_SERVER_USERNAME;
    delete process.env.OPENCODE_SERVER_PASSWORD;
  });

  it("spawns with stdio: inherit", async () => {
    const { spawn } = await import("node:child_process");
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockReturnValue(makeMockChild());

    attachTUI("localhost", 4096, "u", "p", "/tmp");

    const opts = spawnMock.mock.calls[0][2] as Record<string, any>;
    expect(opts.stdio).toBe("inherit");
  });

  it("returns the spawned ChildProcess", async () => {
    const mockChild = makeMockChild();
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue(mockChild);

    const result = attachTUI("localhost", 4096, "u", "p", "/tmp");
    expect(result).toBe(mockChild);
  });
});
