import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config, saveConfig, getProxyPort } from "./config.js";
import { killProcess, waitForIpcMessage, isProcessAlive } from "./process-utils.js";
import { startTailscaleTunnel, stopTailscaleTunnel, isTailscaleServeActive } from "./tailscale-tunnel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TunnelReady = { type: "ready"; url: string };
type ProxyReady = { type: "ready" };

async function startNgrokTunnel(config: Config): Promise<void> {
  const workerPath = path.join(__dirname, "tunnel-worker.js");
  const child = fork(workerPath, [config.ngrokAuthtoken!, config.hostname, String(config.port)], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.unref();

  const msg = await waitForIpcMessage<TunnelReady>(child, "Tunnel worker");

  if (msg.type === "error") {
    throw new Error(msg.message);
  }

  config.tunnelWorkerPid = child.pid!;
  config.ngrokUrl = msg.url;
  saveConfig(config);
}

function stopNgrokTunnel(config: Config): void {
  killProcess(config.tunnelWorkerPid);
  config.tunnelWorkerPid = null;
  config.ngrokUrl = null;
  saveConfig(config);
}

async function startAuthProxy(config: Config): Promise<number> {
  const listenPort = getProxyPort(config);
  const workerPath = path.join(__dirname, "proxy-worker.js");
  const child = fork(workerPath, [config.hostname, String(config.port), String(listenPort)], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    env: { ...process.env, ROC_SERVER_PASSWORD: config.password ?? "" },
  });
  child.unref();

  const msg = await waitForIpcMessage<ProxyReady>(child, "Auth proxy");

  if (msg.type === "error") {
    throw new Error(msg.message);
  }

  config.proxyWorkerPid = child.pid!;
  saveConfig(config);
  return listenPort;
}

function stopAuthProxy(config: Config): void {
  killProcess(config.proxyWorkerPid);
  config.proxyWorkerPid = null;
  saveConfig(config);
}

async function startTailscaleWithProxy(config: Config): Promise<void> {
  const proxyPort = await startAuthProxy(config);
  try {
    await startTailscaleTunnel(config, proxyPort);
  } catch (err) {
    stopAuthProxy(config);
    throw err;
  }
}

export async function startTunnel(config: Config): Promise<void> {
  if (config.tunnelProvider === "tailscale") {
    return startTailscaleWithProxy(config);
  }
  return startNgrokTunnel(config);
}

export function stopTunnel(config: Config): void {
  stopNgrokTunnel(config);
  stopAuthProxy(config);
  stopTailscaleTunnel(config);
}

function isNgrokActive(config: Config): boolean {
  return config.tunnelWorkerPid !== null && isProcessAlive(config.tunnelWorkerPid);
}

export async function isTunnelUp(config: Config): Promise<boolean> {
  if (config.tunnelProvider === "tailscale") {
    const proxyUp = config.proxyWorkerPid !== null && isProcessAlive(config.proxyWorkerPid);
    return proxyUp && (await isTailscaleServeActive(config));
  }
  return isNgrokActive(config);
}
