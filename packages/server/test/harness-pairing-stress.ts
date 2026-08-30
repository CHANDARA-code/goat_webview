import { createGoatServer } from '../src/server';
import request from 'supertest';

async function runPairingAndAssetStressTest() {
  console.log('=== RUNNING DEEP DIVE 3 & 4: PAIRING RACE CONDITIONS & ASSET NORMALIZATION ===');
  const server = createGoatServer({
    port: 0,
    cdpPort: 0,
    safariPort: 0,
    inMemoryDb: true,
  });
  await server.start();
  const addr = server.httpServer.address() as any;
  const serverPort = addr.port;
  server.pairingManager.setHostAndPort('127.0.0.1', serverPort);

  // 1. Rapid QR generation
  console.log('Testing 500 rapid QR token creations...');
  const t0 = Date.now();
  const initPromises = [];
  for (let i = 0; i < 500; i++) {
    initPromises.push(server.pairingManager.createSession(`com.goat.app_${i}`));
  }
  const sessions = await Promise.all(initPromises);
  const duration = Date.now() - t0;
  console.log(`Generated 500 QR sessions in ${duration}ms (${((500 / duration) * 1000).toFixed(0)} sessions/sec)`);

  const tokens = new Set(sessions.map((s) => s.token));
  if (tokens.size !== 500) {
    throw new Error(`Token collision! Only ${tokens.size} unique tokens out of 500`);
  }

  // 2. Race condition: 50 concurrent handshakes on the same token
  console.log('Testing 50 concurrent handshakes on single token...');
  const testSession = sessions[0];
  const hsPromises = [];
  for (let i = 0; i < 50; i++) {
    hsPromises.push(
      Promise.resolve().then(() =>
        server.pairingManager.handshake(
          testSession.token,
          {
            platform: i % 2 === 0 ? 'android' : 'ios',
            osVersion: `1${i}.0`,
            deviceName: `Pixel_Race_${i}`,
          },
          `192.168.1.${i + 1}`
        )
      )
    );
  }

  const hsResults = await Promise.all(hsPromises);
  for (const r of hsResults) {
    if (!r || r.status !== 'ACTIVE') {
      throw new Error('Handshake failed during concurrency');
    }
  }

  const finalSession = server.pairingManager.getSession(testSession.token);
  console.log('Final session after 50 concurrent handshakes:', {
    token: finalSession?.token,
    status: finalSession?.status,
    deviceName: finalSession?.deviceName,
    platform: finalSession?.platform,
    ipAddress: finalSession?.ipAddress,
  });

  // 3. Asset path normalization / collision test
  console.log('Testing asset normalization and path traversal handling...');
  const appId = 'com.goat.norm.test';
  server.manifestService.registerAsset(appId, 'pages/home/index.js', 'console.log("home");', 'application/javascript');
  server.manifestService.registerAsset(appId, 'pages/home/../home/index.js', 'console.log("home-traversal");', 'application/javascript');

  const asset1 = server.manifestService.getAsset(appId, 'pages/home/index.js');
  const asset2 = server.manifestService.getAsset(appId, 'pages/home/../home/index.js');
  console.log('Asset 1 path:', asset1?.path, 'Content:', asset1?.content.toString());
  console.log('Asset 2 path:', asset2?.path, 'Content:', asset2?.content.toString());

  await server.stop();
  console.log('=== DEEP DIVE 3 & 4 COMPLETED SUCCESSFULLY ===\n');
}

runPairingAndAssetStressTest().catch((err) => {
  console.error('Deep dive 3 & 4 failed:', err);
  process.exit(1);
});
