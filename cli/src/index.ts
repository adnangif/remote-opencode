#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { loadConfig, saveConfig, promptNgrokAuthtoken, Config } from "./config.js";
import { startServer, stopServer, checkServerHealth, isServerReachable, isProcessAlive } from "./server.js";
import { startTunnel, stopTunnel } from "./tunnel.js";
import { generateQR } from "./qr.js";
import { attachTUI } from "./tui.js";

interface ServicesStatus {
  serverUp: boolean;
  tunnelUp: boolean;
  ngrokUrl: string | null;
}

async function getServicesStatus(config: Config): Promise<ServicesStatus> {
  const serverUp = await isServerReachable(config.hostname, config.port);

  const tunnelUp =
    config.tunnelWorkerPid !== null &&
    isProcessAlive(config.tunnelWorkerPid);

  return {
    serverUp,
    tunnelUp,
    ngrokUrl: tunnelUp ? config.ngrokUrl : null,
  };
}

function printStatus(status: ServicesStatus, config: Config): void {
  if (status.serverUp) {
    console.log(chalk.green("✅ opencode server is running") + ` (${config.hostname}:${config.port})`);
  } else {
    console.log(chalk.red("❌ opencode server is down"));
  }

  if (status.tunnelUp) {
    console.log(chalk.green("✅ ngrok tunnel is running") + ` (${status.ngrokUrl})`);
  } else {
    console.log(chalk.red("❌ ngrok tunnel is down"));
  }
}

async function ensureNgrokConfig(config: Config): Promise<void> {
  if (config.ngrokAuthtoken !== null) return;

  console.log(chalk.cyan("\nFirst-time setup required.\n"));
  console.log(
    `Get your ngrok authtoken at: ${chalk.underline("https://dashboard.ngrok.com/get-started/your-authtoken")}\n`
  );
  const authtoken = await promptNgrokAuthtoken();
  if (!authtoken) {
    console.log(chalk.red("No authtoken provided. Exiting."));
    process.exit(1);
  }
  config.ngrokAuthtoken = authtoken;
  saveConfig(config);
  console.log(chalk.green("Configuration saved!\n"));
}

function getAuthUrl(config: Config): string {
  return `https://${config.username}:${config.password}@${config.ngrokUrl?.replace("https://", "")}`;
}

const program = new Command();
program.name("roc").description("Remotely access opencode via ngrok tunnel");

program
  .command("up")
  .description("Start opencode server and ngrok tunnel")
  .action(async () => {
    const config = loadConfig();
    await ensureNgrokConfig(config);

    const status = await getServicesStatus(config);
    if (status.serverUp || status.tunnelUp) {
      printStatus(status, config);
      console.log(chalk.yellow("\nServices are already running. Run 'remote down' first."));
      process.exit(1);
    }

    console.log(chalk.blue("Starting opencode server..."));
    try {
      await startServer(config, process.cwd());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`Failed to start server: ${message}`));
      process.exit(1);
    }
    console.log(chalk.green("✅ opencode server is running") + ` (${config.hostname}:${config.port})`);
    console.log(`   Username: ${config.username}`);
    console.log(`   Password: ${config.password}\n`);

    console.log(chalk.blue("Starting ngrok tunnel..."));
    try {
      await startTunnel(config);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`Failed to start tunnel: ${message}`));
      stopServer(config);
      process.exit(1);
    }

    const authUrl = getAuthUrl(config);
    console.log(chalk.green("✅ ngrok tunnel is running"));
    console.log(`   URL: ${chalk.underline(config.ngrokUrl!)}`);
    console.log(`   Auth URL: ${chalk.underline(authUrl)}\n`);

    await generateQR(authUrl);
    process.exit(0);
  });

program
  .command("down")
  .description("Stop opencode server and ngrok tunnel")
  .action(async () => {
    const config = loadConfig();
    const status = await getServicesStatus(config);

    if (!status.serverUp && !status.tunnelUp) {
      console.log(chalk.yellow("No services are running."));
      process.exit(0);
    }

    printStatus(status, config);
    stopTunnel(config);
    stopServer(config);
    console.log(chalk.green("\n✅ All services stopped."));
    process.exit(0);
  });

program
  .command("status")
  .description("Show status of opencode server and ngrok tunnel")
  .action(async () => {
    const config = loadConfig();
    const status = await getServicesStatus(config);
    printStatus(status, config);

    if (status.tunnelUp && config.username && config.password && status.ngrokUrl) {
      const authUrl = getAuthUrl(config);
      console.log(`\n   URL: ${chalk.underline(authUrl)}`);
    }
    process.exit(0);
  });

program
  .command("qr")
  .description("Generate QR code for ngrok tunnel URL")
  .action(async () => {
    const config = loadConfig();
    const status = await getServicesStatus(config);

    if (!status.serverUp || !status.tunnelUp) {
      printStatus(status, config);
      console.log(chalk.yellow("\nRun 'remote up' to start all services."));
      process.exit(1);
    }

    const authUrl = getAuthUrl(config);
    console.log(`URL: ${chalk.underline(config.ngrokUrl!)}`);
    console.log(`Auth URL: ${chalk.underline(authUrl)}`);
    console.log(`Username: ${config.username}`);
    console.log(`Password: ${config.password}`);
    console.log(`\nAttach: opencode attach http://${config.hostname}:${config.port} --username ${config.username} --password ${config.password}\n`);
    await generateQR(authUrl);
    process.exit(0);
  });

program
  .command("t")
  .description("Attach TUI to an existing opencode server")
  .action(async () => {
    const config = loadConfig();
    const reachable = await isServerReachable(config.hostname, config.port);

    if (!reachable) {
      console.log(chalk.red("❌ opencode server is down. Run 'remote up' first."));
      process.exit(1);
    }

    if (!config.username || !config.password) {
      console.log(chalk.red("No credentials found. Run 'remote up' first."));
      process.exit(1);
    }

    const healthy = await checkServerHealth(
      config.hostname,
      config.port,
      config.username,
      config.password
    );

    if (!healthy) {
      console.log(chalk.red("❌ Credentials don't match. Run 'remote down' then 'remote up' to restart."));
      process.exit(1);
    }

    console.log(chalk.blue("Attaching TUI...\n"));
    const tui = attachTUI(
      config.hostname,
      config.port,
      config.username!,
      config.password!,
      process.cwd()
    );

    tui.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  });

program.parse();
