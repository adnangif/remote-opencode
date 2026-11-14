import http from "node:http";
import net from "node:net";
import { send } from "./process-utils.js";

// Local reverse proxy that injects the opencode server password, so the
// tailnet can reach opencode without credentials (opencode v2 always
// requires a password).

const targetHost = process.argv[2];
const targetPort = Number(process.argv[3]);
const listenPort = Number(process.argv[4]);
const password = process.env.ROC_SERVER_PASSWORD ?? "";
delete process.env.ROC_SERVER_PASSWORD;

const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;

function proxyHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  return { ...headers, authorization };
}

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: targetHost,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: proxyHeaders(req.headers),
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("Bad gateway");
  });
  req.on("aborted", () => upstream.destroy());
  res.on("close", () => upstream.destroy());

  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(targetPort, targetHost, () => {
    const headers = proxyHeaders(req.headers);
    let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) raw += `${name}: ${v}\r\n`;
    }
    upstream.write(raw + "\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.on("error", (err) => {
  send({ type: "error", message: `Proxy failed to listen on port ${listenPort}: ${err.message}` });
  process.exit(1);
});

server.listen(listenPort, "127.0.0.1", () => {
  send({ type: "ready" });
  if (process.disconnect) process.disconnect();
});

process.on("SIGTERM", () => {
  process.exit(0);
});
