#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { loadConfig, saveConfig, promptNgrokAuthtoken, promptMasked, promptWithDefault, getConfigPath, Config, getTunnelUrl } from "./config.js";
import { startServer, stopServer, checkServerHealth, isServerReachable, checkOpencodeVersion } from "./server.js";
import { startTunnel, stopTunnel, isTunnelUp } from "./tunnel.js";
import { generateQR } from "./qr.js";
import { attachTUI } from "./tui.js";
import {
  printBanner,
  createSpinner,
  printSuccessBox,
  printErrorBox,
  printWarnBox,
  printStatusPanel,
  printUpSummary,
  printConfigPanel,
  printSharePanel,
} from "./ui.js";
import { runGuidedConfigure } from "./guided-configure.js";

interface ServicesStatus {
  serverUp: boolean;
  tunnelUp: boolean;
  tunnelUrl: string | null;
}

async function getServicesStatus(config: Config): Promise<ServicesStatus> {
  const serverUp = await isServerReachable(config.hostname, config.port);
  const tunnelUp = await isTunnelUp(config);

  return {
    serverUp,
    tunnelUp,
    tunnelUrl: tunnelUp ? getTunnelUrl(config) : null,
  };
}

async function ensureNgrokConfig(config: Config): Promise<void> {
  if (config.tunnelProvider === "tailscale") return;
  if (config.ngrokAuthtoken !== null) return;

  console.log(chalk.cyan("\nFirst-time setup required.\n"));
  console.log(
    `Get your ngrok authtoken at: ${chalk.underline("https://dashboard.ngrok.com/get-started/your-authtoken")}\n`
  );
  const authtoken = await promptNgrokAuthtoken();
  if (!authtoken) {
    printErrorBox("No authtoken provided. Exiting.");
    process.exit(1);
  }
  config.ngrokAuthtoken = authtoken;
  saveConfig(config);
  printSuccessBox("Configuration saved!");
}

function getAuthUrl(config: Config): string {
  const url = getTunnelUrl(config);
  if (config.tunnelProvider === "tailscale") {
    return url!;
  }
  return `https://${config.username}:${config.password}@${url?.replace("https://", "")}`;
}

export async function runUp(showBanner: boolean = true): Promise<void> {
  if (showBanner) printBanner();

  const config = loadConfig();

  try {
    await checkOpencodeVersion();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    printErrorBox(message);
    process.exit(1);
  }

  if (config.tunnelProvider === "tailscale") {
    const { checkTailscaleInstalled, checkTailscaleConnected } = await import("./tailscale-tunnel.js");
    try {
      await checkTailscaleInstalled();
      await checkTailscaleConnected();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      printErrorBox(message);
      process.exit(1);
    }
  }

  await ensureNgrokConfig(config);

  const status = await getServicesStatus(config);
  if (status.serverUp || status.tunnelUp) {
    printStatusPanel(status, config);
    printWarnBox("Services are already running. Run 'roc down' first.");
    process.exit(1);
  }

  const serverSpinner = createSpinner("Starting opencode server...");
  serverSpinner.start();
  try {
    await startServer(config, process.cwd());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    serverSpinner.fail(chalk.red(`Failed to start server: ${message}`));
    process.exit(1);
  }
  serverSpinner.succeed(chalk.green(`opencode server started (${config.hostname}:${config.port})`));

  const provider = config.tunnelProvider === "tailscale" ? "tailscale" : "ngrok";
  const tunnelSpinner = createSpinner(`Starting ${provider} tunnel...`);
  tunnelSpinner.start();
  try {
    await startTunnel(config);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    tunnelSpinner.fail(chalk.red(`Failed to start tunnel: ${message}`));
    stopServer(config);
    process.exit(1);
  }
  tunnelSpinner.succeed(chalk.green(`${provider} tunnel started`));

  console.log();
  printUpSummary(config);

  const authUrl = getAuthUrl(config);
  await generateQR(authUrl);
  process.exit(0);
}

const program = new Command();
program.name("roc").description("Remotely access opencode via tunnel (ngrok or tailscale)");

program
  .command("up")
  .description("Start opencode server and tunnel")
  .action(() => runUp(true));

program
  .command("down")
  .description("Stop opencode server and tunnel")
  .action(async () => {
    printBanner();

    const config = loadConfig();
    const status = await getServicesStatus(config);

    if (!status.serverUp && !status.tunnelUp) {
      printWarnBox("No services are running.");
      process.exit(0);
    }

    printStatusPanel(status, config);

    const spinner = createSpinner("Stopping services...");
    spinner.start();
    stopTunnel(config);
    stopServer(config);
    await new Promise((r) => setTimeout(r, 500));
    spinner.stop();

    console.log();
    printSuccessBox("All services stopped.");
    process.exit(0);
  });

