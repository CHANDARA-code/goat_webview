import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 4: Networking, HTTP & WebSockets', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('API_REQUEST returns structured HTTP response', async () => {
    const res = await bridge.callNative('API_REQUEST', {
      url: 'https://api.goat.dev/v1/user/profile',
      method: 'GET',
    });
    assert.equal(res.status, 200);
    assert.equal(res.statusText, 'OK');
    assert.equal(typeof res.durationMs, 'number');
  });

  await t.test('API_REQUEST blocks SSRF targets', async () => {
    const blocked = [
      'http://169.254.169.254/latest/meta-data',
      'http://169.254.1.1/internal',
      'http://127.0.0.1:8080/admin',
      'http://127.0.0.2:3000/internal',
      'http://localhost:8080/',
      'http://test.localhost/api',
      'http://10.0.0.1/status',
      'http://10.255.255.255/secret',
      'http://172.16.0.1/config',
      'http://172.31.255.255/admin',
      'http://192.168.0.1/router',
      'http://192.168.1.100:8080/data',
      'http://0.0.0.0:8000/',
      'http://[::1]/debug',
      'http://[::1]:8080/metrics',
    ];

    for (const url of blocked) {
      await assert.rejects(
        () => bridge.callNative('API_REQUEST', { url }),
        (err: any) => err.code === BridgeErrorCodes.SSRF_BLOCKED,
        `Expected ${url} to be blocked by SSRF protection`
      );
    }
  });

  await t.test('API_REQUEST rejects when network is offline', async () => {
    mockState.network.isConnected = false;
    await assert.rejects(
      () => bridge.callNative('API_REQUEST', { url: 'https://api.goat.dev/ping' }),
      (err: any) => err.code === BridgeErrorCodes.NETWORK_OFFLINE
    );
    mockState.network.isConnected = true; // Restore
  });

  await t.test('DOWNLOAD_FILE and UPLOAD_FILE', async () => {
    const downloadRes = await bridge.callNative('DOWNLOAD_FILE', {
      url: 'https://cdn.goat.dev/assets/bundle.zip',
      fileName: 'bundle.zip',
    });
    assert.equal(downloadRes.status, 'COMPLETED');
    assert.equal(downloadRes.fileName, 'bundle.zip');

    const uploadRes = await bridge.callNative('UPLOAD_FILE', {
      url: 'https://api.goat.dev/upload',
      filePath: '/cache/photo.jpg',
    });
    assert.equal(uploadRes.statusCode, 200);
  });

  await t.test('GET_NETWORK_TYPE and IS_CONNECTED', async () => {
    const netRes = await bridge.callNative('GET_NETWORK_TYPE');
    assert.equal(netRes.networkType, 'wifi');
    assert.equal(netRes.isConnected, true);

    const isConn = await bridge.callNative('IS_CONNECTED');
    assert.equal(isConn.isConnected, true);
  });

  await t.test('WEBSOCKET_CONNECT / SEND / CLOSE lifecycle', async () => {
    const connRes = await bridge.callNative('WEBSOCKET_CONNECT', {
      url: 'wss://echo.goat.dev/ws',
    });
    assert.equal(connRes.connected, true);

    const sendRes = await bridge.callNative('WEBSOCKET_SEND', { data: 'PING' });
    assert.equal(sendRes.sent, true);

    const closeRes = await bridge.callNative('WEBSOCKET_CLOSE');
    assert.equal(closeRes.closed, true);
  });

  await t.test('VERIFY_SSL_PIN and AUDIT_NETWORK_CERTIFICATE', async () => {
    const pinRes = await bridge.callNative('VERIFY_SSL_PIN', {
      hostname: 'api.goat.dev',
      pinSha256: 'pin-sha256="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
    });
    assert.equal(pinRes.isPinned, true);
    assert.equal(pinRes.isCertificateValid, true);

    const certRes = await bridge.callNative('AUDIT_NETWORK_CERTIFICATE', {
      url: 'https://secure.goat.dev',
    });
    assert.equal(certRes.isCertificateValid, true);
  });
});
