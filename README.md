# Opencode Remote

Opencode Remote is a companion project for controlling an `opencode` session from a phone. It includes a published CLI package and a mobile app:

- `cli/`: TypeScript CLI published as `opencode-rocks`; it installs the `roc` command.
- `app/`: Expo React Native app for scanning a `roc` QR code and opening the remote opencode UI.

## How it works

1. Run `roc up`.
2. `roc` starts `opencode serve` on the pre-configured host and port.
3. `roc` exposes a the opencode's official web interface through ngrok or Tailscale securely.
4. `roc` prints a tunnel URL and QR code.
5. The mobile app scans the QR code and opens the session in a WebView.

Runtime state is stored in `~/.opencode-proxy.json`.

## CLI

Install:

```bash
npm i -g opencode-rocks
```

Use:

```bash
roc configure --guided
roc up
roc status
roc share
roc t
roc down
```

Tunnel providers:

- ngrok: public HTTPS tunnel with generated basic-auth credentials.
- Tailscale: private HTTPS tunnel on your tailnet.

## Mobile app

Run locally:

```bash
cd app
npm install
npm run start
```

The app supports QR codes for ngrok URLs with embedded credentials and Tailscale `*.ts.net` URLs without credentials. Recent links are stored locally on the device.

## Development

Build the CLI:

```bash
cd cli
pnpm install
pnpm build
```

Run the app:

```bash
cd app
npm install
npm run android
```
