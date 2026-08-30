import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConfigValidationError,
  parsePagesJson,
  parseUniAppManifest,
  transformPagesJsonToGoatManifest,
  validateGoatManifest,
  validatePagesJson,
} from '../dist/config/index.js';
import type { PagesJson, UniAppManifestJson } from '../dist/types.js';

describe('Config Transformer & Validator', () => {
  const samplePagesJson: PagesJson = {
    pages: [
      {
        path: 'pages/index/index',
        style: {
          navigationBarTitleText: 'Home Page',
          navigationBarBackgroundColor: '#FFFFFF',
          navigationBarTextStyle: 'black',
          navigationStyle: 'custom',
          enablePullDownRefresh: true,
        },
      },
      {
        path: 'pages/user/profile',
        style: {
          navigationBarTitleText: 'User Profile',
          navigationBarBackgroundColor: '#007AFF',
          navigationBarTextStyle: 'white',
        },
      },
    ],
    globalStyle: {
      navigationBarTitleText: 'My UniApp',
      navigationBarBackgroundColor: '#FFFFFF',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F8F8F8',
      rpxCalcMaxDeviceWidth: 960,
      rpxCalcBaseDeviceWidth: 375,
    },
    tabBar: {
      color: '#7A7E83',
      selectedColor: '#007AFF',
      backgroundColor: '#FFFFFF',
      borderStyle: 'black',
      list: [
        {
          pagePath: 'pages/index/index',
          text: 'Home',
          iconPath: 'static/tab/home.png',
          selectedIconPath: 'static/tab/home-active.png',
        },
        {
          pagePath: 'pages/user/profile',
          text: 'Profile',
          iconPath: 'static/tab/user.png',
          selectedIconPath: 'static/tab/user-active.png',
        },
      ],
    },
    subPackages: [
      {
        root: 'subpackages/trade',
        name: 'trade',
        pages: [
          { path: 'checkout', style: { navigationBarTitleText: 'Checkout' } },
          { path: 'success', style: { navigationBarTitleText: 'Success' } },
        ],
      },
    ],
    preloadRule: {
      'pages/index/index': {
        packages: ['subpackages/trade'],
        network: 'all',
      },
    },
    easycom: {
      autoscan: true,
      custom: {
        '^uni-(.*)': '@/components/uni-$1/uni-$1.vue',
      },
    },
  };

  const sampleUniManifest: UniAppManifestJson = {
    name: 'Goat UniApp Test',
    appid: 'com.example.uniapp',
    versionName: '1.2.3',
    versionCode: 123,
    'mp-weixin': {
      appid: 'wx1234567890abcdef',
      permission: {
        'scope.userLocation': { desc: 'Location needed for map' },
        'scope.camera': { desc: 'Camera needed for scanner' },
      },
    },
  };

  it('validates schema of canonical pages.json successfully', () => {
    assert.doesNotThrow(() => validatePagesJson(samplePagesJson));
  });

  it('transforms pages.json and uni manifest into valid Goat manifest.json', () => {
    const result = transformPagesJsonToGoatManifest(samplePagesJson, sampleUniManifest, {
      threadModel: 'dual-thread',
    });

    assert.equal(result.manifest.appId, 'com.example.uniapp');
    assert.equal(result.manifest.appName, 'Goat UniApp Test');
    assert.equal(result.manifest.version, '1.2.3');
    assert.equal(result.manifest.versionCode, 123);
    assert.equal(result.manifest.entryPage, 'pages/index/index');
    assert.equal(result.manifest.window?.title, 'My UniApp');
    assert.equal(result.manifest.window?.navigationBarTextStyle, 'black');
    assert.equal(result.manifest.window?.backgroundColor, '#F8F8F8');

    // Permissions
    assert.ok(result.manifest.permissions?.includes('STORAGE'));
    assert.ok(result.manifest.permissions?.includes('CLIPBOARD'));
    assert.ok(result.manifest.permissions?.includes('HAPTICS'));
    assert.ok(result.manifest.permissions?.includes('LOCATION'));
    assert.ok(result.manifest.permissions?.includes('CAMERA'));

    // Subpackages
    assert.equal(result.manifest.subpackages?.length, 1);
    const sub = result.manifest.subpackages![0];
    assert.equal(sub.root, 'subpackages/trade');
    assert.deepEqual(sub.pages, ['checkout', 'success']);
    assert.equal(sub.preloadRule?.network, 'all');

    // Routes
    assert.equal(result.routes.length, 4);
    assert.equal(result.routes[0].fullPath, 'pages/index/index');
    assert.equal(result.routes[0].isEntry, true);
    assert.equal(result.routes[0].isTab, true);
    assert.equal(result.routes[0].isSubpackage, false);

    assert.equal(result.routes[2].fullPath, 'subpackages/trade/checkout');
    assert.equal(result.routes[2].isSubpackage, true);
    assert.equal(result.routes[2].subpackageRoot, 'subpackages/trade');

    // Validate generated manifest against schema
    assert.doesNotThrow(() => validateGoatManifest(result.manifest));
  });

  it('correctly parses jsonc with single-line and multi-line comments', () => {
    const jsoncContent = `
    {
      // Main pages declaration
      "pages": [
        /* Index entry */
        { "path": "pages/index/index" }
      ],
      "globalStyle": {
        "navigationBarTitleText": "Hello JSONC" // Trailing comment
      }
    }
    `;

    const parsed = parsePagesJson(jsoncContent);
    assert.equal(parsed.pages.length, 1);
    assert.equal(parsed.pages[0].path, 'pages/index/index');
    assert.equal(parsed.globalStyle?.navigationBarTitleText, 'Hello JSONC');
  });

  it('rejects pages.json with empty pages array', () => {
    assert.throws(
      () => validatePagesJson({ pages: [] }),
      (err: any) => err instanceof ConfigValidationError && err.message.includes('non-empty "pages" array')
    );
  });

  it('rejects pages.json with duplicate page paths', () => {
    assert.throws(
      () =>
        validatePagesJson({
          pages: [{ path: 'pages/index/index' }, { path: 'pages/index/index' }],
        }),
      (err: any) => err instanceof ConfigValidationError && err.message.includes('Duplicate page path')
    );
  });

  it('rejects invalid hex color in navigationBarBackgroundColor', () => {
    assert.throws(
      () =>
        validatePagesJson({
          pages: [
            {
              path: 'pages/index/index',
              style: { navigationBarBackgroundColor: 'red' }, // invalid hex
            },
          ],
        }),
      (err: any) => err instanceof ConfigValidationError && err.message.includes('navigationBarBackgroundColor must be a valid hex color')
    );
  });

  it('rejects tabBar with fewer than 2 items or more than 5 items', () => {
    assert.throws(
      () =>
        validatePagesJson({
          pages: [{ path: 'pages/index/index' }],
          tabBar: {
            color: '#000000',
            selectedColor: '#007AFF',
            backgroundColor: '#FFFFFF',
            list: [{ pagePath: 'pages/index/index', text: 'Home' }],
          },
        }),
      (err: any) => err instanceof ConfigValidationError && err.message.includes('tabBar.list must contain between 2 and 5 items')
    );
  });

  it('rejects tabBar pointing to non-existent pagePath', () => {
    assert.throws(
      () =>
        validatePagesJson({
          pages: [{ path: 'pages/index/index' }, { path: 'pages/user/index' }],
          tabBar: {
            color: '#000000',
            selectedColor: '#007AFF',
            backgroundColor: '#FFFFFF',
            list: [
              { pagePath: 'pages/index/index', text: 'Home' },
              { pagePath: 'pages/not-found/index', text: '404' },
            ],
          },
        }),
      (err: any) => err instanceof ConfigValidationError && err.message.includes('does not exist in main pages')
    );
  });

  it('rejects subpackage with duplicate root or route collision with main package', () => {
    assert.throws(
      () =>
        validatePagesJson({
          pages: [{ path: 'pages/index/index' }, { path: 'sub/detail' }],
          subPackages: [
            {
              root: 'sub',
              pages: [{ path: 'detail' }],
            },
          ],
        }),
      (err: any) => err instanceof ConfigValidationError && err.message.includes('conflicts with main package page')
    );
  });
});
