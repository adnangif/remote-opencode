import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function clearDynamicFields(configPath: string): void {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return;
  }
  config.pid = null;
  config.username = null;
  config.password = null;
  config.ngrokUrl = null;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

const parentPid = parseInt(process.argv[2]);
const serverPid = parseInt(process.argv[3]);
const configPath = process.argv[4];

if (!parentPid || !serverPid || !configPath) {
  process.exit(1);
}

const interval = setInterval(() => {
  try {
    process.kill(parentPid, 0);
  } catch {
    clearInterval(interval);
    try {
      process.kill(serverPid, "SIGKILL");
    } catch {
      // already dead
    }
    clearDynamicFields(configPath);
    process.exit(0);
  }
}, 10000);

process.on("exit", () => {
  clearInterval(interval);
});
