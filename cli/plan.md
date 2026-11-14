> **Outdated:** this is the original v1-era plan. `server-worker.ts` was never built, and the opencode v2 changes (auth proxy, `/api/info`) are not reflected here.

# Remote Control CLI — Implementation Plan

## Architecture

The CLI manages two background services: an **opencode server** and an **ngrok tunnel**. Each runs as a detached `fork()` child process with IPC messaging. The CLI commands start, stop, and inspect these services by communicating via PIDs stored in a config file.

## File Structure

All source files live in `cli/src/`:

| File | Responsibility |
|---|---|
| `config.ts` | Config interface, load/save, credential generation, prompts |
| `server-worker.ts` | Background worker — spawns and monitors `opencode serve` |
| `tunnel-worker.ts` | Background worker — holds ngrok SDK listener |
| `server.ts` | Server lifecycle — fork worker, IPC handling, stop via PID, health check |
| `tunnel.ts` | Tunnel lifecycle — fork worker, IPC handling, stop via PID |
| `qr.ts` | QR code generation |
| `tui.ts` | Attach TUI to existing server |
| `index.ts` | CLI entry point — 5 commands via Commander |

---

## `config.ts`

### Config Interface

```ts
interface Config {
  hostname: string;         // default: "localhost"
  port: number;             // default: 4096
  ngrokAuthtoken: string | null;
  username: string | null;
  password: string | null;
  ngrokUrl: string | null;
  serverWorkerPid: number | null;
  tunnelWorkerPid: number | null;
}
```

### Functions

- `loadConfig(): Config` — read from `~/.opencode-proxy.json`, return defaults if missing
- `saveConfig(config): void` — write to `~/.opencode-proxy.json`
- `generateCredentials(): { username, password }` — random hex credentials
- `promptNgrokAuthtoken(): Promise<string>` — interactive prompt for first-time setup

---

## `server-worker.ts`

Standalone script — runs as a detached forked process.

### Flow

1. Parse `hostname`, `port`, `cwd` from `process.argv`
2. Call `generateCredentials()` to get `username` + `password`
3. Spawn `opencode serve --hostname <host> --port <port>` with:
   - env: `OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD`, `BROWSER=none`
   - `stdio: "ignore"`, `detached: true`
4. Poll health check (`GET /global/health` with Basic auth) until server responds or 30s timeout
5. On success → `process.send({ type: "ready", username, password })`
6. On failure → `process.send({ type: "error", message: "..." })`
7. Stay alive — listen for `opencode serve` child exit, forward via IPC if it dies
8. On `SIGTERM` → kill the `opencode serve` child, exit cleanly

---

## `tunnel-worker.ts`

Standalone script — runs as a detached forked process.

### Flow

1. Parse `authtoken`, `hostname`, `port` from `process.argv`
2. Call `ngrok.forward({ addr: "hostname:port", authtoken })` via `@ngrok/ngrok` SDK
3. Get URL from `listener.url()`
4. `process.send({ type: "ready", url })`
5. On failure → `process.send({ type: "error", message: "..." })`
6. Stay alive — the ngrok SDK listener keeps the tunnel open
7. On `SIGTERM` → call `listener.close()`, exit cleanly

---

## `server.ts`

### Shared Utility

```ts
function isProcessAlive(pid: number): boolean
```
Uses `kill(pid, 0)` — returns true if process exists.

### Functions

#### `startServer(config, cwd): Promise<void>`

1. Fork `server-worker.ts` with `{ detached: true }`
2. Pass `hostname`, `port`, `cwd` as args
3. Listen for IPC message:
   - `{ type: "ready", username, password }` → save to config + save `serverWorkerPid = child.pid` → return
   - `{ type: "error", message }` → throw error
4. Timeout after 30s → throw

#### `stopServer(config): Promise<void>`

1. Read `serverWorkerPid` from config
2. If PID exists and alive → `process.kill(pid, "SIGTERM")`
3. Clear `serverWorkerPid`, `username`, `password` in config

#### `checkServerHealth(hostname, port, username, password): Promise<boolean>`

HTTP GET to `/global/health` with Basic auth, 5s timeout. Returns `true`/`false`.

---

## `tunnel.ts`

### Functions

#### `startTunnel(config): Promise<void>`

1. Fork `tunnel-worker.ts` with `{ detached: true }`
2. Pass `authtoken`, `hostname`, `port` as args
3. Listen for IPC message:
   - `{ type: "ready", url }` → save `ngrokUrl` + `tunnelWorkerPid = child.pid` to config → return
   - `{ type: "error", message }` → throw error
4. Timeout after 30s → throw

#### `stopTunnel(config): Promise<void>`

