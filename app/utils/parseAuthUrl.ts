export interface ParsedAuth {
  url: string;
  username: string;
  password: string;
}

export function parseAuthUrl(rawUrl: string): ParsedAuth | null {
  try {
    const withoutProtocol = rawUrl.replace("https://", "").replace("http://", "");
    const [credentials, hostAndPath] = withoutProtocol.split("@");
    if (!credentials || !hostAndPath) return null;

    const [username, password] = credentials.split(":");
    if (!username || !password) return null;

    const url = `https://${hostAndPath}`;
    return { url, username, password };
  } catch {
    return null;
  }
}
