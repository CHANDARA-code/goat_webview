import { describe, it } from 'node:test';
import assert from 'node:assert';
import { bridge, goatBridge, MiniAppBridge, GoatBridge } from '../miniapp-bridge.js';

describe('Global Window Bindings & Singleton Invariants', () => {
  it('should export singleton instances and aliases', () => {
    assert.ok(bridge instanceof GoatBridge);
    assert.strictEqual(bridge, goatBridge);
    assert.strictEqual(MiniAppBridge, GoatBridge);
  });

  it('should bind window.GoatBridge and window.goatBridge when window is present', () => {
    const mockWindow: any = {};
    (global as any).window = mockWindow;

    const newBridge = new GoatBridge();
    assert.strictEqual(mockWindow.GoatBridge, newBridge);
    assert.strictEqual(mockWindow.goatBridge, newBridge);

    delete (global as any).window;
  });
});
