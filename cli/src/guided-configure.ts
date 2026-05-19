import chalk from "chalk";
import * as clack from "@clack/prompts";
import { Config, loadConfig, saveConfig, getConfigPath } from "./config.js";
import { printBanner, printConfigPanel, printSuccessBox } from "./ui.js";
import { runUp } from "./index.js";

export async function runGuidedConfigure(): Promise<void> {
  printBanner();

  const config = loadConfig();

  clack.intro(chalk.bgCyan(chalk.black(" roc configure — guided setup ")));

  const provider = await clack.select({
    message: "Select your tunnel provider",
    options: [
      { value: "ngrok" as const, label: "ngrok", hint: "Cloud tunnel via ngrok.com (requires authtoken)" },
      { value: "tailscale" as const, label: "tailscale", hint: "Private tunnel via your tailnet" },
    ],
    initialValue: config.tunnelProvider ?? "ngrok",
  });

  if (clack.isCancel(provider)) {
    clack.cancel("Configuration cancelled.");
    process.exit(0);
  }

  config.tunnelProvider = provider;

  if (provider === "ngrok") {
    const authtoken = await clack.password({
      message: "Enter your ngrok authtoken",
    });

    if (clack.isCancel(authtoken)) {
      clack.cancel("Configuration cancelled.");
      process.exit(0);
    }

    if (authtoken) {
      config.ngrokAuthtoken = authtoken;
    } else if (!config.ngrokAuthtoken) {
      clack.log.warn("No authtoken provided. You'll need to set one before running 'roc up'.");
      clack.log.info(`Get yours at: ${chalk.cyan("https://dashboard.ngrok.com/get-started/your-authtoken")}`);
    }
  }

  const hostname = await clack.text({
    message: "Server hostname",
    placeholder: config.hostname || "localhost",
    defaultValue: config.hostname,
  });

  if (clack.isCancel(hostname)) {
    clack.cancel("Configuration cancelled.");
    process.exit(0);
  }

  config.hostname = hostname || config.hostname || "localhost";

  const portInput = await clack.text({
    message: "Server port",
    placeholder: String(config.port || 4096),
    defaultValue: String(config.port),
    validate: (value?: string) => {
      if (!value) return undefined;
      const p = parseInt(value, 10);
      if (isNaN(p) || p < 1 || p > 65535) {
        return "Port must be a number between 1 and 65535";
      }
      return undefined;
    },
  });

  if (clack.isCancel(portInput)) {
    clack.cancel("Configuration cancelled.");
    process.exit(0);
  }

  const port = parseInt(portInput ?? String(config.port), 10);
  config.port = port;

  saveConfig(config);

  const s = clack.spinner();
  s.start("Saving configuration...");
  await new Promise((r) => setTimeout(r, 500));
  s.stop("Configuration saved!");

  console.log();
  printConfigPanel(config);

  const startNow = await clack.confirm({
    message: "Start services now?",
    initialValue: false,
  });

  if (clack.isCancel(startNow)) {
    clack.outro(chalk.green("Configuration saved. Run ") + chalk.cyan("roc up") + chalk.green(" when ready."));
    process.exit(0);
  }

  clack.outro(
    startNow
      ? chalk.green("Starting services...")
      : chalk.green("Configuration saved. Run ") + chalk.cyan("roc up") + chalk.green(" when ready.")
  );

  if (startNow) {
    console.log();
    await runUp(false);
  }
}
