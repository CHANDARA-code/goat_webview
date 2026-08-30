import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { createServer, type Server, type IncomingMessage } from "node:http";
import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";

export interface StudioOptions {
  port: number;
  serverPort: number;
  project: string;
  open: boolean;
  host: boolean;
}

export function parseStudioArgs(args: string[]): StudioOptions {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", default: "5173" },
      "server-port": { type: "string", default: "7373" },
      project: { type: "string", short: "p", default: "." },
      open: { type: "boolean", default: true },
      "no-open": { type: "boolean", default: false },
      host: { type: "boolean", default: false },
    },
    strict: false,
  });

  const shouldOpen = values["no-open"] ? false : (values.open ?? true);

  return {
    port: parseInt(values.port as string, 10) || 5173,
    serverPort: parseInt(values["server-port"] as string, 10) || 7373,
    project: resolve(process.cwd(), values.project as string),
    open: Boolean(shouldOpen),
    host: Boolean(values.host),
  };
}

interface WsClient {
  socket: Socket;
  send(text: string): void;
}

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function acceptWebSocketKey(key: string): string {
  return createHash("sha1").update(key + WS_GUID).digest("base64");
}

function decodeFrame(chunk: Buffer): string | null {
  if (chunk.length < 2) return null;
  const first = chunk[0];
  const second = chunk[1];
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (chunk.length < 4) return null;
    length = chunk.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (chunk.length < 10) return null;
    const big = chunk.readBigUInt64BE(2);
    length = Number(big);
    offset = 10;
  }
  if (!masked) return null;
  const maskKey = chunk.slice(offset, offset + 4);
  offset += 4;
  if (chunk.length < offset + length) return null;
  const payload = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    payload[i] = chunk[offset + i] ^ maskKey[i % 4];
  }
  if (opcode === 8) return null;
  if (opcode === 9) return "__ping__";
  if (opcode === 10) return null;
  return payload.toString("utf-8");
}

function encodeFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf-8");
  const header = Buffer.alloc(2);
  header[0] = 0x81;
  if (payload.length < 126) {
    header[1] = payload.length;
    return Buffer.concat([header, payload]);
  }
  header[1] = 126;
  const extended = Buffer.alloc(2);
  extended.writeUInt16BE(payload.length, 0);
  return Buffer.concat([header, extended, payload]);
}

const STUDIO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat DevTools Studio</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    header { padding: 16px 24px; border-bottom: 1px solid #1e293b; }
    h1 { margin: 0; font-size: 20px; }
    main { padding: 24px; }
    .status { background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #0f172a; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; margin-right: 8px; }
    .dot.connected { background: #22c55e; }
    #log { font-family: monospace; font-size: 12px; background: #020617; border-radius: 8px; padding: 16px; min-height: 120px; max-height: 320px; overflow: auto; white-space: pre-wrap; }
    button { background: #2563eb; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; }
  </style>
</head>
<body>
  <header><h1>🐐 Goat DevTools Studio</h1></header>
  <main>
    <div class="status" id="status">
      <div class="row"><span>Project</span><span id="project"></span></div>
      <div class="row"><span>CDP Relay</span><span><span class="dot" id="relayDot"></span><span id="relay"></span></span></div>
      <div class="row"><span>@goat/server</span><span id="server"></span></div>
    </div>
    <div style="margin-bottom: 12px;"><button id="probe">Send Bridge Probe</button></div>
    <div id="log">[Studio] awaiting connection…</div>
  </main>
  <script>
    var log = document.getElementById('log');
    var probe = document.getElementById('probe');
    var dot = document.getElementById('relayDot');
    var ws;
    function append(line) { log.textContent += '\\n' + line; log.scrollTop = log.scrollHeight; }
    function connect() {
      var proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(proto + '://' + location.host + '/__goat/ws');
      ws.onopen = function () { dot.classList.add('connected'); append('[Relay] connected'); };
      ws.onclose = function () { dot.classList.remove('connected'); append('[Relay] disconnected'); };
      ws.onmessage = function (event) { append('[Relay] ' + event.data); };
    }
    probe.addEventListener('click', function () {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'probe', action: 'GET_DEVICE_INFO', at: Date.now() }));
      }
    });
    fetch('/__goat/status.json').then(function (r) { return r.json(); }).then(function (info) {
      document.getElementById('project').textContent = info.project;
      document.getElementById('relay').textContent = 'ws://' + info.host + ':' + info.port + '/__goat/ws';
      document.getElementById('server').textContent = 'http://localhost:' + info.serverPort;
    });
    connect();
  </script>
</body>
</html>
`;

function launchBrowser(url: string): void {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(command, (err) => {
    if (err) {
      console.error(`[GoatStudio] Could not open browser: ${err.message}`);
    }
  });
}

export async function studioCommand(args: string[]): Promise<void> {
  const opts = parseStudioArgs(args);
  const hostAddr = opts.host ? "0.0.0.0" : "localhost";
  const studioUrl = `http://${opts.host ? "127.0.0.1" : "localhost"}:${opts.port}`;

  console.log("\n🐐 Starting Goat DevTools Studio IDE…");
  console.log(`   Studio UI   : ${studioUrl}`);
  console.log(`   Host        : ${hostAddr}`);
  console.log(`   Project Dir : ${opts.project}`);
  console.log(`   Relay Server: http://localhost:${opts.serverPort}`);
  console.log(`   Auto-Open   : ${opts.open ? "yes" : "no"}\n`);

  const wsClients = new Set<WsClient>();

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/__goat/status.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          project: opts.project,
          port: opts.port,
          host: hostAddr,
          serverPort: opts.serverPort,
          startedAt: new Date().toISOString(),
          projectExists: existsSync(opts.project),
        }),
      );
      return;
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(STUDIO_HTML);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  });

  server.on("upgrade", (req: IncomingMessage, socket: Socket) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/__goat/ws") {
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"] as string | undefined;
    if (!key) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${acceptWebSocketKey(key)}\r\n\r\n`,
    );
    const client: WsClient = {
      socket,
      send(text: string) {
        if (!socket.writable) return;
        socket.write(encodeFrame(text));
      },
    };
    wsClients.add(client);
    socket.on("data", (chunk: Buffer) => {
      try {
        const text = decodeFrame(chunk);
        if (text === "__ping__") {
          socket.write(Buffer.from([0x8a, 0x00]));
          return;
        }
        if (text) {
          for (const other of wsClients) {
            if (other !== client) other.send(text);
          }
        }
      } catch {
        return;
      }
    });
    socket.on("close", () => {
      wsClients.delete(client);
    });
    socket.on("error", () => {
      wsClients.delete(client);
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${opts.port} is already in use. Choose another with --port.`);
    } else {
      console.error(`\n❌ Studio server error: ${err.message}`);
    }
    process.exit(1);
  });

  await new Promise<void>((resolveReady) => {
    server.listen(opts.port, hostAddr, () => resolveReady());
  });

  console.log(`[GoatStudio] DevTools Studio server listening on ${studioUrl}`);
  console.log(`[GoatStudio] Connected to Mini-App workspace: ${opts.project}`);
  console.log(
    `[GoatStudio] CDP WebSocket bridge relay listening on ws://${hostAddr}:${opts.port}/__goat/ws`,
  );

  if (opts.open) {
    console.log(`[GoatStudio] Opening browser at ${studioUrl}`);
    launchBrowser(studioUrl);
  }

  console.log("\n✨ DevTools Studio is running. Press Ctrl+C to exit.");

  const shutdown = () => {
    for (const client of wsClients) {
      client.socket.destroy();
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {});
}
