#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { loadConfig, saveConfig, promptNgrokAuthtoken, isPidAlive, clearDynamicFields, } from "./config.js";
import { checkServerHealth, startServer } from "./server.js";
import { startTunnel } from "./tunnel.js";
import { generateQR } from "./qr.js";
import { attachTUI } from "./tui.js";
import { cleanup } from "./cleanup.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function waitForEnter() {
    return new Promise((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question("", () => {
            rl.close();
            resolve();
        });
    });
}
async function main() {
    let config = loadConfig();
    const isFirstRun = config.ngrokAuthtoken === null;
    if (isFirstRun) {
        console.log(chalk.cyan("\nDon't worry! You only have to configure once.\n"));
        console.log(`Get your ngrok authtoken at: ${chalk.underline("https://dashboard.ngrok.com/get-started/your-authtoken")}\n`);
        const authtoken = await promptNgrokAuthtoken();
        if (!authtoken) {
            console.log(chalk.red("No authtoken provided. Exiting."));
            process.exit(1);
        }
        config.ngrokAuthtoken = authtoken;
        saveConfig(config);
        console.log(chalk.green("Configuration saved!\n"));
    }
    // Layer 3: Stale PID check
    if (config.pid !== null) {
        if (!isPidAlive(config.pid)) {
            console.log(chalk.yellow("Found stale server entry. Cleaning up..."));
            clearDynamicFields();
            config = loadConfig();
        }
    }
    const cwd = process.cwd();
    let serverProcess = null;
    let ngrokStarted = false;
    let isOwner = false;
    const serverRunning = await checkServerHealth(config.hostname, config.port);
    if (!serverRunning) {
        console.log(chalk.blue("Starting opencode web server..."));
        const result = await startServer(config, cwd);
        serverProcess = result.child;
        isOwner = true;
        console.log(chalk.green("Server started."));
        console.log(`  Host: ${config.hostname}:${config.port}`);
        console.log(`  Username: ${config.username}`);
        console.log(`  Password: ${config.password}\n`);
        console.log(chalk.blue("Starting ngrok tunnel..."));
        const ngrokUrl = await startTunnel(config);
        ngrokStarted = true;
        console.log(chalk.green("Tunnel started."));
        console.log(`  URL: ${ngrokUrl}\n`);
        const authUrl = `https://${config.username}:${config.password}@${ngrokUrl.replace("https://", "")}`;
        await generateQR(authUrl);
        console.log(`  URL: ${chalk.underline(authUrl)}\n`);
        // Spawn watchdog
        const watchdog = spawn("node", [
            path.join(__dirname, "watchdog.js"),
            String(process.pid),
            String(serverProcess.pid),
            path.join(await import("node:os").then((os) => os.homedir()), ".opencode-proxy.json"),
        ], {
            detached: true,
            stdio: "ignore",
        });
        watchdog.unref();
    }
    else {
        console.log(chalk.green("Server already running."));
        if (!config.username || !config.password) {
            console.log(chalk.red("Server is running but no credentials found in config. Cannot attach."));
            process.exit(1);
        }
    }
    console.log(chalk.gray("Press Enter to attach TUI..."));
    await waitForEnter();
    console.log(chalk.blue("Attaching TUI...\n"));
    const tui = attachTUI(config.hostname, config.port, config.username, config.password, cwd);
    const gracefulCleanup = async () => {
        if (isOwner) {
            await cleanup(serverProcess, ngrokStarted, config);
        }
    };
    const handledSignals = new Set();
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
        process.on(signal, async () => {
            if (handledSignals.has(signal))
                return;
            handledSignals.add(signal);
            tui.kill(signal);
            await gracefulCleanup();
            process.exit(0);
        });
    }
    tui.on("exit", async (code) => {
        await gracefulCleanup();
        process.exit(code ?? 0);
    });
}
main().catch((err) => {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
});
