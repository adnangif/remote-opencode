import { spawn } from "node:child_process";
export function attachTUI(hostname, port, username, password, cwd) {
    const child = spawn("opencode", ["--hostname", hostname, "--port", String(port)], {
        cwd,
        env: {
            ...process.env,
            OPENCODE_SERVER_USERNAME: username,
            OPENCODE_SERVER_PASSWORD: password,
        },
        stdio: "inherit",
    });
    return child;
}
