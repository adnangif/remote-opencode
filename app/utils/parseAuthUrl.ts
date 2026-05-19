export interface ParsedAuth {
  url: string;
  username: string;
  password: string;
}

function isRecognizedUrl(url: string): boolean {
  const ngrokRegex =
    /^https:\/\/[a-zA-Z0-9-]+\.(?:ngrok-free\.app|ngrok-free\.dev|ngrok\.app|ngrok\.dev|ngrok\.pizza|ngrok-free\.pizza|ngrok\.io)(\/.*)?$/i;
  const tailscaleRegex = /^https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.ts\.net(\/.*)?$/i;
  return ngrokRegex.test(url) || tailscaleRegex.test(url);
}

export type ParseResult =
  | { ok: true; data: ParsedAuth }
  | { ok: false; reason: "invalid_format" | "unrecognized_url" };

export function parseAuthUrl(rawUrl: string): ParseResult {
  try {
    const withoutProtocol = rawUrl.replace("https://", "").replace("http://", "");
    const atIndex = withoutProtocol.indexOf("@");

    if (atIndex !== -1) {
      const credentials = withoutProtocol.slice(0, atIndex);
      const hostAndPath = withoutProtocol.slice(atIndex + 1);
      const [username, password] = credentials.split(":");
      if (!username || !password) {
        return { ok: false, reason: "invalid_format" };
      }

      const url = `https://${hostAndPath}`;
      if (!isRecognizedUrl(url)) {
        return { ok: false, reason: "unrecognized_url" };
      }

      return { ok: true, data: { url, username, password } };
    }

    // No credentials: plain URL (tailscale format)
    const url = rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
    if (!isRecognizedUrl(url)) {
      return { ok: false, reason: "unrecognized_url" };
    }

    return { ok: true, data: { url, username: "", password: "" } };
  } catch {
    return { ok: false, reason: "invalid_format" };
  }
}
