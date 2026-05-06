import { spawn, ChildProcess } from "node:child_process";

export function attachTUI(
  hostname: string,
  port: number,
  username: string,
  password: string,
  cwd: string
): ChildProcess {
  const child = spawn("opencode", ["attach", `http://${hostname}:${port}`, "--username", username, "--password", password], {
    cwd,
    env: {
      ...process.env,
    },
    stdio: "inherit",
  });

  return child;
}
