import { spawn } from "node:child_process";
import { saveConfig, generateCredentials } from "./config.js";
const HEALTH_TIMEOUT_MS = 30000;
const HEALTH_POLL_INTERVAL_MS = 1000;
export async function checkServerHealth(hostname, port) {
    try {
        const url = `http://${hostname}:${port}/global/health`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok;
    }
    catch {
        return false;
    }
}
export async function waitForServer(hostname, port) {
    const start = Date.now();
    while (Date.now() - start < HEALTH_TIMEOUT_MS) {
        if (await checkServerHealth(hostname, port)) {
            return true;
        }
        await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
    }
    return false;
}
export async function startServer(config, cwd) {
    const { username, password } = generateCredentials();
    config.username = username;
    config.password = password;
    const child = spawn("opencode", ["web", "--hostname", config.hostname, "--port", String(config.port)], {
        cwd,
        env: {
            ...process.env,
            OPENCODE_SERVER_USERNAME: username,
            OPENCODE_SERVER_PASSWORD: password,
        },
        stdio: "ignore",
        detached: false,
    });
    config.pid = child.pid;
    saveConfig(config);
    const healthy = await waitForServer(config.hostname, config.port);
    if (!healthy) {
        child.kill("SIGTERM");
        throw new Error("opencode web server did not start within 30 seconds");
    }
    return { child, username, password };
}
