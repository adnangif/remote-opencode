import ngrok from "@ngrok/ngrok";
import { saveConfig } from "./config.js";
export async function startTunnel(config) {
    const listener = await ngrok.forward({
        addr: config.port,
        authtoken: config.ngrokAuthtoken,
    });
    const url = listener.url();
    config.ngrokUrl = url;
    saveConfig(config);
    return url;
}
export async function stopTunnel() {
    try {
        await ngrok.disconnect();
    }
    catch {
        // tunnel may already be dead
    }
}
