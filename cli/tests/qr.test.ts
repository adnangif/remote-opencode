import { describe, it, expect, vi } from "vitest";

vi.mock("qrcode-terminal", () => ({
  default: {
    generate: vi.fn((_url: string, _opts: unknown, cb: (qr: string) => void) => {
      cb("fake-qr-output");
    }),
  },
}));

describe("generateQR", () => {
  it("calls qrcode-terminal.generate with the correct URL", async () => {
    const qrcode = (await import("qrcode-terminal")).default;
    const { generateQR } = await import("../src/qr.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await generateQR("https://user:pass@test.ngrok-free.app");

    expect(qrcode.generate).toHaveBeenCalledWith(
      "https://user:pass@test.ngrok-free.app",
      expect.any(Object),
      expect.any(Function)
    );

    logSpy.mockRestore();
  });

  it("passes { small: true } option", async () => {
    const qrcode = (await import("qrcode-terminal")).default;
    const { generateQR } = await import("../src/qr.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await generateQR("https://example.com");

    const callArgs = vi.mocked(qrcode.generate).mock.calls[0];
    expect(callArgs[1]).toEqual({ small: true });

    logSpy.mockRestore();
  });

  it("logs QR output prefixed with newline", async () => {
    const { generateQR } = await import("../src/qr.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await generateQR("https://example.com");

    expect(logSpy).toHaveBeenCalledWith("\n" + "fake-qr-output");

    logSpy.mockRestore();
  });
});
