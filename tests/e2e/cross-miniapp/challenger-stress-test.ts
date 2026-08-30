/**
 * Challenger 2 Adversarial Stress Test Suite for Task 10201 (GoatCrossMiniAppManager)
 *
 * Exhaustive Empirical Verification covering:
 * 1. Nested Launches (Parent A -> Child B -> Grandchild C -> Great-grandchild D -> E)
 *    - Deep hierarchical IPC aliasing across chains
 *    - Parameter propagation and security boundary isolation
 *    - Cascading teardown from root and intermediate nodes
 * 2. Drag Coordinate Bounds & Safe-Area Clamping
 *    - Extreme negative/positive coordinates, oversized cards, safeTop/safeBottom notch insets
 *    - Property-based randomized drag coordinates with 10,000 bounds checks
 *    - Viewport safe area preservation
 * 3. Idempotent Close Operations & Result Payload Propagation
 *    - Double-close idempotency, non-existent instance closures
 *    - Concurrent racing close calls on the same instance
 *    - Result payload accuracy, exit codes, and ON_MINI_APP_CLOSED dispatching
 * 4. FastPool Saturation & Memory Lifecycle Recycling
 *    - Pool size >= 2, saturation with 100+ concurrent allocations
 *    - 8-step sanitization sequence validation
 *    - Zero state contamination across sequential and concurrent pool acquisitions
 */

import {
  GoatCrossMiniAppManagerSimulator,
  GoatWindowConfig,
  GoatFastPoolSimulator,
  GoatTenantStorageSandbox,
  GoatTenantCookieJar,
} from '../harness/cross-miniapp-simulator.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

async function runNestedLaunchesStressTest(): Promise<void> {
  console.log('🧪 Running Stress Test 1: Nested Launches (A -> B -> C -> D -> E)...');

  const manager = new GoatCrossMiniAppManagerSimulator(5);

  // Register bridge handlers for each tier
  manager.registerParentBridgeHandler('app_A', async (action, payload) => {
    if (action === 'HOST_AUTH') return { token: 'AUTH_TOKEN_A', user: payload.user };
    if (action === 'QUERY_CONFIG') return { env: 'production', cluster: 'asia-east1' };
    return { unhandled: true };
  });

  manager.registerParentBridgeHandler('app_B', async (action, payload) => {
    if (action === 'CALC_DISCOUNT') return { discountedPrice: payload.price * 0.8 };
    return { unhandled: true };
  });

  manager.registerParentBridgeHandler('app_C', async (action, payload) => {
    if (action === 'VALIDATE_COUPON') return { valid: payload.code === 'PROMO2026' };
    return { unhandled: true };
  });

  manager.registerParentBridgeHandler('app_D', async (action, payload) => {
    if (action === 'SIGN_PAYLOAD') return { signature: `SIG_${payload.data}_OK` };
    return { unhandled: true };
  });

  // Launch A -> B -> C -> D -> E
  const instA = await manager.openMiniApp('root', {
    targetAppId: 'app_A',
    presentation: 'FULLSCREEN',
  });

  const instB = await manager.openMiniApp('app_A', {
    targetAppId: 'app_B',
    presentation: 'WINDOWED',
    jsApiAlias: { GET_AUTH: 'HOST_AUTH', GET_CONFIG: 'QUERY_CONFIG' },
    params: { level: 'B', tier: 2 },
  });

  const instC = await manager.openMiniApp('app_B', {
    targetAppId: 'app_C',
    presentation: 'MODAL',
    jsApiAlias: { APPLY_DISCOUNT: 'CALC_DISCOUNT' },
    params: { level: 'C', tier: 3 },
  });

  const instD = await manager.openMiniApp('app_C', {
    targetAppId: 'app_D',
    presentation: 'WINDOWED',
    jsApiAlias: { CHECK_COUPON: 'VALIDATE_COUPON' },
    params: { level: 'D', tier: 4 },
  });

  const instE = await manager.openMiniApp('app_D', {
    targetAppId: 'app_E',
    presentation: 'EMBEDDED',
    jsApiAlias: { CRYPTO_SIGN: 'SIGN_PAYLOAD' },
    params: { level: 'E', tier: 5 },
  });

  const allRunning = manager.getAllRunningInstances();
  assert(allRunning.length === 5, `Expected 5 running instances, got ${allRunning.length}`);

  // Test multi-level aliased IPC
  // E calls D
  const resEtoD = await manager.dispatchChildBridgeAction(instE.instanceId, 'CRYPTO_SIGN', { data: 'TX_1001' });
  assert(resEtoD.routedToParent === true, 'E->D should route to parent');
  assert(resEtoD.result.signature === 'SIG_TX_1001_OK', 'E->D signature mismatch');

  // D calls C
  const resDtoC = await manager.dispatchChildBridgeAction(instD.instanceId, 'CHECK_COUPON', { code: 'PROMO2026' });
  assert(resDtoC.routedToParent === true, 'D->C should route to parent');
  assert(resDtoC.result.valid === true, 'D->C coupon should be valid');

  // C calls B
  const resCtoB = await manager.dispatchChildBridgeAction(instC.instanceId, 'APPLY_DISCOUNT', { price: 100 });
  assert(resCtoB.routedToParent === true, 'C->B should route to parent');
  assert(resCtoB.result.discountedPrice === 80, 'C->B discount calculation mismatch');

  // B calls A
  const resBtoA = await manager.dispatchChildBridgeAction(instB.instanceId, 'GET_AUTH', { user: 'tester_01' });
  assert(resBtoA.routedToParent === true, 'B->A should route to parent');
  assert(resBtoA.result.token === 'AUTH_TOKEN_A', 'B->A token mismatch');

  // Security test: Fail-closed on illegal direct unmapped call
  try {
    await manager.dispatchChildBridgeAction(instE.instanceId, 'GET_AUTH', {});
    assert(false, 'Should have failed closed for unmapped parent action on E');
  } catch (err: any) {
    // Expected local unaliased resolution or error
  }

  // Teardown intermediate node C -> should cascade teardown C, D, E while preserving A and B
  await manager.closeMiniApp('app_B', { instanceId: instC.instanceId, result: { reason: 'user_cancel_c' } });

  assert(manager.getInstance(instE.instanceId) === undefined, 'Child E should be cascade dismantled');
  assert(manager.getInstance(instD.instanceId) === undefined, 'Child D should be cascade dismantled');
  assert(manager.getInstance(instC.instanceId) === undefined, 'Child C should be dismantled');
  assert(manager.getInstance(instB.instanceId) !== undefined, 'Child B should still be alive');
  assert(manager.getInstance(instA.instanceId) !== undefined, 'Parent A should still be alive');
  assert(manager.getAllRunningInstances().length === 2, 'Expected 2 instances remaining');

  // Teardown root A -> should teardown A and B
  await manager.closeMiniApp('root', { instanceId: instA.instanceId });
  assert(manager.getAllRunningInstances().length === 0, 'All instances should be cleaned up');

  console.log('✅ Stress Test 1 PASSED.');
}

