import { stopTunnel } from "./tunnel.js";
import { clearDynamicFields } from "./config.js";
export async function cleanup(serverProcess, ngrokStarted, config) {
    if (ngrokStarted) {
        await stopTunnel();
    }
    if (serverProcess && !serverProcess.killed) {
        try {
            serverProcess.kill("SIGTERM");
        }
        catch {
            // already dead
        }
    }
    clearDynamicFields();
}
