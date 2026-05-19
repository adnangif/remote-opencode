import chalk from "chalk";
import boxen from "boxen";
import gradient from "gradient-string";
import ora, { Ora } from "ora";
import { Config, getTunnelUrl, getConfigPath } from "./config.js";

const ROC_ASCII = [
  "                                            ",
  "  ██████╗  ██████╗ ██████╗                  ",
  "  ██╔══██╗██╔═══██╗██╔════╝                 ",
  "  ██████╔╝██║   ██║██║                      ",
  "  ██╔══██╗██║   ██║██║                      ",
  "  ██║  ██║╚██████╔╝╚██████╗                 ",
  "  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝                 ",
  "                                            ",
].join("\n");

const OK = chalk.green("+");
const FAIL = chalk.red("x");
const WARN = chalk.yellow("!");

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

function padEndPlain(text: string, width: number): string {
  const visibleLen = stripAnsi(text).length;
  const pad = Math.max(0, width - visibleLen);
  return text + " ".repeat(pad);
}

function makeBox(content: string, options: {
  borderColor: "green" | "red" | "yellow" | "cyan" | "magenta";
  title: string;
}): void {
  console.log(
    boxen(content, {
      borderStyle: "round",
      borderColor: options.borderColor,
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 1, right: 0 },
      title: chalk.bold.white(options.title),
      titleAlignment: "center",
    })
  );
}

export function printBanner(): void {
  console.log();
  console.log(gradient.mind(ROC_ASCII));
  console.log(
    chalk.dim("        ")
    + chalk.gray("Remote Control")
    + chalk.dim(" -- ")
    + chalk.gray("v1.0.0")
  );
  console.log();
}

export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.cyan(text),
    spinner: "dots12",
    color: "cyan",
  });
}

export function printSuccessBox(message: string): void {
  makeBox(
    chalk.green(` +  ${message}`),
    { borderColor: "green", title: " done " }
  );
}

export function printErrorBox(message: string): void {
  console.log(
    boxen(
      chalk.red(` x  ${message}`),
      {
        borderStyle: "bold",
        borderColor: "red",
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 0, left: 1, right: 0 },
      }
    )
  );
}

export function printWarnBox(message: string): void {
  makeBox(
    chalk.yellow(` !  ${message}`),
    { borderColor: "yellow", title: " warning " }
  );
}

interface StatusInfo {
  serverUp: boolean;
  tunnelUp: boolean;
  tunnelUrl: string | null;
}

export function printStatusPanel(status: StatusInfo, config: Config): void {
  const allUp = status.serverUp && status.tunnelUp;
  const anyUp = status.serverUp || status.tunnelUp;
  const borderColor: "green" | "red" | "yellow" = allUp ? "green" : anyUp ? "yellow" : "red";

  const sIcon = status.serverUp ? OK : FAIL;
  const sLabel = status.serverUp ? chalk.green("running") : chalk.red("stopped");

  const provider = config.tunnelProvider === "tailscale" ? "tailscale" : "ngrok";
  const tIcon = status.tunnelUp ? OK : FAIL;
  const tLabel = status.tunnelUp ? chalk.green("running") : chalk.red("stopped");

  const col = 45;

  const lines: string[] = [];
  lines.push(padEndPlain(`${sIcon}  opencode server   ${sLabel}`, col));
  if (status.serverUp) {
    lines.push(padEndPlain(chalk.gray(`    ${config.hostname}:${config.port}`), col));
  }
  lines.push(" ".repeat(col));
  lines.push(padEndPlain(`${tIcon}  ${provider} tunnel     ${tLabel}`, col));
  if (status.tunnelUp && status.tunnelUrl) {
    lines.push(padEndPlain(chalk.cyan(`    ${status.tunnelUrl}`), col));
  }

  makeBox(lines.join("\n"), { borderColor, title: " roc status " });
}

