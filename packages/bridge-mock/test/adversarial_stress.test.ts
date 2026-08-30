import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GoatBridgeMock,
  mockState,
  BridgeErrorCodes,
  GoatBridgeError,
} from '../src/index.js';

test('Adversarial Stress Test Suite: Challenger 2 Evaluation', async (suite) => {
  // Reset state before running suite
  mockState.reset();

  // =========================================================================
  // 1. Malformed Parameters across Diverse Bridge Actions
  // =========================================================================
  await suite.test('1. Malformed Parameters & Boundary Edge Cases', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'adversarial_params_app' });

    await t.test('1.1 Unknown / Unsupported action strings', async () => {
      await assert.rejects(
        () => bridge.callNative('NON_EXISTENT_ACTION_STRING_XYZ', {}),
        (err: any) => err.code === BridgeErrorCodes.UNSUPPORTED_ACTION
      );
      await assert.rejects(
        () => bridge.callNative('', {}),
        (err: any) => err.code === BridgeErrorCodes.UNSUPPORTED_ACTION
      );
    });

    await t.test('1.2 Storage domain parameter validation', async () => {
      // Empty key
      await assert.rejects(
        () => bridge.callNative('STORAGE_SET', { key: '', value: 'val' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      // Whitespace key
      await assert.rejects(
        () => bridge.callNative('STORAGE_SET', { key: '   ', value: 'val' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      // Null / Non-string key
      await assert.rejects(
        () => bridge.callNative('STORAGE_SET', { key: null, value: 'val' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('STORAGE_GET', { key: 12345 }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('STORAGE_REMOVE', { key: undefined }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Secure storage invalid key checks
      await assert.rejects(
        () => bridge.callNative('SECURE_STORAGE_SET', { key: '', value: 'sec' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('SECURE_STORAGE_GET', { key: {} }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('SECURE_STORAGE_REMOVE', { key: null }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // HTTP Auth missing host
      await assert.rejects(
        () => bridge.callNative('HTTP_AUTH_SAVE_CREDENTIAL', { username: 'admin' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
    });

    await t.test('1.3 UI, Telephony, OAuth, Push parameter validation', async () => {
      // SHOW_ACTION_SHEET with empty itemList
      await assert.rejects(
        () => bridge.callNative('SHOW_ACTION_SHEET', { itemList: [] }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // START_OAUTH_SESSION with missing authUrl
      await assert.rejects(
        () => bridge.callNative('START_OAUTH_SESSION', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // START_OAUTH_SESSION with insecure HTTP url
      await assert.rejects(
        () => bridge.callNative('START_OAUTH_SESSION', { authUrl: 'http://insecure-oauth.com' }),
        (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
      );

      // OPEN_EXTERNAL_LINK with missing url
      await assert.rejects(
        () => bridge.callNative('OPEN_EXTERNAL_LINK', { url: '' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Telephony missing phoneNumber
      await assert.rejects(
        () => bridge.callNative('MAKE_PHONE_CALL', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('SEND_SMS', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Push missing topic
      await assert.rejects(
        () => bridge.callNative('SUBSCRIBE_PUSH_TOPIC', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('UNSUBSCRIBE_PUSH_TOPIC', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Permissions missing scope
      await assert.rejects(
        () => bridge.callNative('CHECK_PERMISSION', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('REQUEST_PERMISSION', { scope: '' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Media missing image urls for preview
      await assert.rejects(
        () => bridge.callNative('PREVIEW_IMAGE', { urls: [] }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Web3 sign transaction missing "to"
      await assert.rejects(
        () => bridge.callNative('WEB3_SIGN_TRANSACTION', { value: '100' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Payment missing invoiceSlug
      await assert.rejects(
        () => bridge.callNative('OPEN_INVOICE', {}),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      // Binary IPC missing port
      await assert.rejects(
        () => bridge.callNative('POST_BINARY_MESSAGE', { portId: 'non_existent_port_999', dataBase64: 'AA==' }),
        (err: any) => err.code === BridgeErrorCodes.PORT_NOT_FOUND
      );

      // Native Views missing / non-existent componentId for update
      await assert.rejects(
        () => bridge.callNative('UPDATE_NATIVE_VIEW_BOUNDS', { componentId: 'unknown_view_id', x: 10 }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
    });
  });

  // =========================================================================
  // 2. SSRF and Forbidden IP Checks in Networking Handlers
  // =========================================================================
  await suite.test('2. SSRF Guardrails & Network Error Handling', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'ssrf_test_app' });

    const blockedUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.169.254:8080/computeMetadata/v1/',
      'http://127.0.0.1:8000/admin',
      'http://127.0.0.1:3000/internal-debug',
      'http://localhost:8080/metrics',
      'http://localhost:9222/json',
      'http://10.0.0.1/router-login',
      'http://10.254.1.1/internal',
      'http://192.168.1.1/gateway',
      'http://192.168.0.100:8080/api',
    ];

    for (const rawUrl of blockedUrls) {
      await t.test(`SSRF blocked for target: ${rawUrl}`, async () => {
        await assert.rejects(
          () => bridge.callNative('API_REQUEST', { url: rawUrl }),
          (err: any) => {
            assert.equal(err.code, BridgeErrorCodes.SSRF_BLOCKED);
            assert.match(err.message, /SSRF protection/);
            return true;
          }
        );
      });
    }

    await t.test('SSRF Protection: 172.16.x.x, 127.0.0.2, [::1], 0.0.0.0 are all blocked', async () => {
      const extendedBlockedUrls = [
        'http://172.16.0.1/status',
        'http://172.31.255.255/internal',
        'http://127.0.0.2/admin',
        'http://[::1]/metrics',
        'http://0.0.0.0:8000/',
      ];

      for (const url of extendedBlockedUrls) {
        await assert.rejects(
          () => bridge.callNative('API_REQUEST', { url }),
          (err: any) => err.code === BridgeErrorCodes.SSRF_BLOCKED,
          `Expected ${url} to be blocked by SSRF protection`
        );
      }
    });

    await t.test('Malformed URL string rejected with INVALID_ARGUMENT', async () => {
      await assert.rejects(
        () => bridge.callNative('API_REQUEST', { url: 'not-a-valid-url-protocol' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('API_REQUEST', { url: null }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
    });

    await t.test('Public URL succeeds and echoes response envelope', async () => {
      mockState.network.isConnected = true;
      const res = await bridge.callNative('API_REQUEST', {
        url: 'https://api.goat.dev/v1/user/profile',
        method: 'POST',
        body: { userId: 'usr_1001' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.statusText, 'OK');
      assert.deepEqual(res.data.echoPayload, { userId: 'usr_1001' });
      assert.equal(typeof res.durationMs, 'number');
    });

    await t.test('Offline state rejects API_REQUEST and WEBSOCKET_CONNECT', async () => {
      mockState.network.isConnected = false;

      await assert.rejects(
        () => bridge.callNative('API_REQUEST', { url: 'https://api.goat.dev/data' }),
        (err: any) => err.code === BridgeErrorCodes.NETWORK_OFFLINE
      );

      await assert.rejects(
        () => bridge.callNative('WEBSOCKET_CONNECT', { url: 'wss://stream.goat.dev/socket' }),
        (err: any) => err.code === BridgeErrorCodes.NETWORK_OFFLINE
      );

      // Restore network
      mockState.network.isConnected = true;
    });
  });

  // =========================================================================
  // 3. Path Traversal & Sandbox Filesystem Integrity
  // =========================================================================
  await suite.test('3. Sandboxed FileSystem Security & Traversal Protection', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'fs_adversarial_app' });

    const traversalVectors = [
      '../../etc/passwd',
      '/../../etc/shadow',
      '/var/log/../../../etc/hosts',
      '..\\..\\windows\\system32',
      '//root/private.key',
      '/documents//secrets.txt',
      'folder/../../sensitive.dat',
      './../root',
    ];

    for (const vector of traversalVectors) {
      await t.test(`Path traversal rejected: "${vector}"`, async () => {
        await assert.rejects(
          () => bridge.callNative('FS_WRITE_FILE', { filePath: vector, data: 'malicious' }),
          (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
        );
        await assert.rejects(
          () => bridge.callNative('FS_READ_FILE', { filePath: vector }),
          (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
        );
        await assert.rejects(
          () => bridge.callNative('FS_STAT', { filePath: vector }),
          (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
        );
        await assert.rejects(
          () => bridge.callNative('FS_UNLINK', { filePath: vector }),
          (err: any) => err.code === BridgeErrorCodes.SECURITY_VIOLATION
        );
      });
    }

    await t.test('Missing / Invalid path arguments rejected', async () => {
      await assert.rejects(
        () => bridge.callNative('FS_WRITE_FILE', { filePath: '', data: 'content' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
      await assert.rejects(
        () => bridge.callNative('FS_READ_FILE', { filePath: null }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
    });

    await t.test('Reading non-existent file or directory as file throws INVALID_ARGUMENT', async () => {
      await assert.rejects(
        () => bridge.callNative('FS_READ_FILE', { filePath: '/non_existent_file_999.txt' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );

      await bridge.callNative('FS_MKDIR', { dirPath: '/test_dir_folder' });
      await assert.rejects(
        () => bridge.callNative('FS_READ_FILE', { filePath: '/test_dir_folder' }),
        (err: any) => err.code === BridgeErrorCodes.INVALID_ARGUMENT
      );
    });

    await t.test('FileSystem Quota Limit (50MB) Enforcement', async () => {
      // Mock large write exceeding 50MB
      const hugeData = 'X'.repeat(51 * 1024 * 1024);
      await assert.rejects(
        () => bridge.callNative('FS_WRITE_FILE', { filePath: '/huge_file.bin', data: hugeData }),
        (err: any) => err.code === BridgeErrorCodes.STORAGE_QUOTA_EXCEEDED
      );
    });

    await t.test('Recursive rmdir cleanup', async () => {
      await bridge.callNative('FS_MKDIR', { dirPath: '/deep' });
      await bridge.callNative('FS_WRITE_FILE', { filePath: '/deep/a.txt', data: '1' });
      await bridge.callNative('FS_WRITE_FILE', { filePath: '/deep/sub/b.txt', data: '2' });

      assert.equal((await bridge.callNative('FS_EXISTS', { filePath: '/deep/a.txt' })).exists, true);
      assert.equal((await bridge.callNative('FS_EXISTS', { filePath: '/deep/sub/b.txt' })).exists, true);

      await bridge.callNative('FS_RMDIR', { dirPath: '/deep' });

      assert.equal((await bridge.callNative('FS_EXISTS', { filePath: '/deep/a.txt' })).exists, false);
      assert.equal((await bridge.callNative('FS_EXISTS', { filePath: '/deep/sub/b.txt' })).exists, false);
      assert.equal((await bridge.callNative('FS_EXISTS', { filePath: '/deep' })).exists, false);
    });
  });

  // =========================================================================
  // 4. Geofence Boundary Calculations (Exact Haversine Transitions)
  // =========================================================================
  await suite.test('4. Geofence Boundary Calculations & Haversine Accuracy', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'geofence_test_app' });

    // Set center coordinates: San Francisco City Hall (37.77928, -122.41914)
    const centerLat = 37.77928;
    const centerLng = -122.41914;
    const radiusMeters = 200; // 200 meter radius

    // Register 3 geofences with different transition triggers
    await bridge.callNative('START_GEOFENCE', {
      geofenceId: 'fence_both',
      latitude: centerLat,
      longitude: centerLng,
      radiusMeters,
      transitionType: 'BOTH',
    });

    await bridge.callNative('START_GEOFENCE', {
      geofenceId: 'fence_enter_only',
      latitude: centerLat,
      longitude: centerLng,
      radiusMeters,
      transitionType: 'ENTER',
    });

    await bridge.callNative('START_GEOFENCE', {
      geofenceId: 'fence_exit_only',
      latitude: centerLat,
      longitude: centerLng,
      radiusMeters,
      transitionType: 'EXIT',
    });

    await t.test('Point exactly at center evaluates to ENTER for BOTH and ENTER_ONLY', async () => {
      const result = await bridge.callNative('EVALUATE_GEOFENCE', {
        latitude: centerLat,
        longitude: centerLng,
      });

      const enterEvents = result.events.filter((e: any) => e.transition === 'ENTER');
      const exitEvents = result.events.filter((e: any) => e.transition === 'EXIT');

      const enterIds = enterEvents.map((e: any) => e.geofenceId);
      assert.equal(enterIds.includes('fence_both'), true);
      assert.equal(enterIds.includes('fence_enter_only'), true);
      assert.equal(enterIds.includes('fence_exit_only'), false);
      assert.equal(exitEvents.length, 0);
    });

    await t.test('Point well inside perimeter (~50m away) triggers ENTER', async () => {
      // ~50m north: approx +0.00045 degrees latitude
      const result = await bridge.callNative('EVALUATE_GEOFENCE', {
        latitude: centerLat + 0.00045,
        longitude: centerLng,
      });
      const enterIds = result.events.filter((e: any) => e.transition === 'ENTER').map((e: any) => e.geofenceId);
      assert.equal(enterIds.includes('fence_both'), true);
    });

    await t.test('Point well outside perimeter (~2km away) triggers EXIT for BOTH and EXIT_ONLY', async () => {
      // ~2km north: approx +0.018 degrees latitude
      const result = await bridge.callNative('EVALUATE_GEOFENCE', {
        latitude: centerLat + 0.018,
        longitude: centerLng,
      });

      const exitEvents = result.events.filter((e: any) => e.transition === 'EXIT');
      const exitIds = exitEvents.map((e: any) => e.geofenceId);

      assert.equal(exitIds.includes('fence_both'), true);
      assert.equal(exitIds.includes('fence_exit_only'), true);
      assert.equal(exitIds.includes('fence_enter_only'), false);
    });

    await t.test('Stopping geofence removes region', async () => {
      const stopRes = await bridge.callNative('STOP_GEOFENCE', { geofenceId: 'fence_enter_only' });
      assert.equal(stopRes.stopped, true);

      const listRes = await bridge.callNative('LIST_GEOFENCES');
      const ids = listRes.geofences.map((g: any) => g.geofenceId);
      assert.equal(ids.includes('fence_enter_only'), false);
      assert.equal(ids.includes('fence_both'), true);
    });
  });

  // =========================================================================
  // 5. State Machine Concurrency & Multi-Tenant App Isolation
  // =========================================================================
  await suite.test('5. Multi-Tenant State Isolation & Rapid Concurrency', async (t) => {
    const appIds = ['tenant_alpha', 'tenant_beta', 'tenant_gamma', 'tenant_delta', 'tenant_epsilon'];
    const bridges = appIds.map((id) => new GoatBridgeMock({ appId: id }));

    await t.test('Strict multi-tenant storage and filesystem isolation', async () => {
      // Parallel writes across 5 tenants
      await Promise.all(
        bridges.map((b, idx) =>
          Promise.all([
            b.callNative('STORAGE_SET', { key: 'account_id', value: `acc_${idx}` }),
            b.callNative('SECURE_STORAGE_SET', { key: 'secret_key', value: `sec_${idx}` }),
            b.callNative('FS_WRITE_FILE', { filePath: '/profile.json', data: JSON.stringify({ tenantIndex: idx }) }),
            b.callNative('COOKIE_SET', { value: `session=tok_${idx}` }),
          ])
        )
      );

      // Verify each tenant receives ONLY their own data
      for (let i = 0; i < bridges.length; i++) {
        const b = bridges[i];
        const storeRes = await b.callNative('STORAGE_GET', { key: 'account_id' });
        assert.equal(storeRes.value, `acc_${i}`);

        const secRes = await b.callNative('SECURE_STORAGE_GET', { key: 'secret_key' });
        assert.equal(secRes.value, `sec_${i}`);

        const fsRes = await b.callNative('FS_READ_FILE', { filePath: '/profile.json' });
        assert.equal(JSON.parse(fsRes.data).tenantIndex, i);

        const cookieRes = await b.callNative('COOKIE_GET');
        assert.equal(cookieRes.cookies[0]?.value, `tok_${i}`);
      }

      // Clearing tenant_alpha does NOT affect tenant_beta
      await bridges[0].callNative('STORAGE_CLEAR');
      await bridges[0].callNative('SECURE_STORAGE_CLEAR');

      const alphaCleared = await bridges[0].callNative('STORAGE_GET', { key: 'account_id' });
      assert.equal(alphaCleared.value, null);

      const betaUntouched = await bridges[1].callNative('STORAGE_GET', { key: 'account_id' });
      assert.equal(betaUntouched.value, 'acc_1');
    });

    await t.test('High-concurrency stress test: 200 interleaved asynchronous calls', async () => {
      const operations: Promise<any>[] = [];

      for (let i = 0; i < 200; i++) {
        const targetBridge = bridges[i % bridges.length];
        const opType = i % 4;

        if (opType === 0) {
          operations.push(targetBridge.callNative('STORAGE_SET', { key: `item_${i}`, value: `val_${i}` }));
        } else if (opType === 1) {
          operations.push(targetBridge.callNative('GET_DEVICE_INFO'));
        } else if (opType === 2) {
          operations.push(targetBridge.callNative('FS_WRITE_FILE', { filePath: `/file_${i}.txt`, data: `test_${i}` }));
        } else {
          operations.push(targetBridge.callNative('CAN_I_USE', { action: 'FS_WRITE_FILE' }));
        }
      }

      const results = await Promise.all(operations);
      assert.equal(results.length, 200);
      assert.ok(results.every((r) => r !== undefined));
    });

    await t.test('Snapshot and Restore exactness across supported fields', async () => {
      mockState.brightness = 0.42;
      mockState.statusBarDark = true;
      mockState.clipboard = 'adversarial_snapshot_test';

      const snapshot = mockState.snapshot();

      // Mutate state further
      mockState.brightness = 0.99;
      mockState.statusBarDark = false;
      mockState.clipboard = 'mutated';
      mockState.reset();

      assert.equal(mockState.brightness, 0.85); // Default reset

      // Restore snapshot
      mockState.restore(snapshot);

      assert.equal(mockState.brightness, 0.42);
      assert.equal(mockState.statusBarDark, true);
      assert.equal(mockState.clipboard, 'adversarial_snapshot_test');
    });

    await t.test('Snapshot Full Coverage Verification: badgeCount, audio, httpAuthCreds', async () => {
      mockState.badgeCount = 17;
      mockState.audio = { status: 'playing', currentTime: 45, duration: 180 };
      mockState.httpAuthCreds.set('auth.example.com', { username: 'testuser', password: 'testpassword' });

      const snapshot = mockState.snapshot();
      assert.equal(snapshot.badgeCount, 17);
      assert.equal(snapshot.audio.status, 'playing');
      assert.equal(snapshot.httpAuthCreds['auth.example.com']?.username, 'testuser');

      mockState.reset();
      assert.equal(mockState.badgeCount, 0);

      mockState.restore(snapshot);
      assert.equal(mockState.badgeCount, 17);
      assert.equal(mockState.audio.status, 'playing');
      assert.equal(mockState.httpAuthCreds.get('auth.example.com')?.username, 'testuser');
    });
  });

  // =========================================================================
  // 6. Biometric Lockout and Fallback Flows
  // =========================================================================
  await suite.test('6. Biometric Authentication, Lockout & Fallbacks', async (t) => {
    const bridge = new GoatBridgeMock({ appId: 'bio_test_app' });

    await t.test('6.1 Hardware unsupported returns BIOMETRIC_UNAVAILABLE', async () => {
      mockState.biometrics.supported = false;
      const res = await bridge.callNative('BIOMETRIC_AUTH', { title: 'Auth' });
      assert.equal(res.authenticated, false);
      assert.equal(res.error, 'BIOMETRIC_UNAVAILABLE');

      mockState.biometrics.supported = true;
    });

    await t.test('6.2 Locked out status returns BIOMETRIC_LOCKOUT', async () => {
      mockState.biometrics.isLockedOut = true;
      const res = await bridge.callNative('BIOMETRIC_AUTH', { title: 'Auth' });
      assert.equal(res.authenticated, false);
      assert.equal(res.error, 'BIOMETRIC_LOCKOUT');

      mockState.biometrics.isLockedOut = false;
    });

    await t.test('6.3 Custom errorOnAuth overrides outcome', async () => {
      mockState.biometrics.errorOnAuth = 'BIOMETRIC_SENSOR_DIRTY';
      const res = await bridge.callNative('BIOMETRIC_AUTH', { title: 'Auth' });
      assert.equal(res.authenticated, false);
      assert.equal(res.error, 'BIOMETRIC_SENSOR_DIRTY');

      mockState.biometrics.errorOnAuth = undefined;
    });

    await t.test('6.4 Permission revoked throws PERMISSION_DENIED', async () => {
      mockState.permissions.set('BIOMETRIC', false);
      await assert.rejects(
        () => bridge.callNative('BIOMETRIC_AUTH', {}),
        (err: any) => err.code === BridgeErrorCodes.PERMISSION_DENIED
      );
      mockState.permissions.set('BIOMETRIC', true);
    });

    await t.test('6.5 User gesture freshness gate enforcement', async () => {
      mockState.enforceGestureFreshness = true;
      mockState.lastUserGestureTimestamp = Date.now() - 15000; // 15s ago (stale)

      await assert.rejects(
        () => bridge.callNative('BIOMETRIC_AUTH', {}),
        (err: any) => err.code === BridgeErrorCodes.GESTURE_REQUIRED
      );

      // Record fresh gesture
      mockState.recordUserGesture();
      const res = await bridge.callNative('BIOMETRIC_AUTH', {});
      assert.equal(res.authenticated, true);
      assert.ok(res.token?.startsWith('sim_bio_tok_'));

      mockState.enforceGestureFreshness = false;
    });

    await t.test('6.6 Headless automatic authentication success & token generation', async () => {
      mockState.biometrics.autoAuthSuccess = true;
      const res = await bridge.callNative('BIOMETRIC_AUTH', {});
      assert.equal(res.authenticated, true);
      assert.ok(res.token);

      mockState.biometrics.autoAuthSuccess = false;
      const cancelRes = await bridge.callNative('BIOMETRIC_AUTH', {});
      assert.equal(cancelRes.authenticated, false);
      assert.equal(cancelRes.reason, 'User cancelled');

      mockState.biometrics.autoAuthSuccess = true;
    });
  });
});
