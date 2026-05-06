import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createInterface } from "node:readline";
const CONFIG_FILENAME = ".opencode-proxy.json";
export function getConfigPath() {
    return path.join(os.homedir(), CONFIG_FILENAME);
}
export function loadConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return {
            hostname: "localhost",
            port: 4096,
            ngrokAuthtoken: null,
            pid: null,
            username: null,
            password: null,
            ngrokUrl: null,
        };
    }
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
}
export function saveConfig(config) {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
export function clearDynamicFields(configPath) {
    const config = loadConfig();
    config.pid = null;
    config.username = null;
    config.password = null;
    config.ngrokUrl = null;
    const target = configPath ?? getConfigPath();
    fs.writeFileSync(target, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
export function generateCredentials() {
    return {
        username: crypto.randomBytes(8).toString("hex"),
        password: crypto.randomBytes(16).toString("hex"),
    };
}
export async function promptNgrokAuthtoken() {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question("Enter your ngrok authtoken: ", (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
export function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
