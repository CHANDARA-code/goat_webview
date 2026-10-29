/**
 * Unit Test Suite for Workspace Pure Helpers:
 * 1. Share-URL encode/decode round-trip
 * 2. Workspace layout persistence
 * 3. Bridge action coverage & error integrity
 * 4. Zero-dependency zip export
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  encodeProjectState,
  decodeProjectState,
  type ProjectShareState,
} from '../src/utils/projectState.ts';

import {
  loadWorkspaceLayout,
  saveWorkspaceLayout,
  DEFAULT_WORKSPACE_LAYOUT,
  WORKSPACE_STORAGE_KEY,
} from '../src/utils/workspaceStorage.ts';

import { buildZipFile } from '../src/utils/zipExport.ts';

import {
  SUPPORTED_ACTIONS,
  dispatchBridgeAction,
  GoatBridgeError,
} from '../../packages/bridge-mock/dist/src/index.js';

describe('Workspace Pure Helpers & Simulator Verification', () => {
  // ---------------------------------------------------------------------------
  // 1. Share URL Round-Trip Encode / Decode
  // ---------------------------------------------------------------------------
  describe('Share URL State Round-Trip', () => {
    it('encodes and decodes standard project state accurately', () => {
      const sampleState: ProjectShareState = {
        name: 'Superapp E-Commerce Checkout',
        code: '<!DOCTYPE html><html><body><h1>Checkout</h1></body></html>',
        template: 'biometric-checkout',
        platform: 'ios',
        device: 'iPhone 18 Pro',
        deviceColor: 'black',
        hardware: {
          batteryLevel: 75,
          networkType: 'wifi',
          theme: 'dark',
          mockResult: 'success',
        },
        chaos: {
          enabled: true,
          rate: 15,
        },
      };

      const hash = encodeProjectState(sampleState);
      assert.ok(hash.length > 0, 'Hash string should not be empty');

      // Decode with leading #
      const decoded1 = decodeProjectState(`#${hash}`);
      assert.deepEqual(decoded1, sampleState);

      // Decode with #project= prefix
      const decoded2 = decodeProjectState(`#project=${hash}`);
      assert.deepEqual(decoded2, sampleState);

      // Decode bare hash
      const decoded3 = decodeProjectState(hash);
      assert.deepEqual(decoded3, sampleState);
    });

    it('handles unicode, emojis, and multiline code in project state', () => {
      const unicodeState: ProjectShareState = {
        name: '🚀 迷你应用 Mini-App テスト',
        code: `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <h3>Привет мир! 🌟</h3>
    <p>Price: 100€ / 1,500円 / 500,000៛</p>
  </body>
</html>`,
        template: 'hello-bridge',
        platform: 'android',
        device: 'Pixel 10',
      };

      const hash = encodeProjectState(unicodeState);
      const decoded = decodeProjectState(hash);
      assert.deepEqual(decoded, unicodeState);
    });

    it('safely handles malformed, empty, or corrupt hash strings without throwing', () => {
      assert.equal(decodeProjectState(''), null);
      assert.equal(decodeProjectState('#'), null);
      assert.equal(decodeProjectState('#project='), null);
      assert.equal(decodeProjectState('!!!not_a_valid_base64!!!'), null);
      assert.equal(decodeProjectState('eyJpbnZhbGlkIjoiZGF0YSJ9'), null); // JSON without code field
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Workspace Layout Persistence
  // ---------------------------------------------------------------------------
  describe('Workspace Layout Persistence', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      (globalThis as any).window = {
        localStorage: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, val: string) => {
            mockStorage[key] = String(val);
          },
          removeItem: (key: string) => {
            delete mockStorage[key];
          },
        },
      };
    });

    it('returns DEFAULT_WORKSPACE_LAYOUT when localStorage is empty', () => {
      const layout = loadWorkspaceLayout();
      assert.deepEqual(layout, DEFAULT_WORKSPACE_LAYOUT);
    });

    it('persists and restores updated layout state', () => {
      saveWorkspaceLayout({
        railCollapsed: true,
        dockHeight: 320,
        platform: 'android',
        device: 'Pixel 10',
        zoom: 1.0,
        fontSize: 15,
      });

      const loaded = loadWorkspaceLayout();
      assert.equal(loaded.railCollapsed, true);
      assert.equal(loaded.dockHeight, 320);
      assert.equal(loaded.platform, 'android');
      assert.equal(loaded.device, 'Pixel 10');
      assert.equal(loaded.zoom, 1.0);
      assert.equal(loaded.fontSize, 15);
      // Unmodified fields keep defaults
      assert.equal(loaded.dockCollapsed, DEFAULT_WORKSPACE_LAYOUT.dockCollapsed);
      assert.equal(loaded.activeRailTab, DEFAULT_WORKSPACE_LAYOUT.activeRailTab);
    });

    it('recovers gracefully if localStorage contains corrupted JSON', () => {
      mockStorage[WORKSPACE_STORAGE_KEY] = '{ corrupted_invalid_json ';
      const loaded = loadWorkspaceLayout();
      assert.deepEqual(loaded, DEFAULT_WORKSPACE_LAYOUT);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Action Coverage & Error Integrity (Phase 1 Requirement)
  // ---------------------------------------------------------------------------
  describe('Bridge Action Coverage & Integrity', () => {
    it('verifies executable action count is at least 197 (actual >= 210)', () => {
      assert.ok(
        SUPPORTED_ACTIONS.size >= 197,
        `Expected at least 197 actions, found ${SUPPORTED_ACTIONS.size}`
      );
      assert.equal(SUPPORTED_ACTIONS.size, 210);
    });

    it('verifies presence of actions across all core domains', () => {
      const sampleActions = [
        'GET_DEVICE_INFO',
        'STORAGE_SET',
        'FS_WRITE_FILE',
        'API_REQUEST',
        'SET_NAV_BAR_TITLE',
        'HAPTIC_FEEDBACK',
        'GET_LOCATION',
        'BIOMETRIC_AUTH',
        'CHOOSE_MEDIA',
        'CHOOSE_CONTACT',
        'PUSH_GET_TOKEN',
        'BLE_START_SCAN',
        'WEB3_SIGN_TRANSACTION',
        'PASSKEY_REGISTER',
        'CREATE_BINARY_PORT',
        'GET_PAGE_STACK',
        'LOAD_SUBPACKAGE',
        'SEND_APM_METRIC',
      ];

      for (const act of sampleActions) {
        assert.ok(
          SUPPORTED_ACTIONS.has(act),
          `Expected action ${act} to be in SUPPORTED_ACTIONS`
        );
      }
    });

    it('throws UNSUPPORTED_ACTION and NEVER fakes success for unknown actions', async () => {
      const unknownAction = 'TOTALLY_FAKE_NONEXISTENT_ACTION';
      await assert.rejects(
        async () => {
          await dispatchBridgeAction(unknownAction, {}, 'test-app');
        },
        (err: any) => {
          assert.ok(err instanceof GoatBridgeError);
          assert.equal(err.code, 'UNSUPPORTED_ACTION');
          assert.match(err.message, /Unsupported native bridge action/);
          return true;
        }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Zero-Dependency ZIP Export
  // ---------------------------------------------------------------------------
  describe('Zero-Dependency ZIP File Builder', () => {
    it('generates a valid ZIP binary with standard headers', () => {
      const files = [
        { name: 'index.html', content: '<h1>Hello Goat</h1>' },
        { name: 'README.md', content: '# Goat MiniApp' },
      ];

      const zipBytes = buildZipFile(files);
      assert.ok(zipBytes.length > 50, 'ZIP binary should have content');

      // Verify ZIP local file header signature: 0x50, 0x4B, 0x03, 0x04 ('PK\x03\x04')
      assert.equal(zipBytes[0], 0x50);
      assert.equal(zipBytes[1], 0x4b);
      assert.equal(zipBytes[2], 0x03);
      assert.equal(zipBytes[3], 0x04);
    });
  });
});
