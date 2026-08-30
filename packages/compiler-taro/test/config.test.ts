/**
 * @goat/compiler-taro - Configuration Transformation & Validation Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  transformTaroConfig,
  validateManifest,
  validateGoatConfig,
  parseRouteTable,
  extractPermissions,
  normalizeHexColor,
  deriveAppId,
  deriveVersionCode,
} from '../src/config/index.js';
import { TaroAppConfig, GoatTaroPluginOptions } from '../src/types.js';

describe('Config Transformers & Schema Validation', () => {
  describe('Helper functions', () => {
    it('normalizeHexColor: standardizes 3-digit and 6-digit hex colors', () => {
      assert.strictEqual(normalizeHexColor('#fff'), '#FFFFFF');
      assert.strictEqual(normalizeHexColor('#333'), '#333333');
      assert.strictEqual(normalizeHexColor('#abcdef'), '#ABCDEF');
      assert.strictEqual(normalizeHexColor('invalid', '#F8F8F8'), '#F8F8F8');
    });

    it('deriveAppId: creates compliant reverse-domain appIds', () => {
      assert.strictEqual(deriveAppId('com.example.wallet'), 'com.example.wallet');
      assert.strictEqual(deriveAppId(undefined, '@myorg/taro-app'), 'myorg.taroapp');
      assert.strictEqual(deriveAppId(undefined, 'simple-app'), 'com.goat.simpleapp');
      assert.strictEqual(deriveAppId(undefined, undefined), 'com.goat.miniapp');
    });

    it('deriveVersionCode: computes integer versionCode from semver', () => {
      assert.strictEqual(deriveVersionCode(105, '1.2.3'), 105);
      assert.strictEqual(deriveVersionCode(undefined, '1.2.3'), 10203);
      assert.strictEqual(deriveVersionCode(undefined, '2.0.0'), 20000);
      assert.strictEqual(deriveVersionCode(undefined, 'invalid'), 1);
    });
  });

  describe('Route Table Parser', () => {
    it('parses main package pages and subpackages into virtual route tables', () => {
      const appConfig: TaroAppConfig = {
        pages: ['pages/index/index', 'pages/detail/index'],
        entryPagePath: 'pages/index/index',
        tabBar: {
          list: [
            { pagePath: 'pages/index/index', text: 'Home' },
            { pagePath: 'pages/detail/index', text: 'Detail' },
          ],
        },
        subPackages: [
          {
            root: 'packageA',
            name: 'pkgA',
            pages: ['pages/cart/index', 'pages/pay/index'],
          },
          {
            root: 'packageB/',
            pages: ['pages/profile/index'],
          },
        ],
      };

      const routeTable = parseRouteTable(appConfig);
      assert.strictEqual(routeTable.entryPage, 'pages/index/index');
      assert.strictEqual(routeTable.routes.length, 5);
      assert.strictEqual(routeTable.tabBarRoutes.length, 2);

      const subA = routeTable.subpackageMap.get('packageA');
      assert.ok(subA);
      assert.strictEqual(subA.length, 2);
      assert.strictEqual(subA[0].fullPath, 'packageA/pages/cart/index');
      assert.strictEqual(subA[0].isSubpackage, true);

      const subB = routeTable.subpackageMap.get('packageB');
      assert.ok(subB);
      assert.strictEqual(subB.length, 1);
      assert.strictEqual(subB[0].fullPath, 'packageB/pages/profile/index');
    });
  });

  describe('Permission Extraction', () => {
    it('extracts capabilities from permission scopes and options', () => {
      const appConfig: TaroAppConfig = {
        pages: ['pages/index/index'],
        permission: {
          'scope.userLocation': { desc: 'Location' },
          'scope.camera': { desc: 'Camera' },
          'scope.record': { desc: 'Microphone' },
          'scope.bluetooth': { desc: 'BLE' },
          'scope.writePhotosAlbum': { desc: 'Photos' },
        },
        permissions: ['PAYMENT', 'CLIPBOARD'],
      };

      const pluginOpts: GoatTaroPluginOptions = {
        permissions: ['HAPTICS', 'BIOMETRIC'],
      };

      const permissions = extractPermissions(appConfig, pluginOpts);
      assert.ok(permissions.includes('LOCATION'));
      assert.ok(permissions.includes('CAMERA'));
      assert.ok(permissions.includes('RECORD_AUDIO'));
      assert.ok(permissions.includes('BLUETOOTH'));
      assert.ok(permissions.includes('STORAGE'));
      assert.ok(permissions.includes('PAYMENT'));
      assert.ok(permissions.includes('CLIPBOARD'));
      assert.ok(permissions.includes('HAPTICS'));
      assert.ok(permissions.includes('BIOMETRIC'));
    });
  });

  describe('transformTaroConfig', () => {
    it('transforms Taro app.config.ts into valid Goat manifest and config', () => {
      const appConfig: TaroAppConfig = {
        pages: ['pages/index/index', 'pages/detail/index'],
        window: {
          navigationBarTitleText: 'Goat Taro App',
          navigationBarBackgroundColor: '#123456',
          navigationBarTextStyle: 'white',
          backgroundColor: '#EEEEEE',
          pageOrientation: 'portrait',
          navigationStyle: 'custom',
          enablePullDownRefresh: true,
        },
        subPackages: [
          {
            root: 'sub',
            pages: ['pages/page1/index'],
          },
        ],
        preloadRule: {
          'pages/index/index': {
            network: 'wifi',
            packages: ['sub'],
          },
        },
      };

      const pluginOpts: GoatTaroPluginOptions = {
        appId: 'com.example.taroapp',
        version: '1.2.0',
        versionCode: 10200,
        target: 'dual-thread',
        allowedDomains: ['api.example.com'],
      };

      const { manifest, goatConfig, routeTable } = transformTaroConfig(
        appConfig,
        pluginOpts,
        { name: 'taro-goat-demo', version: '1.2.0' }
      );

      // Verify manifest
      assert.strictEqual(manifest.appId, 'com.example.taroapp');
      assert.strictEqual(manifest.appName, 'Goat Taro App');
      assert.strictEqual(manifest.version, '1.2.0');
      assert.strictEqual(manifest.versionCode, 10200);
      assert.strictEqual(manifest.entryPage, 'pages/index/index');
      assert.strictEqual(manifest.window?.navigationBarBackgroundColor, '#123456');
      assert.strictEqual(manifest.window?.backgroundColor, '#EEEEEE');
      assert.strictEqual(manifest.window?.navigationBarTextStyle, 'white');
      assert.strictEqual(manifest.window?.transparentBackground, true);
      assert.strictEqual(manifest.window?.enablePullDownRefresh, true);
      assert.strictEqual(manifest.subpackages?.length, 1);
      assert.deepStrictEqual(manifest.preloadRule?.['pages/index/index']?.packages, ['sub']);
      assert.deepStrictEqual(manifest.security?.allowedDomains, ['api.example.com']);

      // Verify goatConfig
      assert.strictEqual(goatConfig.appId, 'com.example.taroapp');
      assert.strictEqual(goatConfig.name, 'Goat Taro App');
      assert.strictEqual(goatConfig.target, 'dual-thread');
      assert.strictEqual(goatConfig.compiler, 'taro');

      // Verify routeTable
      assert.strictEqual(routeTable.routes.length, 3);
    });

    it('rejects invalid manifest properties', () => {
      const invalidAppId = validateManifest({
        appId: 'Invalid App ID with Spaces',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
      });
      assert.strictEqual(invalidAppId.isValid, false);
      assert.ok(invalidAppId.errors.some((e) => e.includes('Invalid appId format')));

      const invalidVersion = validateManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: 'not-semver',
        versionCode: 1,
        entryPage: 'pages/index/index',
      });
      assert.strictEqual(invalidVersion.isValid, false);
      assert.ok(invalidVersion.errors.some((e) => e.includes('Invalid version format')));

      const invalidHex = validateManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
        window: {
          backgroundColor: 'red',
        },
      });
      assert.strictEqual(invalidHex.isValid, false);
      assert.ok(invalidHex.errors.some((e) => e.includes('Invalid window.backgroundColor')));

      const emptyHex = validateManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
        window: {
          backgroundColor: '',
          navigationBarBackgroundColor: '',
        },
      });
      assert.strictEqual(emptyHex.isValid, false);
      assert.ok(emptyHex.errors.some((e) => e.includes('Invalid window.backgroundColor')));
      assert.ok(emptyHex.errors.some((e) => e.includes('Invalid window.navigationBarBackgroundColor')));

      const duplicateSub = validateManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
        subpackages: [
          { root: 'pkg', pages: ['p1'] },
          { root: 'pkg', pages: ['p2'] },
        ],
      });
      assert.strictEqual(duplicateSub.isValid, false);
      assert.ok(duplicateSub.errors.some((e) => e.includes('Duplicate subpackage root')));
    });

    it('validates goat.config.json fields', () => {
      const valid = validateGoatConfig({
        name: 'My MiniApp',
        version: '1.0.0',
        appId: 'com.example.miniapp',
        entryPage: 'pages/index/index',
        target: 'dual-thread',
        compiler: 'taro',
      });
      assert.strictEqual(valid.isValid, true);

      const invalidTarget = validateGoatConfig({
        name: 'My MiniApp',
        version: '1.0.0',
        appId: 'com.example.miniapp',
        entryPage: 'pages/index/index',
        target: 'multi-process',
        compiler: 'taro',
      });
      assert.strictEqual(invalidTarget.isValid, false);
    });
  });
});
