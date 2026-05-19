import { execFile } from "node:child_process";
import { Config, saveConfig } from "./config.js";

function execTailscale(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile("tailscale", args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || stdout || error.message).trim()));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export async function checkTailscaleInstalled(): Promise<void> {
  try {
    await execTailscale(["version"]);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Tailscale is not installed. Install it from https://tailscale.com/download");
    }
    throw err;
  }
}

export async function checkTailscaleConnected(): Promise<void> {
  const { stdout } = await execTailscale(["status", "--json"]);
  const status = JSON.parse(stdout);
  if (status.BackendState !== "Running") {
    throw new Error("Tailscale is not connected. Run 'tailscale login' first.");
  }
}

async function getTailscaleInfo(): Promise<{ hostname: string; tailnet: string; dnsName: string }> {
  const { stdout } = await execTailscale(["status", "--json"]);
  const status = JSON.parse(stdout);
  const dnsName = (status.Self.DNSName as string).replace(/\.$/, "");
  const hostname = status.Self.HostName as string;
  const tailnet = (status.CurrentTailnet.MagicDNSSuffix as string).replace(/\.$/, "");
  return { hostname, tailnet, dnsName };
}

export async function startTailscaleTunnel(config: Config): Promise<void> {
  await checkTailscaleInstalled();
  await checkTailscaleConnected();

  try {
    await execTailscale(["serve", "--bg", `--https=443`, `localhost:${config.port}`]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not enabled")) {
      const urlMatch = message.match(/https:\/\/[^\s]+/);
      throw new Error(
        `Tailscale Serve is not enabled on your tailnet.\n` +
        `To enable, visit: ${urlMatch ? urlMatch[0] : "https://login.tailscale.com/admin/acl"}\n` +
        `For help, see: https://tailscale.com/kb/1312/tailscale-serve`
      );
    }
    if (message.includes("Access denied") || message.includes("operator")) {
      throw new Error(
        `Tailscale Serve requires operator permissions.\n` +
        `Fix: run 'sudo tailscale set --operator=$USER' once, then retry.`
      );
    }
    throw err;
  }

  const info = await getTailscaleInfo();
  const url = `https://${info.dnsName}`;

  config.tailscaleUrl = url;
  saveConfig(config);
}

export function stopTailscaleTunnel(config: Config): void {
  execTailscale(["serve", "reset"]).catch(() => {});

  config.tailscaleUrl = null;
  saveConfig(config);
}

export async function isTailscaleServeActive(config: Config): Promise<boolean> {
  if (config.tailscaleUrl === null) return false;

  try {
    const { stdout } = await execTailscale(["serve", "status", "--json"]);
    const status = JSON.parse(stdout);
    return Object.keys(status).length > 0;
  } catch {
    return false;
  }
}