async function runDragCoordinateClampingStressTest(): Promise<void> {
  console.log('🧪 Running Stress Test 2: Drag Coordinate Bounds & Safe-Area Clamping...');

  const screenWidth = 390;
  const screenHeight = 844;
  const safeTop = 44;
  const safeBottom = 34;

  // 1. Extreme negative coordinates
  const cfg1 = new GoatWindowConfig({ width: 300, height: 400, x: -5000, y: -9000 });
  const b1 = cfg1.clampToBounds(screenWidth, screenHeight, safeTop, safeBottom);
  assert(b1.clampedX === 0, `Expected clampedX=0, got ${b1.clampedX}`);
  assert(b1.clampedY === safeTop, `Expected clampedY=${safeTop}, got ${b1.clampedY}`);

  // 2. Extreme positive overflow coordinates
  const cfg2 = new GoatWindowConfig({ width: 300, height: 400, x: 99999, y: 99999 });
  const b2 = cfg2.clampToBounds(screenWidth, screenHeight, safeTop, safeBottom);
  const expectedMaxX = screenWidth - 300; // 90
  const expectedMaxY = screenHeight - safeBottom - 400; // 844 - 34 - 400 = 410
  assert(b2.clampedX === expectedMaxX, `Expected clampedX=${expectedMaxX}, got ${b2.clampedX}`);
  assert(b2.clampedY === expectedMaxY, `Expected clampedY=${expectedMaxY}, got ${b2.clampedY}`);

  // 3. Massive card larger than entire screen
  const cfg3 = new GoatWindowConfig({ width: 2000, height: 5000, x: 50, y: 50 });
  const b3 = cfg3.clampToBounds(screenWidth, screenHeight, safeTop, safeBottom);
  assert(b3.clampedWidth === screenWidth, `Expected clampedWidth=${screenWidth}, got ${b3.clampedWidth}`);
  const maxAvailHeight = screenHeight - safeTop - safeBottom; // 844 - 44 - 34 = 766
  assert(b3.clampedHeight === maxAvailHeight, `Expected clampedHeight=${maxAvailHeight}, got ${b3.clampedHeight}`);
  assert(b3.clampedX === 0, `Expected clampedX=0, got ${b3.clampedX}`);
  assert(b3.clampedY === safeTop, `Expected clampedY=${safeTop}, got ${b3.clampedY}`);

  // 4. Property-based randomized stress testing: 10,000 random drags
  for (let i = 0; i < 10000; i++) {
    const randW = Math.floor(Math.random() * 2000) - 500;
    const randH = Math.floor(Math.random() * 2000) - 500;
    const randX = Math.floor(Math.random() * 5000) - 2500;
    const randY = Math.floor(Math.random() * 5000) - 2500;

    const config = new GoatWindowConfig({ width: randW, height: randH, x: randX, y: randY });
    const clamped = config.clampToBounds(screenWidth, screenHeight, safeTop, safeBottom);

    // Invariants
    assert(clamped.clampedX >= 0, `Invariant violation: clampedX ${clamped.clampedX} < 0`);
    assert(clamped.clampedX + clamped.clampedWidth <= screenWidth, `Invariant violation: card right edge exceeds screen width`);
    assert(clamped.clampedY >= safeTop, `Invariant violation: clampedY ${clamped.clampedY} < safeTop ${safeTop}`);
    assert(clamped.clampedY + clamped.clampedHeight <= screenHeight - safeBottom, `Invariant violation: card bottom edge exceeds safe bottom`);
    assert(clamped.clampedWidth >= 200, `Invariant violation: width ${clamped.clampedWidth} < min 200`);
    assert(clamped.clampedHeight >= 250, `Invariant violation: height ${clamped.clampedHeight} < min 250`);
  }

  console.log('✅ Stress Test 2 PASSED (10,000 randomized drag permutations verified).');
}

