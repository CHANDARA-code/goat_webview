import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GoatBridge } from '../miniapp-bridge.js';

describe('Goat Mini-App Full-Stack E2E Integration Suite', () => {
  const e2eBridge = new GoatBridge();

  it('should execute end-to-end multi-process bridge negotiation', async () => {
    const sandbox = await e2eBridge.getSandboxProcessStatus();
    assert.strictEqual(sandbox.isAlive, true);
    assert.strictEqual(sandbox.isolatedProcessName, ':goat_miniapp_process');
  });

  it('should complete startup benchmark telemetry logging', async () => {
    const report = await e2eBridge.getStartupBenchmarkReport();
    assert.strictEqual(report.isColdBootWithinSla, true);
    assert.strictEqual(report.isWarmBootWithinSla, true);
    assert.strictEqual(report.isMemoryWithinSla, true);
  });

  it('should verify subpackage modular dynamic loader and route transitions', async () => {
    const subpkg = await e2eBridge.loadSubpackage('finance_wallet');
    assert.strictEqual(subpkg.isSuccess, true);
    assert.strictEqual(subpkg.subpackageName, 'finance_wallet');

    const cached = await e2eBridge.isSubpackageCached('finance_wallet');
    assert.strictEqual(cached.isCached, true);
  });

  it('should assert native gesture coordinator and parent scroll boundaries', async () => {
    const scrollState = await e2eBridge.updateGestureScroll(0, 500);
    assert.strictEqual(scrollState.isScrollBoundaryReached, true);
    assert.strictEqual(scrollState.canParentIntercept, true);
  });
});
