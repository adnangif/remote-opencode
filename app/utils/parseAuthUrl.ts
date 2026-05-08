export interface ParsedAuth {
  url: string;
  username: string;
  password: string;
}

function isNgrokLink(url: string): boolean {
  const ngrokRegex =
    /^https:\/\/[a-zA-Z0-9-]+\.(?:ngrok-free\.app|ngrok-free\.dev|ngrok\.app|ngrok\.dev|ngrok\.pizza|ngrok-free\.pizza|ngrok\.io)(\/.*)?$/i;
  return ngrokRegex.test(url);
}

export type ParseResult =
  | { ok: true; data: ParsedAuth }
  | { ok: false; reason: "invalid_format" | "unrecognized_url" };

export function parseAuthUrl(rawUrl: string): ParseResult {
  try {
    const withoutProtocol = rawUrl.replace("https://", "").replace("http://", "");
    const [credentials, hostAndPath] = withoutProtocol.split("@");
    if (!credentials || !hostAndPath) {
      return { ok: false, reason: "invalid_format" };
    }

    const [username, password] = credentials.split(":");
    if (!username || !password) {
      return { ok: false, reason: "invalid_format" };
    }

    const url = `https://${hostAndPath}`;
    if (!isNgrokLink(url)) {
      return { ok: false, reason: "unrecognized_url" };
    }

    return { ok: true, data: { url, username, password } };
  } catch {
    return { ok: false, reason: "invalid_format" };
  }
}