1. Read `tunnelWorkerPid` from config
2. If PID exists and alive → `process.kill(pid, "SIGTERM")`
3. Clear `tunnelWorkerPid`, `ngrokUrl` in config

---

## `qr.ts`

Unchanged from current implementation.

```ts
function generateQR(url: string): Promise<void>
```
Prints QR code to terminal using `qrcode-terminal`.

---

## `tui.ts`

Unchanged from current implementation.

```ts
function attachTUI(hostname, port, username, password, cwd): ChildProcess
```
Spawns `opencode attach` with `stdio: "inherit"`.

---

## `index.ts` — CLI Commands

### Shared Helper

```ts
async function getServicesStatus(config): Promise<{
  serverUp: boolean;
  tunnelUp: boolean;
  ngrokUrl: string | null;
}>
```
Checks:
- `serverWorkerPid` alive + `checkServerHealth()` → `serverUp`
- `tunnelWorkerPid` alive → `tunnelUp`
- `config.ngrokUrl` → `ngrokUrl`

```ts
function printStatus(status): void
```
Prints per-service status:
```
✅ opencode server is running (localhost:4096)
✅ ngrok tunnel is running (https://xxxx.ngrok-free.app)
```
or
```
❌ opencode server is down
❌ ngrok tunnel is down
```

---

### Commands

#### `up` — Start all services

```
remote up
```

1. `loadConfig()`
2. `ensureNgrokConfig(config)` — prompt for authtoken if missing
3. `getServicesStatus(config)`
4. If **any service is running**:
   - `printStatus(status)`
   - Print: `"Services are already running. Run 'remote down' first."`
   - Exit with code 1
5. `startServer(config, cwd)` — fork worker, wait for IPC "ready"
6. `startTunnel(config)` — fork worker, wait for IPC "ready"
7. Print:
   ```
   ✅ opencode server is running (localhost:4096)
      Username: <username>
      Password: <password>
   ✅ ngrok tunnel is running
      URL: https://<user>:<pass>@xxxx.ngrok-free.app
   ```
8. `generateQR(authUrl)` — print QR code
9. Exit 0

#### `down` — Stop all services

```
remote down
```

1. `loadConfig()`
2. `getServicesStatus(config)`
3. If **nothing is running**:
   - Print: `"No services are running."`
   - Exit 0
4. `stopTunnel(config)`
5. `stopServer(config)`
6. `saveConfig(config)` — PIDs and URL cleared
7. Print: `"✅ All services stopped."`
8. Exit 0

#### `status` — Show service status

```
remote status
```

1. `loadConfig()`
2. `getServicesStatus(config)`
3. `printStatus(status)`
4. If tunnel is up, print: `URL: https://<user>:<pass>@xxxx.ngrok-free.app`
5. Exit 0

#### `qr` — Generate QR code

```
remote qr
```

1. `loadConfig()`
2. `getServicesStatus(config)`
3. If **any service is down**:
   - `printStatus(status)` — shows which are down
   - Print: `"Run 'remote up' to start all services."`
   - Exit 1
4. If **all up**:
   - Print: `URL: https://<user>:<pass>@xxxx.ngrok-free.app`
   - `generateQR(authUrl)`
5. Exit 0

#### `t` — Attach TUI

```
remote t
```

1. `loadConfig()`
2. `getServicesStatus(config)`
3. If **server is down**:
   - Print: `"❌ opencode server is down. Run 'remote up' first."`
   - Exit 1
4. If **server is up**:
   - Print: `"Attaching TUI..."`
   - `attachTUI(hostname, port, username!, password!, cwd)` — blocking
   - On TUI exit → exit with same code

#### `help` — Show help

```
remote help
remote --help
```

Handled automatically by Commander. Shows all commands with descriptions.

---

## Error Handling

- **Worker crashes**: Workers monitor their child processes and send IPC error messages before exiting. If a worker dies unexpectedly, `status`/`qr` will detect it via `isProcessAlive(pid)`.
- **Stale PIDs**: If a worker was killed outside the CLI (e.g. `kill -9`), the PID in config will be stale. `isProcessAlive()` returns `false`, and the next `up` will proceed normally.
- **Timeouts**: `startServer` and `startTunnel` both have 30s timeouts. On timeout, kill the forked worker and throw an error.
- **Partial failures in `up`**: If tunnel fails after server starts, stop the server before exiting.
- **Config corruption**: If config file is malformed, `loadConfig()` returns defaults. User can always `down` (no-op if nothing running) and `up` fresh.

## Dependencies

No new dependencies needed. Existing:
- `commander` — CLI framework
- `chalk` — colored output
- `@ngrok/ngrok` — tunnel SDK
- `qrcode-terminal` — QR generation
