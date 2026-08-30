import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 7: Location & Geofencing', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('GET_LOCATION returns coordinates', async () => {
    const loc = await bridge.callNative('GET_LOCATION');
    assert.equal(loc.latitude, 37.774929);
    assert.equal(loc.longitude, -122.419416);
    assert.equal(loc.accuracy, 5.0);
  });

  await t.test('CHOOSE_LOCATION and OPEN_LOCATION', async () => {
    const chosen = await bridge.callNative('CHOOSE_LOCATION');
    assert.equal(chosen.name, 'Goat Mini-App HQ');
    assert.equal(chosen.latitude, 37.774929);

    const opened = await bridge.callNative('OPEN_LOCATION', { latitude: 37.774929, longitude: -122.419416 });
    assert.equal(opened.opened, true);
  });

  await t.test('Geofencing: START_GEOFENCE, LIST_GEOFENCES, EVALUATE_GEOFENCE, STOP_GEOFENCE', async () => {
    // 1. Create Geofence around Apple Park (37.3346, -122.0090) with 200m radius
    const startRes = await bridge.callNative('START_GEOFENCE', {
      geofenceId: 'fence_apple_park',
      latitude: 37.3346,
      longitude: -122.0090,
      radiusMeters: 200,
      transitionType: 'BOTH',
    });
    assert.equal(startRes.started, true);
    assert.equal(startRes.geofenceId, 'fence_apple_park');

    // 2. List Geofences
    const listRes = await bridge.callNative('LIST_GEOFENCES');
    assert.equal(listRes.geofences.some((g: any) => g.geofenceId === 'fence_apple_park'), true);

    // 3. Evaluate location inside the 200m circle
    const evalInside = await bridge.callNative('EVALUATE_GEOFENCE', {
      latitude: 37.33461,
      longitude: -122.00901,
    });
    assert.equal(evalInside.events.some((e: any) => e.geofenceId === 'fence_apple_park' && e.transition === 'ENTER'), true);

    // 4. Evaluate location far outside the circle (San Francisco: 37.7749, -122.4194)
    const evalOutside = await bridge.callNative('EVALUATE_GEOFENCE', {
      latitude: 37.7749,
      longitude: -122.4194,
    });
    assert.equal(evalOutside.events.some((e: any) => e.geofenceId === 'fence_apple_park' && e.transition === 'EXIT'), true);

    // 5. Stop Geofence
    const stopRes = await bridge.callNative('STOP_GEOFENCE', { geofenceId: 'fence_apple_park' });
    assert.equal(stopRes.stopped, true);
  });

  await t.test('GET_LOCATION rejects if permission is denied', async () => {
    mockState.permissions.set('LOCATION', false);
    await assert.rejects(
      () => bridge.callNative('GET_LOCATION'),
      (err: any) => err.code === BridgeErrorCodes.PERMISSION_DENIED
    );
    mockState.permissions.set('LOCATION', true); // Restore
  });
});
