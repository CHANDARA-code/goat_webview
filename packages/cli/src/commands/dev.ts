import { parseArgs } from "node:util";
import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { existsSync } from "node:fs";

export interface DevOptions {
  port: number;
  mock: boolean;
  host: boolean;
  tunnel: boolean;
  serverPort: number;
}

function parseDevArgs(args: string[]): DevOptions {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", default: "3000" },
      mock: { type: "boolean", default: true },
      host: { type: "boolean", default: false },
      tunnel: { type: "boolean", default: false },
      "server-port": { type: "string", default: "7373" },
    },
    strict: false,
  });
  return {
    port: parseInt(values.port as string, 10),
    mock: values.mock as boolean,
    host: values.host as boolean,
    tunnel: values.tunnel as boolean,
    serverPort: parseInt(values["server-port"] as string, 10),
  };
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".ts": "text/typescript; charset=utf-8",
  ".tsx": "text/typescript; charset=utf-8",
};

const MOCK_BRIDGE_SHIM = `<script id="goat-bridge-mock">
(function () {
  var listeners = [];
  function mockData(req) {
    var payload = req.payload || {};
    switch (req.action) {
      case 'GET_DEVICE_INFO':
        return {
          model: 'Goat Dev Simulator', manufacturer: 'Goat', brand: 'goat',
          platform: 'Android', androidVersion: '15', sdkInt: 35,
          screenWidthDp: window.innerWidth || 390, screenHeightDp: window.innerHeight || 844,
          density: window.devicePixelRatio || 3, batteryLevel: 98, isCharging: true,
          isAlgorithmicDarkening: true, appVersion: '1.0.0-goat', installGuid: 'guid-dev-simulator'
        };
      case 'STORAGE_SET':
        try { localStorage.setItem('goat_' + payload.key, payload.value); } catch (e) {}
        return { saved: true, key: payload.key };
      case 'STORAGE_GET':
        try { return { value: localStorage.getItem('goat_' + payload.key) }; } catch (e) { return { value: null }; }
      case 'STORAGE_REMOVE':
        try { localStorage.removeItem('goat_' + payload.key); } catch (e) {}
        return { removed: true };
      case 'SECURE_STORAGE_SET':
        try { sessionStorage.setItem('goat_sec_' + payload.key, payload.value); } catch (e) {}
        return { saved: true, key: payload.key, appId: payload.appId || 'default' };
      case 'SECURE_STORAGE_GET':
        try { return { value: sessionStorage.getItem('goat_sec_' + payload.key), key: payload.key, appId: payload.appId || 'default' }; } catch (e) { return { value: null, key: payload.key }; }
      case 'SECURE_STORAGE_CLEAR':
        try { sessionStorage.clear(); } catch (e) {}
        return { cleared: true };
      case 'HAPTIC_FEEDBACK':
        return { status: 'vibrated', triggered: true, type: payload.type || 'impact', style: payload.style || 'medium' };
      case 'NAVIGATE_BACK':
        return { handled: true };
      case 'SHOW_TOAST':
        return { shown: true, title: payload.title || 'Toast' };
      case 'GET_NETWORK_TYPE':
        return { networkType: 'wifi', isConnected: true };
      case 'CHECK_PERMISSION':
      case 'REQUEST_PERMISSION':
        return { scope: payload.scope || 'scope.camera', granted: true };
      default:
        return { ok: true, action: req.action, mock: true };
    }
  }
  window.nativeBridge = {
    postMessage: function (message) {
      var req;
      try { req = JSON.parse(message); } catch (e) { return; }
      setTimeout(function () {
        var response = { id: req.id, action: req.action, success: true, data: mockData(req) };
        listeners.forEach(function (listener) { listener({ data: JSON.stringify(response) }); });
      }, 5);
    },
    addEventListener: function (type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    removeEventListener: function (type, listener) {
      listeners = listeners.filter(function (l) { return l !== listener; });
    }
  };
})();
</script>`;

function detectLanIp(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const entry of interfaces[name] ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return "127.0.0.1";
}

function contentLength(content: Buffer): number {
  return content.length;
}

export async function devCommand(args: string[]): Promise<void> {
  const opts = parseDevArgs(args);
  const root = resolve(process.cwd());
  const hostAddr = opts.host ? "0.0.0.0" : "localhost";

  console.log("\n🐐 Starting Goat Dev Server…");
  console.log(`   Port        : ${opts.port}`);
  console.log(`   Mock bridge : ${opts.mock ? "enabled" : "disabled"}`);
  console.log(`   LAN host    : ${opts.host ? "enabled" : "disabled"}`);
  console.log(`   QR tunnel   : ${opts.tunnel ? "enabled" : "disabled"}`);
  console.log(`   @goat/server: http://localhost:${opts.serverPort}\n`);

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";
      const filePath = resolve(root, pathname.slice(1));
      if (filePath !== root && !filePath.startsWith(root + "/")) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("403 Forbidden");
        return;
      }
      if (!existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
      }
      const info = await stat(filePath);
      if (info.isDirectory()) {
        const indexPath = join(filePath, "index.html");
        if (!existsSync(indexPath)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
          return;
        }
        const indexContent = await readFile(indexPath);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[".html"],
          "Content-Length": contentLength(indexContent),
          "Access-Control-Allow-Origin": "*",
        });
        res.end(indexContent);
        return;
      }
      let content = await readFile(filePath);
      if (extname(filePath) === ".html" && opts.mock) {
        content = Buffer.concat([
          content,
          Buffer.from(MOCK_BRIDGE_SHIM, "utf-8"),
        ]);
      }
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Content-Length": contentLength(content),
        "Access-Control-Allow-Origin": "*",
      });
      res.end(content);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("500 Internal Server Error");
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${opts.port} is already in use. Choose another with --port.`);
    } else {
      console.error(`\n❌ Dev server error: ${err.message}`);
    }
    process.exit(1);
  });

  await new Promise<void>((resolveReady) => {
    server.listen(opts.port, hostAddr, () => resolveReady());
  });

  console.log(`[GoatDev] Dev server listening on http://${hostAddr}:${opts.port}`);
  console.log(`[GoatDev] Serving project directory: ${root}`);
  console.log(
    `[GoatDev] Virtual domain: http://appassets.androidplatform.net:${opts.port}`,
  );
  if (opts.mock) {
    console.log(
      "[GoatDev] @goat/bridge-mock inline shim injected into HTML pages",
    );
  }
  if (opts.tunnel) {
    const lanIp = detectLanIp();
    const qrCode = `http://${lanIp}:${opts.port}`;
    console.log(`[GoatDev] QR pairing URL: ${qrCode}`);
  }
  console.log(
    `[GoatDev] Pairing relay configured at http://localhost:${opts.serverPort} (requires @goat/server)`,
  );
  console.log("\n✅ Dev server ready. Press Ctrl+C to stop.");

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {});
}
