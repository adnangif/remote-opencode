import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { setConfigDir } from "../src/config.js";

const TMP_DIR = path.join(os.tmpdir(), "opencode-remote-prompt-test-" + process.pid);

let mockAnswer = "";

vi.mock("node:readline", () => ({
  createInterface: vi.fn().mockReturnValue({
    question: (_prompt: string, cb: (answer: string) => void) => cb(mockAnswer),
    close: vi.fn(),
  }),
}));

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  setConfigDir(TMP_DIR);
});

afterEach(() => {
  setConfigDir(null);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("promptNgrokAuthtoken", () => {
  it("trims whitespace from input", async () => {
    mockAnswer = "  my-token  ";
    const { promptNgrokAuthtoken } = await import("../src/config.js");
    const result = await promptNgrokAuthtoken();
    expect(result).toBe("my-token");
  });

  it("returns empty string when user presses Enter without typing", async () => {
    mockAnswer = "";
    const { promptNgrokAuthtoken } = await import("../src/config.js");
    const result = await promptNgrokAuthtoken();
    expect(result).toBe("");
  });
});
