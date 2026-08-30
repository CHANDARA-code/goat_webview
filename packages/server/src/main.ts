import { Command } from 'commander';
import { createGoatServer } from './server';

export async function runServer(): Promise<void> {
  const program = new Command();

  program
    .name('goat-server')
    .description('Goat Tooling Backend Service, CDP Relay & Trace Telemetry Gateway')
    .version('1.4.0')
    .option('-p, --port <number>', 'REST API & Tunnel server port', (val) => parseInt(val, 10), 3001)
    .option('-c, --cdp-port <number>', 'Chrome DevTools Protocol (CDP) port', (val) => parseInt(val, 10), 9222)
    .option('-s, --safari-port <number>', 'Safari WebKit inspector proxy port', (val) => parseInt(val, 10), 9223)
    .option('-H, --host <host>', 'Bind hostname/IP', '0.0.0.0')
    .option('-d, --db-path <path>', 'SQLite database path', './data/goat_telemetry.db')
    .option('--in-memory', 'Use in-memory SQLite database', false)
    .option('--mock', 'Enable bridge mock injection and overrides', true)
    .option('--no-mock', 'Disable bridge mock injection')
    .parse(process.argv);

  const opts = program.opts();

  const server = createGoatServer({
    port: opts.port,
    cdpPort: opts.cdpPort,
    safariPort: opts.safariPort,
    host: opts.host,
    dbPath: opts.inMemory ? ':memory:' : opts.dbPath,
    inMemoryDb: opts.inMemory,
    mock: opts.mock,
  });

  try {
    await server.start();
    console.log(`
  ============================================================
    🐐 Goat Developer Tooling Backend v1.4.0
  ============================================================
    📡 HTTP & REST Server:     http://${opts.host}:${opts.port}
    🔍 CDP Discovery Engine:   http://${opts.host}:${opts.cdpPort}/json/version
    🔗 CDP WebSocket Relay:    ws://${opts.host}:${opts.cdpPort}/devtools/page/...
    📱 QR Pairing & Tunnel:    http://${opts.host}:${opts.port}/api/pair/init
    📊 Bridge IPC Traces DB:   ${opts.inMemory ? ':memory:' : opts.dbPath}
    ✨ Health Check:           http://${opts.host}:${opts.port}/api/health
  ============================================================
  `);
  } catch (err: any) {
    console.error('❌ Failed to start Goat Server:', err.message);
    process.exit(1);
  }

  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down Goat Server...`);
    await server.stop();
    console.log('✅ Server gracefully stopped.');
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

if (require.main === module) {
  runServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
