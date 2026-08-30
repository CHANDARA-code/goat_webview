import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GoatBridgeError, GoatBridge } from '../miniapp-bridge.js';

describe('GoatBridgeError & Structured Error Architecture', () => {
  it('should instantiate GoatBridgeError with code, message, and details', () => {
    const details = { action: 'TEST_ACTION', payload: { foo: 'bar' } };
    const err = new GoatBridgeError('INVALID_PAYLOAD', 'Payload missing key', details);

    assert.strictEqual(err.name, 'GoatBridgeError');
    assert.strictEqual(err.code, 'INVALID_PAYLOAD');
    assert.strictEqual(err.message, 'Payload missing key');
    assert.deepStrictEqual(err.details, details);
    assert.strictEqual(err instanceof Error, true);
    assert.strictEqual(err instanceof GoatBridgeError, true);
  });

  it('should correctly serialize GoatBridgeError to JSON', () => {
    const details = { action: 'API_REQUEST', code: 'ECONNREFUSED' };
    const err = new GoatBridgeError('NATIVE_EXECUTION_ERROR', 'Network connection refused', details);

    const json = err.toJSON();
    assert.strictEqual(json.name, 'GoatBridgeError');
    assert.strictEqual(json.code, 'NATIVE_EXECUTION_ERROR');
    assert.strictEqual(json.message, 'Network connection refused');
    assert.deepStrictEqual(json.details, details);
    assert.ok(typeof json.stack === 'string');
  });

  it('should reject with GoatBridgeError when callNative times out', async () => {
    const bridge = new GoatBridge();
    // Simulate a bridge call that does not respond in native mode
    const fakeWindow = {
      nativeBridge: {
        postMessage: () => {
          // Intentionally do nothing to trigger timeout
        }
      }
    };
    (global as any).window = fakeWindow;

    try {
      await bridge.callNative('SLOW_ACTION', { dummy: 1 }, 50);
      assert.fail('Should have timed out');
    } catch (err: any) {
      assert.strictEqual(err instanceof GoatBridgeError, true);
      assert.strictEqual(err.code, 'TIMEOUT');
      assert.ok(err.message.includes('SLOW_ACTION'));
      assert.strictEqual(err.details?.action, 'SLOW_ACTION');
    } finally {
      delete (global as any).window;
    }
  });
});
