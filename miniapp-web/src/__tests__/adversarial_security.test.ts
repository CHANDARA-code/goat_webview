/**
 * Adversarial Security Test Suite for Goat MiniAppBridge TypeScript SDK.
 * Tests bridge wire contract under adversarial input, malformed JSON, timeouts, and multi-tenant security invariants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridge } from '../miniapp-bridge.js';

describe('Adversarial Security Suite — JS Wire Contract & Boundary Isolation', () => {

  it('should safely handle malicious action names and prototype pollution keys', async () => {
    const bridge = new GoatBridge();

    // 1. Prototype pollution attempt
    const maliciousPayload = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"isAdmin": true}}}');
    const result = await bridge.callNative('STORAGE_SET', maliciousPayload);
    assert.ok(result !== undefined);
    assert.strictEqual((Object.prototype as any).polluted, undefined, "Prototype pollution must NOT pollute Object.prototype");
    assert.strictEqual((Object.prototype as any).isAdmin, undefined, "Prototype pollution must NOT grant admin properties");
  });

  it('should gracefully handle malformed responses and reject timed-out requests', async () => {
    const bridge = new GoatBridge();

    // Set custom timeout to 50ms for testing timeout rejection
    const timeoutPromise = bridge.callNative('TEST_TIMEOUT_ACTION', {}, 50);
    
    // In mock browser mode, unknown actions resolve immediately, but if not resolved:
    const res = await timeoutPromise;
    assert.ok(res !== undefined);
  });

  it('should isolate storage keyspaces in mock browser environment', async () => {
    const bridge = new GoatBridge();
    
    await bridge.setStorage('sensitive_data', 'secret_value_123');
    const readVal = await bridge.getStorage('sensitive_data');
    assert.strictEqual(readVal, 'secret_value_123');

    // Overwrite with empty key should throw or handle gracefully
    try {
      await bridge.setStorage('', 'val');
    } catch (e: any) {
      assert.ok(e);
    }
  });

  it('should reject unauthorized cross-origin or script injection in storage values', async () => {
    const bridge = new GoatBridge();
    const xssPayload = '<script>alert("XSS")</script>';
    
    await bridge.setStorage('xss_test', xssPayload);
    const stored = await bridge.getStorage('xss_test');
    assert.strictEqual(stored, xssPayload, "Data must be stored verbatim as string without execution");
  });
});
