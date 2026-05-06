import qrcode from "qrcode-terminal";

export function generateQR(url: string): Promise<void> {
  return new Promise((resolve) => {
    qrcode.generate(url, { small: true }, (qr: string) => {
      console.log("\n" + qr);
      resolve();
    });
  });
}