export function printUpSummary(config: Config): void {
  const tunnelUrl = getTunnelUrl(config);
  const provider = config.tunnelProvider === "tailscale" ? "tailscale" : "ngrok";

  const col = 48;

  const lines: string[] = [];
  lines.push(padEndPlain(`${OK}  opencode server   ${chalk.green("running")}`, col));
  lines.push(padEndPlain(chalk.gray(`    ${config.hostname}:${config.port}`), col));
  if (config.tunnelProvider === "ngrok" && config.username && config.password) {
    lines.push(padEndPlain(chalk.gray(`    Username: ${chalk.cyan(config.username)}`), col));
    lines.push(padEndPlain(chalk.gray("    Password: --------"), col));
  }
  lines.push(" ".repeat(col));
  lines.push(padEndPlain(`${OK}  ${provider} tunnel     ${chalk.green("running")}`, col));
  if (tunnelUrl) {
    lines.push(padEndPlain(chalk.cyan(`    ${tunnelUrl}`), col));
  }
  lines.push(" ".repeat(col));
  lines.push(padEndPlain(chalk.dim(`  > Scan QR code below to connect`), col));

  makeBox(lines.join("\n"), {
    borderColor: "green",
    title: " roc up -- all services running ",
  });
  console.log();
}

export function printConfigPanel(config: Config): void {
  const provider = config.tunnelProvider === "tailscale" ? "tailscale" : "ngrok";
  const authtokenDisplay = config.ngrokAuthtoken
    ? chalk.green("****" + config.ngrokAuthtoken.slice(-4))
    : chalk.red("not set");
  const usernameDisplay = config.username ?? chalk.gray("auto-generated on up");
  const passwordDisplay = config.password ? "--------" : chalk.gray("auto-generated on up");

  const col = 50;

  const lines: string[] = [];
  lines.push(padEndPlain(`${chalk.gray("Config file:")}     ${chalk.dim(getConfigPath())}`, col));
  lines.push(padEndPlain(`${chalk.gray("Hostname:")}        ${chalk.white(config.hostname)}`, col));
  lines.push(padEndPlain(`${chalk.gray("Port:")}            ${chalk.white(String(config.port))}`, col));
  lines.push(padEndPlain(`${chalk.gray("Tunnel provider:")} ${chalk.cyan(provider)}`, col));
  lines.push(padEndPlain(`${chalk.gray("Authtoken:")}       ${authtokenDisplay}`, col));
  lines.push(padEndPlain(`${chalk.gray("Username:")}        ${chalk.dim(usernameDisplay)}`, col));
  lines.push(padEndPlain(`${chalk.gray("Password:")}        ${chalk.dim(passwordDisplay)}`, col));

  makeBox(lines.join("\n"), {
    borderColor: "cyan",
    title: " roc configure --show ",
  });
}

export function printSharePanel(config: Config): void {
  const tunnelUrl = getTunnelUrl(config);
  const authUrl = config.tunnelProvider === "tailscale"
    ? tunnelUrl!
    : `https://${config.username}:${config.password}@${tunnelUrl?.replace("https://", "")}`;

  const col = 55;

  const lines: string[] = [];
  if (tunnelUrl) {
    lines.push(padEndPlain(`${chalk.gray("URL:")}       ${chalk.cyan.underline(tunnelUrl)}`, col));
  }
  if (config.tunnelProvider === "ngrok") {
    lines.push(padEndPlain(`${chalk.gray("Auth URL:")}  ${chalk.cyan.underline(authUrl)}`, col));
    lines.push(padEndPlain(`${chalk.gray("Username:")}  ${chalk.white(config.username)}`, col));
    lines.push(padEndPlain(`${chalk.gray("Password:")}  ${chalk.gray("--------")}`, col));
    lines.push(" ".repeat(col));
    lines.push(padEndPlain(chalk.dim(`Attach: opencode attach http://${config.hostname}:${config.port}`), col));
    lines.push(padEndPlain(chalk.dim(`        --username ${config.username} --password ********`), col));
  } else {
    lines.push(" ".repeat(col));
    lines.push(padEndPlain(chalk.dim(`Attach: opencode attach http://${config.hostname}:${config.port}`), col));
  }

  makeBox(lines.join("\n"), {
    borderColor: "magenta",
    title: " roc share ",
  });
  console.log();
}
