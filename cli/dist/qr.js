import qrcode from "qrcode-terminal";
export function generateQR(url) {
    return new Promise((resolve) => {
        qrcode.generate(url, { small: true }, (qr) => {
            console.log("\n" + qr);
            resolve();
        });
    });
}