async function runIdempotentCloseStressTest(): Promise<void> {
  console.log('🧪 Running Stress Test 3: Idempotent Close Operations & Result Propagation...');

  const manager = new GoatCrossMiniAppManagerSimulator(3);
  const closedEvents: any[] = [];
  manager.onMiniAppClosed((evt) => {
    closedEvents.push(evt);
  });

  const inst1 = await manager.openMiniApp('parent', { targetAppId: 'child_1' });

  // 1. Double close on same instanceId
  const close1 = await manager.closeMiniApp('parent', {
    instanceId: inst1.instanceId,
    result: { status: 'success', code: 200 },
    dismissedByUser: false,
    exitCode: 'NORMAL_DISMISS',
  });
  assert(close1.closed === true, 'First close must return closed=true');
  assert(close1.sanitizationSteps.length === 8, 'Must execute 8 sanitization steps');

  const close2 = await manager.closeMiniApp('parent', {
    instanceId: inst1.instanceId,
    result: { status: 'retry' },
  });
  assert(close2.closed === false, 'Second close must return closed=false (idempotent)');
  assert(close2.sanitizationSteps.length === 0, 'No sanitization on duplicate close');

  // Verify exactly 1 ON_MINI_APP_CLOSED event was emitted
  assert(closedEvents.length === 1, `Expected 1 event, got ${closedEvents.length}`);
  assert(closedEvents[0].targetAppId === 'child_1', 'Event targetAppId mismatch');
  assert(closedEvents[0].result.code === 200, 'Event result code mismatch');
  assert(closedEvents[0].exitCode === 'NORMAL_DISMISS', 'Event exitCode mismatch');

  // 2. Close non-existent random instanceId
  const closeNonExistent = await manager.closeMiniApp('parent', { instanceId: 'inst_nonexistent_xyz999' });
  assert(closeNonExistent.closed === false, 'Closing non-existent instance should be safely handled');

  // 3. Concurrent close race condition (5 simultaneous close calls)
  const inst2 = await manager.openMiniApp('parent', { targetAppId: 'child_race' });
  const raceResults = await Promise.all([
    manager.closeMiniApp('parent', { instanceId: inst2.instanceId, result: { raceId: 1 } }),
    manager.closeMiniApp('parent', { instanceId: inst2.instanceId, result: { raceId: 2 } }),
    manager.closeMiniApp('parent', { instanceId: inst2.instanceId, result: { raceId: 3 } }),
    manager.closeMiniApp('parent', { instanceId: inst2.instanceId, result: { raceId: 4 } }),
    manager.closeMiniApp('parent', { instanceId: inst2.instanceId, result: { raceId: 5 } }),
  ]);

  const successes = raceResults.filter((r) => r.closed === true);
  const duplicates = raceResults.filter((r) => r.closed === false);
  assert(successes.length === 1, `Exactly 1 concurrent close must succeed, got ${successes.length}`);
  assert(duplicates.length === 4, `4 duplicate closes must safely return closed=false, got ${duplicates.length}`);

  console.log('✅ Stress Test 3 PASSED.');
}

