import ngrok from "@ngrok/ngrok";
import { send } from "./process-utils.js";

async function main() {
  const authtoken = process.argv[2];
  const hostname = process.argv[3];
  const port = process.argv[4];

  let listener;
  try {
    listener = await ngrok.forward({
      addr: `${hostname}:${port}`,
      authtoken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start ngrok tunnel";
    send({ type: "error", message });
    process.exit(1);
  }

  const url = listener.url();
  send({ type: "ready", url });

  if (process.disconnect) process.disconnect();

  setInterval(() => {}, 60_000);
}

process.on("SIGTERM", async () => {
  process.exit(0);
});

main().catch((err) => {
  send({ type: "error", message: err.message });
  process.exit(1);
});
