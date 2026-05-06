import ngrok from "@ngrok/ngrok";
import { Config, saveConfig } from "./config.js";

let activeListener: Awaited<ReturnType<typeof ngrok.forward>> | null = null;

export async function startTunnel(config: Config): Promise<string> {
  activeListener = await ngrok.forward({
    addr: `${config.hostname}:${config.port}`,
    authtoken: config.ngrokAuthtoken!,
  });

  const url = activeListener.url()!;
  config.ngrokUrl = url;
  saveConfig(config);

  return url;
}

export async function stopTunnel(): Promise<void> {
  try {
    if (activeListener) {
      await activeListener.close();
      activeListener = null;
    }
  } catch {
    // tunnel may already be dead
  }
}
