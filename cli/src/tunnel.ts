import ngrok from "@ngrok/ngrok";
import { Config, saveConfig } from "./config.js";

export async function startTunnel(config: Config): Promise<string> {
  const listener = await ngrok.forward({
    addr: config.port,
    authtoken: config.ngrokAuthtoken!,
  });

  const url = listener.url()!;
  config.ngrokUrl = url;
  saveConfig(config);

  return url;
}

export async function stopTunnel(): Promise<void> {
  try {
    await ngrok.disconnect();
  } catch {
    // tunnel may already be dead
  }
}