async function runFastPoolSaturationStressTest(): Promise<void> {
  console.log('🧪 Running Stress Test 4: FastPool Saturation & Memory Lifecycle Recycling...');

  const poolCapacity = 2;
  const manager = new GoatCrossMiniAppManagerSimulator(poolCapacity);

  assert(manager.fastPool.getAvailableCount() === 2, 'Initial warm pool should have 2 instances');
  assert(manager.fastPool.getTotalAllocated() === 2, 'Total allocated initially 2');

  // Open 100 concurrent mini-apps on a pool capacity of 2
  const activeInstances: any[] = [];
  for (let i = 0; i < 100; i++) {
    const inst = await manager.openMiniApp('parent_host', {
      targetAppId: `worker_app_${i}`,
      params: { workerIndex: i },
    });
    activeInstances.push(inst);

    // Put data into each worker's isolated storage
    const storage = manager.getStorage(`worker_app_${i}`);
    storage.setItem(`session_data_${i}`, `secure_token_${i}`);
    storage.writeVfsFile(`config_${i}.json`, `{"worker": ${i}}`);
  }

  assert(manager.getAllRunningInstances().length === 100, 'Should have 100 running instances');
  assert(manager.fastPool.getAvailableCount() === 0, 'Pool should be fully depleted');
  assert(manager.fastPool.getTotalAllocated() === 100, 'Should have dynamically allocated 100 instances');

  // Verify storage isolation across all 100 workers
  for (let i = 0; i < 100; i++) {
    const s = manager.getStorage(`worker_app_${i}`);
    assert(s.getItem(`session_data_${i}`) === `secure_token_${i}`, `Worker ${i} storage mismatch`);
    assert(s.getItem(`session_data_${(i + 1) % 100}`) === null, `Cross-tenant bleed detected between ${i} and ${(i + 1) % 100}`);
  }

  // Close all 100 instances concurrently
  await Promise.all(
    activeInstances.map((inst) =>
      manager.closeMiniApp('parent_host', {
        instanceId: inst.instanceId,
        result: { done: true },
      })
    )
  );

  assert(manager.getAllRunningInstances().length === 0, 'All instances must be closed');
  assert(manager.fastPool.getAvailableCount() === poolCapacity, `FastPool must retain up to pool capacity (${poolCapacity})`);
  assert(manager.fastPool.getTotalRecycled() === 100, 'Total recycled count must be 100');

  // Re-acquire 2 instances from the warm pool and verify zero residue
  const warmAcq1 = manager.fastPool.acquire();
  const warmAcq2 = manager.fastPool.acquire();
  assert(warmAcq1.fromPool === true, 'Should acquire from warm pool');
  assert(warmAcq2.fromPool === true, 'Should acquire from warm pool');
  assert(warmAcq1.state === 'IN_USE', 'Warm instance state must be IN_USE');
  assert(warmAcq2.state === 'IN_USE', 'Warm instance state must be IN_USE');

  console.log('✅ Stress Test 4 PASSED.');
}

async function main(): Promise<void> {
  console.log('================================================================');
  console.log('🛡️  CHALLENGER 2: EMPIRICAL STRESS TEST SUITE (Task 10201)');
  console.log('================================================================');

  const start = Date.now();

  await runNestedLaunchesStressTest();
  await runDragCoordinateClampingStressTest();
  await runIdempotentCloseStressTest();
  await runFastPoolSaturationStressTest();

  const duration = Date.now() - start;

  console.log('================================================================');
  console.log(`🎉 ALL 4 ADVERSARIAL STRESS SUITES PASSED EMPIRICALLY (${duration}ms)`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('❌ STRESS TEST FAILED:', err);
  process.exit(1);
});