program
  .command("status")
  .description("Show status of opencode server and tunnel")
  .action(async () => {
    const config = loadConfig();
    const status = await getServicesStatus(config);
    printStatusPanel(status, config);
    process.exit(0);
  });

program
  .command("share")
  .description("Show share URL and generate QR code")
  .action(async () => {
    const config = loadConfig();
    const status = await getServicesStatus(config);

    if (!status.serverUp || !status.tunnelUp) {
      printStatusPanel(status, config);
      printWarnBox("Run 'roc up' to start all services.");
      process.exit(1);
    }

    printSharePanel(config);

    const authUrl = getAuthUrl(config);
    await generateQR(authUrl);
    process.exit(0);
  });

program
  .command("configure")
  .description("Setup and manage CLI configuration")
  .option("--guided", "Interactive guided configuration wizard")
  .option("-s, --show", "Show current configuration")
  .option("--hostname <hostname>", "Set hostname")
  .option("--port <port>", "Set port")
  .option("--authtoken <token>", "Set ngrok authtoken")
  .option("--provider <provider>", "Set tunnel provider (ngrok or tailscale)")
  .action(async (options: { guided?: boolean; show?: boolean; hostname?: string; port?: string; authtoken?: string; provider?: string }) => {
    if (options.guided) {
      return runGuidedConfigure();
    }

    const config = loadConfig();

    if (options.show) {
      printConfigPanel(config);
      process.exit(0);
    }

    const hasFlags = options.hostname || options.port || options.authtoken || options.provider;
    if (hasFlags) {
      if (options.hostname) config.hostname = options.hostname;
      if (options.port) {
        const port = parseInt(options.port, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          printErrorBox("Invalid port. Must be a number between 1 and 65535.");
          process.exit(1);
        }
        config.port = port;
      }
      if (options.authtoken) config.ngrokAuthtoken = options.authtoken;
      if (options.provider) {
        if (options.provider !== "ngrok" && options.provider !== "tailscale") {
          printErrorBox("Invalid provider. Must be 'ngrok' or 'tailscale'.");
          process.exit(1);
        }
        config.tunnelProvider = options.provider;
      }
      saveConfig(config);
      printSuccessBox("Configuration updated.");
      process.exit(0);
    }

    console.log(chalk.cyan("Interactive configuration setup"));
    console.log(chalk.gray("Press Enter to keep existing value\n"));
    console.log(`Get your ngrok authtoken at: ${chalk.underline("https://dashboard.ngrok.com/get-started/your-authtoken")}\n`);

    const authtokenInput = await promptMasked("ngrok authtoken", config.ngrokAuthtoken ?? "");
    if (authtokenInput) {
      config.ngrokAuthtoken = authtokenInput;
    }

    const hostnameInput = await promptWithDefault("Hostname", config.hostname);
    config.hostname = hostnameInput;

    const portStr = await promptWithDefault("Port", String(config.port));
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      printErrorBox("Invalid port. Must be a number between 1 and 65535.");
      process.exit(1);
    }
    config.port = port;

    saveConfig(config);
    console.log();
    printSuccessBox("Configuration saved.");
  });

program
  .command("t")
  .description("Attach TUI to an existing opencode server")
  .action(async () => {
    const config = loadConfig();

    const spinner = createSpinner("Checking server...");
    spinner.start();

    const reachable = await isServerReachable(config.hostname, config.port);

    if (!reachable) {
      spinner.stop();
      printErrorBox("opencode server is down. Run 'roc up' first.");
      process.exit(1);
    }

    if (!config.username || !config.password) {
      spinner.stop();
      printErrorBox("No credentials found. Run 'roc down' then 'roc up' to restart.");
      process.exit(1);
    }

    const healthy = await checkServerHealth(config.hostname, config.port, config.username, config.password);

    if (!healthy) {
      spinner.stop();
      printErrorBox("Credentials don't match. Run 'roc down' then 'roc up' to restart.");
      process.exit(1);
    }

    spinner.succeed(chalk.green("Server is healthy"));
    console.log(chalk.cyan("Attaching TUI...\n"));

    const tui = attachTUI(config.hostname, config.port, config.password, process.cwd());

    tui.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  });

program.parse();
