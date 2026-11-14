import { spawn, ChildProcess } from "node:child_process";

export function attachTUI(hostname: string, port: number, password: string, cwd: string): ChildProcess {
  const env: Record<string, string | undefined> = {
    ...process.env,
    OPENCODE_SERVER_PASSWORD: password,
  };
  // OPENCODE_PASSWORD takes precedence over OPENCODE_SERVER_PASSWORD in v2.
  delete env.OPENCODE_PASSWORD;

  const child = spawn("opencode", ["--server", `http://${hostname}:${port}`, cwd], {
    env,
    stdio: "inherit",
  });

  return child;
}
