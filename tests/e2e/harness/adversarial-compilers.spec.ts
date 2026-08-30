/**
 * Adversarial Empirical Verification Suite for @goat/compiler-taro & @goat/compiler-uniapp
 * Tests boundary conditions, malformed configs, complex preprocessor expressions,
 * and runtime JSAPI concurrency/quota/stack overflow limits.
 */

import { describe, it, expect } from './test-runner.ts';

// --- Imports from @goat/compiler-taro (dist) ---
import {
  validateManifest as validateTaroManifest,
  validateGoatConfig as validateTaroGoatConfig,
  normalizeHexColor as normalizeTaroHexColor,
  deriveAppId as deriveTaroAppId,
  deriveVersionCode as deriveTaroVersionCode,
  parseRouteTable as parseTaroRouteTable,
  extractPermissions as extractTaroPermissions,
  transformTaroConfig,
} from '../../../packages/compiler-taro/dist/src/config/index.js';

import {
  generateIntegrityManifest as generateTaroIntegrity,
  verifyIntegrity as verifyTaroIntegrity,
  computeSha256 as computeTaroSha256,
} from '../../../packages/compiler-taro/dist/src/bundler/integrity.js';

import {
  setStorage as taroSetStorage,
  getStorage as taroGetStorage,
  setStorageSync as taroSetStorageSync,
  getStorageSync as taroGetStorageSync,
  removeStorage as taroRemoveStorage,
  removeStorageSync as taroRemoveStorageSync,
  clearStorage as taroClearStorage,
  clearStorageSync as taroClearStorageSync,
  getStorageInfo as taroGetStorageInfo,
  getStorageInfoSync as taroGetStorageInfoSync,
} from '../../../packages/compiler-taro/dist/src/runtime/storage.js';
import { syncStorage as taroSyncCacheInstance } from '../../../packages/compiler-taro/dist/src/runtime/sync-cache.js';

import {
  navigateTo as taroNavigateTo,
  redirectTo as taroRedirectTo,
  navigateBack as taroNavigateBack,
  switchTab as taroSwitchTab,
  reLaunch as taroReLaunch,
  getCurrentPages as taroGetCurrentPages,
  __resetPageStack as taroResetPageStack,
} from '../../../packages/compiler-taro/dist/src/runtime/router.js';

import {
  showModal as taroShowModal,
  showToast as taroShowToast,
  hideToast as taroHideToast,
  showLoading as taroShowLoading,
  hideLoading as taroHideLoading,
  showActionSheet as taroShowActionSheet,
} from '../../../packages/compiler-taro/dist/src/runtime/ui.js';

import {
  request as taroRequest,
  downloadFile as taroDownloadFile,
  uploadFile as taroUploadFile,
  connectSocket as taroConnectSocket,
} from '../../../packages/compiler-taro/dist/src/runtime/network.js';

import { bridge as taroBridge } from '../../../packages/compiler-taro/dist/src/runtime/bridge.js';

// --- Imports from @goat/compiler-uniapp (dist) ---
import {
  validatePagesJson as validateUniPagesJson,
  validateGoatManifest as validateUniGoatManifest,
  ConfigValidationError as UniConfigValidationError,
} from '../../../packages/compiler-uniapp/dist/config/validator.js';

import {
  parsePagesJson as parseUniPagesJson,
  parseUniAppManifest,
  transformPagesJsonToGoatManifest as transformUniPagesJson,
} from '../../../packages/compiler-uniapp/dist/config/index.js';

import {
  preprocessCode as uniPreprocessCode,
  preprocessSourceCode as uniPreprocessSourceCode,
  createPreprocessorContext as uniCreatePreprocessorContext,
  evaluatePlatformExpression as uniEvaluatePlatformExpression,
  ConditionStack as UniConditionStack,
} from '../../../packages/compiler-uniapp/dist/preprocessor/index.js';

import {
  generateIntegrityManifest as generateUniIntegrity,
  verifyBundleIntegrity as verifyUniIntegrity,
} from '../../../packages/compiler-uniapp/dist/bundler/integrity.js';

import {
  setStorage as uniSetStorage,
  getStorage as uniGetStorage,
  setStorageSync as uniSetStorageSync,
  getStorageSync as uniGetStorageSync,
  removeStorage as uniRemoveStorage,
  removeStorageSync as uniRemoveStorageSync,
  clearStorage as uniClearStorage,
  clearStorageSync as uniClearStorageSync,
  getStorageInfo as uniGetStorageInfo,
  getStorageInfoSync as uniGetStorageInfoSync,
  clearSyncCache as uniClearSyncCache,
  getSyncCache as uniGetSyncCache,
} from '../../../packages/compiler-uniapp/dist/runtime/storage.js';

import {
  navigateTo as uniNavigateTo,
  redirectTo as uniRedirectTo,
  navigateBack as uniNavigateBack,
  switchTab as uniSwitchTab,
  reLaunch as uniReLaunch,
  preloadPage as uniPreloadPage,
  registerTabPages as uniRegisterTabPages,
  getPageStack as uniGetPageStack,
  resetPageStack as uniResetPageStack,
} from '../../../packages/compiler-uniapp/dist/runtime/router.js';

import {
  showToast as uniShowToast,
  hideToast as uniHideToast,
  showLoading as uniShowLoading,
  hideLoading as uniHideLoading,
  showModal as uniShowModal,
  showActionSheet as uniShowActionSheet,
  setNavigationBarTitle as uniSetNavigationBarTitle,
  setNavigationBarColor as uniSetNavigationBarColor,
} from '../../../packages/compiler-uniapp/dist/runtime/ui.js';

import {
  request as uniRequest,
  downloadFile as uniDownloadFile,
  uploadFile as uniUploadFile,
} from '../../../packages/compiler-uniapp/dist/runtime/network.js';

import {
  setBridgeTransport as uniSetBridgeTransport,
  getBridgeTransport as uniGetBridgeTransport,
  callBridgeAction as uniCallBridgeAction,
} from '../../../packages/compiler-uniapp/dist/runtime/bridge.js';

import {
  rpx2px as uniRpx2px,
  px2rpx as uniPx2rpx,
  transformRpxInCss as uniTransformRpxInCss,
} from '../../../packages/compiler-uniapp/dist/runtime/rpx.js';

describe('Adversarial Test 1: Config & Validation Edge Cases', () => {
  it('Taro Manifest: rejects null, undefined, arrays, and non-object inputs', () => {
    expect(validateTaroManifest(null).isValid).toBe(false);
    expect(validateTaroManifest(undefined).isValid).toBe(false);
    expect(validateTaroManifest([]).isValid).toBe(false);
    expect(validateTaroManifest('string').isValid).toBe(false);
    expect(validateTaroManifest(123).isValid).toBe(false);
  });

  it('Taro Manifest: rejects malformed appId formats', () => {
    const invalidAppIds = [
      '',
      'app', // No dot
      '.com.app', // Leading dot
      'com.app.', // Trailing dot
      'com..app', // Double dot
      'com.Example.App', // Uppercase letters
      'com.example-app.id', // Hyphens not allowed in APP_ID_REGEX
      'com.example.app_1', // Underscore not allowed in APP_ID_REGEX
      '12345', // Numbers only without dot
      'com.app$1', // Special characters
    ];

    for (const appId of invalidAppIds) {
      const res = validateTaroManifest({
        appId,
        appName: 'Test App',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
      });
      expect(res.isValid).toBe(false);
    }
  });

  it('Taro Manifest: validates appName length boundaries (1..50 chars)', () => {
    const valid = validateTaroManifest({
      appId: 'com.example.app',
      appName: 'A', // 1 char: valid
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
    });
    expect(valid.isValid).toBe(true);

    const fiftyChars = 'A'.repeat(50);
    const valid50 = validateTaroManifest({
      appId: 'com.example.app',
      appName: fiftyChars,
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
    });
    expect(valid50.isValid).toBe(true);

    const empty = validateTaroManifest({
      appId: 'com.example.app',
      appName: '',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
    });
    expect(empty.isValid).toBe(false);

    const fiftyOneChars = 'A'.repeat(51);
    const invalid51 = validateTaroManifest({
      appId: 'com.example.app',
      appName: fiftyOneChars,
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
    });
    expect(invalid51.isValid).toBe(false);
  });

  it('Taro Manifest: rejects invalid semver and versionCode', () => {
    const invalidVersions = ['1', '1.0', 'v1.0.0', '1.0.0.0', 'beta-1.0.0'];
    for (const v of invalidVersions) {
      const res = validateTaroManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: v,
        versionCode: 1,
        entryPage: 'pages/index/index',
      });
      expect(res.isValid).toBe(false);
    }

    const invalidCodes = [0, -1, 1.5, '1', null, undefined, NaN, Infinity];
    for (const vc of invalidCodes) {
      const res = validateTaroManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: vc as any,
        entryPage: 'pages/index/index',
      });
      expect(res.isValid).toBe(false);
    }
  });

  it('Taro Manifest: validates hex colors in window config', () => {
    const validColors = ['#FFFFFF', '#000000', '#123456', '#abcdef', '#ABCDEF'];
    for (const c of validColors) {
      const res = validateTaroManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
        window: { backgroundColor: c, navigationBarBackgroundColor: c },
      });
      expect(res.isValid).toBe(true);
    }

    const invalidColors = ['#FFF', '#12345', '#1234567', '#GGGGGG', 'red', 'rgb(0,0,0)'];
    for (const c of invalidColors) {
      const res = validateTaroManifest({
        appId: 'com.example.app',
        appName: 'Test',
        version: '1.0.0',
        versionCode: 1,
        entryPage: 'pages/index/index',
        window: { backgroundColor: c },
      });
      expect(res.isValid).toBe(false);
    }

    // Boundary observation: empty string window.backgroundColor bypasses check because if (w.backgroundColor) is truthy check
    const emptyColorRes = validateTaroManifest({
      appId: 'com.example.app',
      appName: 'Test',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
      window: { backgroundColor: '' },
    });
    // Record empirical observation: empty string is treated as falsy and not rejected
    expect(emptyColorRes.isValid).toBe(true);
  });

  it('Taro Manifest: rejects duplicate subpackage roots and empty subpackage pages', () => {
    const duplicateRoots = validateTaroManifest({
      appId: 'com.example.app',
      appName: 'Test',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
      subpackages: [
        { root: 'sub1', pages: ['index'] },
        { root: '/sub1/', pages: ['detail'] },
      ],
    });
    expect(duplicateRoots.isValid).toBe(false);
    expect(duplicateRoots.errors.some((e) => e.includes('Duplicate subpackage root'))).toBe(true);

    const emptyPages = validateTaroManifest({
      appId: 'com.example.app',
      appName: 'Test',
      version: '1.0.0',
      versionCode: 1,
      entryPage: 'pages/index/index',
      subpackages: [{ root: 'sub1', pages: [] }],
    });
    expect(emptyPages.isValid).toBe(false);
    expect(emptyPages.errors.some((e) => e.includes('cannot be empty'))).toBe(true);
  });

  it('UniApp Validator: rejects malformed pages.json structures with ConfigValidationError', () => {
    expect(() => validateUniPagesJson(null)).toThrow('pages.json must be a JSON object');
    expect(() => validateUniPagesJson({})).toThrow('must declare a non-empty "pages" array');
    expect(() => validateUniPagesJson({ pages: [] })).toThrow('must declare a non-empty "pages" array');
    expect(() => validateUniPagesJson({ pages: [{ path: '' }] })).toThrow('must have a valid non-empty \'path\'');
    expect(() =>
      validateUniPagesJson({
        pages: [{ path: 'pages/index/index' }, { path: 'pages/index/index' }],
      })
    ).toThrow('Duplicate page path');
  });

  it('UniApp Validator: enforces tabBar item count boundaries (2 to 5 items)', () => {
    const singleItem = {
      pages: [{ path: 'pages/index/index' }],
      tabBar: {
        list: [{ pagePath: 'pages/index/index', text: 'Home' }],
      },
    };
    expect(() => validateUniPagesJson(singleItem)).toThrow('between 2 and 5 items');

    const sixItems = {
      pages: [
        { path: 'pages/p1' },
        { path: 'pages/p2' },
        { path: 'pages/p3' },
        { path: 'pages/p4' },
        { path: 'pages/p5' },
        { path: 'pages/p6' },
      ],
      tabBar: {
        list: [
          { pagePath: 'pages/p1', text: '1' },
          { pagePath: 'pages/p2', text: '2' },
          { pagePath: 'pages/p3', text: '3' },
          { pagePath: 'pages/p4', text: '4' },
          { pagePath: 'pages/p5', text: '5' },
          { pagePath: 'pages/p6', text: '6' },
        ],
      },
    };
    expect(() => validateUniPagesJson(sixItems)).toThrow('between 2 and 5 items');
  });

  it('UniApp Validator: detects route collisions between subpackages and main package', () => {
    const colliding = {
      pages: [{ path: 'pages/index' }, { path: 'sub/checkout' }],
      subPackages: [
        {
          root: 'sub',
          pages: [{ path: 'checkout' }],
        },
      ],
    };
    expect(() => validateUniPagesJson(colliding)).toThrow('conflicts with main package page');
  });

  it('UniApp JSONC Parser: parses comments, trailing commas, and escaped strings', () => {
    const complexJsonc = `
    {
      /* Multi-line header comment
         with special chars: * / // "quotes" */
      "pages": [
        // Index page
        {
          "path": "pages/index/index",
          "style": {
            "navigationBarTitleText": "Home // Not a comment: /* url https://goat.dev */",
          }
        },
      ],
      "globalStyle": {
        "backgroundColor": "#FFFFFF", // Trailing line comment
      },
    }
    `;

    const parsed = parseUniPagesJson(complexJsonc);
    expect(parsed.pages.length).toBe(1);
    expect(parsed.pages[0].path).toBe('pages/index/index');
    expect(parsed.pages[0].style?.navigationBarTitleText).toBe('Home // Not a comment: /* url https://goat.dev */');
    expect(parsed.globalStyle?.backgroundColor).toBe('#FFFFFF');
  });
});

describe('Adversarial Test 2: Complex Conditional Compilation Scenarios', () => {
  it('Preprocessor: deeply nested 4-level #ifdef blocks evaluating correctly', () => {
    const source = `
    // #ifdef MP
      // #ifdef MP-WEIXIN
        // #ifndef H5
          // #ifdef GOAT
            const platform = "NESTED_GOAT_ACTIVE";
          // #endif
        // #endif
      // #endif
    // #endif
    `;

    // Target GOAT with MP and MP-WEIXIN active
    const res = uniPreprocessSourceCode(source, { targetPlatform: 'GOAT', compatMode: true });
    expect(res.code).toContain('const platform = "NESTED_GOAT_ACTIVE";');

    // Target H5: MP is not active -> whole block masked
    const resH5 = uniPreprocessSourceCode(source, { targetPlatform: 'H5', compatMode: false });
    expect(resH5.code).not.toContain('const platform = "NESTED_GOAT_ACTIVE";');
  });

  it('Preprocessor: multi-platform logical OR expressions', () => {
    const source = `
    // #ifdef MP-WEIXIN || MP-ALIPAY || GOAT || QUICKAPP
    const isSupported = true;
    // #endif

    // #ifdef H5 || APP-PLUS
    const isExcluded = true;
    // #endif
    `;

    const res = uniPreprocessSourceCode(source, { targetPlatform: 'GOAT' });
    expect(res.code).toContain('const isSupported = true;');
    expect(res.code).not.toContain('const isExcluded = true;');
  });

  it('Preprocessor: negative #ifndef condition handling', () => {
    const source = `
    // #ifndef H5
    const notH5 = true;
    // #endif

    // #ifndef GOAT
    const notGoat = true;
    // #endif
    `;

    const res = uniPreprocessSourceCode(source, { targetPlatform: 'GOAT' });
    expect(res.code).toContain('const notH5 = true;');
    expect(res.code).not.toContain('const notGoat = true;');
  });

  it('Preprocessor: Vue SFC template comment directives <!-- #ifdef -->', () => {
    const vueTemplate = `
    <template>
      <view class="container">
        <!-- #ifdef GOAT -->
        <goat-custom-header title="Goat Title" />
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <h5-header title="H5 Title" />
        <!-- #endif -->
      </view>
    </template>
    `;

    const res = uniPreprocessSourceCode(vueTemplate, { targetPlatform: 'GOAT' });
    expect(res.code).toContain('<goat-custom-header title="Goat Title" />');
    expect(res.code).not.toContain('<h5-header title="H5 Title" />');
  });

  it('Preprocessor: CSS / SCSS style comment directives /* #ifdef */', () => {
    const cssContent = `
    /* #ifdef GOAT */
    .goat-theme {
      background-color: #007AFF;
      font-size: 32rpx;
    }
    /* #endif */

    /* #ifdef H5 */
    .h5-theme {
      background-color: #FF0000;
    }
    /* #endif */
    `;

    const res = uniPreprocessSourceCode(cssContent, { targetPlatform: 'GOAT' });
    expect(res.code).toContain('.goat-theme');
    expect(res.code).not.toContain('.h5-theme');
  });

  it('Preprocessor: platform names with plus sign (APP-PLUS, APP-PLUS-NVUE)', () => {
    const source = `
    // #ifdef APP-PLUS
    const isAppPlus = true;
    // #endif

    // #ifdef APP-PLUS-NVUE
    const isNvue = true;
    // #endif
    `;

    // Target is APP-PLUS
    const res = uniPreprocessSourceCode(source, { targetPlatform: 'APP-PLUS', compatMode: false });
    // Empirical observation of regex behavior for [A-Za-z0-9_| -]:
    // Since '+' is not in the character class, 'APP-PLUS' fails IFDEF_REGEX match,
    // causing the line to not be recognized as a directive and remaining unmasked.
    const isRecognizedAsDirective = !res.code.includes('// #ifdef APP-PLUS');
    console.log('[EMPIRICAL DATA] APP-PLUS directive recognized:', isRecognizedAsDirective);
  });

  it('Preprocessor: line count fidelity with preserveLines', () => {
    const source = `
line1
// #ifdef H5
line3_excluded
line4_excluded
// #endif
line6_included
    `.trim();

    const originalLineCount = source.split('\n').length;
    const res = uniPreprocessSourceCode(source, { targetPlatform: 'GOAT', preserveLines: true });
    const processedLineCount = res.code.split('\n').length;

    expect(processedLineCount).toBe(originalLineCount);
    expect(res.code).toContain('line1');
    expect(res.code).toContain('line6_included');
    expect(res.code).not.toContain('line3_excluded');
    expect(res.code).not.toContain('line4_excluded');
  });

  it('Preprocessor: unclosed #ifdef blocks and orphaned #endif gracefully handled', () => {
    const unclosed = `
    // #ifdef GOAT
    const a = 1;
    // Missing endif
    `;
    const resUnclosed = uniPreprocessSourceCode(unclosed, { targetPlatform: 'GOAT' });
    expect(resUnclosed.code).toContain('const a = 1;');

    const orphanedEndif = `
    const a = 1;
    // #endif
    const b = 2;
    `;
    const resOrphaned = uniPreprocessSourceCode(orphanedEndif, { targetPlatform: 'GOAT' });
    expect(resOrphaned.code).toContain('const a = 1;');
    expect(resOrphaned.code).toContain('const b = 2;');
  });
});

describe('Adversarial Test 3: Runtime Storage Concurrency & Quota Limits', () => {
  it('Taro Storage: enforces 10MB quota on large single write in setStorageSync', () => {
    taroClearStorageSync();

    // 10.5 MB string
    const tenAndHalfMB = 'X'.repeat(10.5 * 1024 * 1024);
    expect(() => {
      taroSetStorageSync('big_key', tenAndHalfMB);
    }).toThrow('storage quota of 10MB exceeded');

    // Storage info should remain 0
    const info = taroGetStorageInfoSync();
    expect(info.currentSize).toBe(0);
  });

  it('Taro Storage: enforces 10MB quota across cumulative incremental writes', () => {
    taroClearStorageSync();

    const oneMB = 'A'.repeat(1024 * 1024);

    // Write 9 x 1MB keys -> 9MB total (allowed)
    for (let i = 0; i < 9; i++) {
      taroSetStorageSync(`key_${i}`, oneMB);
    }
    const info = taroGetStorageInfoSync();
    expect(info.keys.length).toBe(9);
    expect(info.currentSize).toBeGreaterThanOrEqual(9000);

    // Attempt to write 2MB more (total 11MB) -> must throw
    const twoMB = 'B'.repeat(2 * 1024 * 1024);
    expect(() => {
      taroSetStorageSync('overflow_key', twoMB);
    }).toThrow('storage quota of 10MB exceeded');

    taroClearStorageSync();
  });

  it('Taro Storage: accurately recalculates quota when overwriting existing keys', () => {
    taroClearStorageSync();

    const fiveMB = 'A'.repeat(5 * 1024 * 1024);
    taroSetStorageSync('shared_key', fiveMB);

    // Overwriting the same key with 5MB must NOT double to 10MB
    const fiveMBNew = 'B'.repeat(5 * 1024 * 1024);
    expect(() => {
      taroSetStorageSync('shared_key', fiveMBNew);
    }).not.toThrow();

    const info = taroGetStorageInfoSync();
    expect(info.keys.length).toBe(1);
    expect(info.currentSize).toBeLessThanOrEqual(5150);

    taroClearStorageSync();
  });

  it('Taro Storage: handles 50 rapid concurrent async setStorage writes without race conditions', async () => {
    taroClearStorageSync();

    const promises: Promise<any>[] = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        taroSetStorage({
          key: `concurrent_${i}`,
          data: { index: i, timestamp: Date.now(), payload: `data_${i}` },
        })
      );
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(50);

    const info = await taroGetStorageInfo();
    expect(info.keys.length).toBe(50);

    // Verify data integrity of individual keys
    for (let i = 0; i < 50; i++) {
      const val = taroGetStorageSync(`concurrent_${i}`);
      expect(val.index).toBe(i);
      expect(val.payload).toBe(`data_${i}`);
    }

    taroClearStorageSync();
  });

  it('Taro Storage: boundary types (null, undefined, false, 0, objects, arrays)', async () => {
    taroClearStorageSync();

    taroSetStorageSync('bool_val', false);
    taroSetStorageSync('num_val', 0);
    taroSetStorageSync('str_val', '');
    taroSetStorageSync('null_val', null);
    taroSetStorageSync('obj_val', { a: [1, 2, { b: 'c' }] });

    expect(taroGetStorageSync('bool_val')).toBe(false);
    expect(taroGetStorageSync('num_val')).toBe(0);
    expect(taroGetStorageSync('str_val')).toBe('');
    expect(taroGetStorageSync('null_val')).toBe(null);
    expect(taroGetStorageSync('obj_val')).toEqual({ a: [1, 2, { b: 'c' }] });

    // Non-existent key
    expect(taroGetStorageSync('non_existent')).toBe('');

    taroClearStorageSync();
  });

  it('UniApp Storage: synchronous cache lifecycle and non-string fallback safety', () => {
    uniClearSyncCache();

    uniSetStorageSync('key1', 'value1');
    uniSetStorageSync('key2', { num: 42 });

    expect(uniGetStorageSync('key1')).toBe('value1');
    expect(uniGetStorageSync('key2')).toEqual({ num: 42 });
    expect(uniGetStorageSync('unknown_key')).toBe('');

    const info = uniGetStorageInfoSync();
    expect(info.keys.length).toBe(2);
    expect(info.limitSize).toBe(10240);

    uniRemoveStorageSync('key1');
    expect(uniGetStorageSync('key1')).toBe('');
    expect(uniGetStorageInfoSync().keys.length).toBe(1);

    uniClearStorageSync();
    expect(uniGetStorageInfoSync().keys.length).toBe(0);
  });

  it('UniApp Storage: resilience with undefined / complex values in getStorageInfoSync', () => {
    uniClearSyncCache();
    uniSetStorageSync('null_key', null);
    uniSetStorageSync('bool_key', false);
    uniSetStorageSync('num_key', 0);

    const info = uniGetStorageInfoSync();
    expect(info.keys.length).toBe(3);
    expect(info.currentSize).toBeGreaterThanOrEqual(0);

    // Test storing undefined
    uniSetStorageSync('undef_key', undefined);
    // In JSON.stringify(undefined), returns undefined. Let's see if getStorageInfo handles it gracefully or throws:
    let threw = false;
    let errMessage = '';
    try {
      uniGetStorageInfoSync();
    } catch (e: any) {
      threw = true;
      errMessage = e.message;
    }
    console.log('[EMPIRICAL DATA] uni.getStorageInfoSync with undefined threw:', threw, errMessage);

    uniClearSyncCache();
  });
});

describe('Adversarial Test 4: Page Navigation Stack Overflows & Underflows', () => {
  it('Taro Navigation: enforces max page stack depth 10 on navigateTo overflow', async () => {
    taroResetPageStack('pages/index/index');
    expect(taroGetCurrentPages().length).toBe(1);

    // Push 9 more pages to reach depth 10
    for (let i = 1; i <= 9; i++) {
      await taroNavigateTo({ url: `pages/page_${i}/index` });
    }
    expect(taroGetCurrentPages().length).toBe(10);

    // Attempt to push 11th page -> must reject with STACK_OVERFLOW
    let rejected = false;
    try {
      await taroNavigateTo({ url: 'pages/page_overflow/index' });
    } catch (err: any) {
      rejected = true;
      expect(err.code).toBe('STACK_OVERFLOW');
      expect(err.errMsg).toContain('page stack depth limit exceeded (max 10)');
    }
    expect(rejected).toBe(true);
    expect(taroGetCurrentPages().length).toBe(10);

    taroResetPageStack();
  });

  it('Taro Navigation: prevents stack underflow on root page pop', async () => {
    taroResetPageStack('pages/index/index');
    expect(taroGetCurrentPages().length).toBe(1);

    // On root page, navigateBack must reject
    let underflowRejected = false;
    try {
      await taroNavigateBack();
    } catch (err: any) {
      underflowRejected = true;
      expect(err.code).toBe('STACK_UNDERFLOW');
      expect(err.errMsg).toContain('cannot pop root page');
    }
    expect(underflowRejected).toBe(true);
    expect(taroGetCurrentPages().length).toBe(1);

    taroResetPageStack();
  });

  it('Taro Navigation: navigateBack pops multiple pages up to root boundary', async () => {
    taroResetPageStack('pages/index/index');
    await taroNavigateTo({ url: 'pages/page_1/index' });
    await taroNavigateTo({ url: 'pages/page_2/index' });
    await taroNavigateTo({ url: 'pages/page_3/index' });
    expect(taroGetCurrentPages().length).toBe(4);

    // Pop with delta 2 -> leaves 2 pages
    await taroNavigateBack({ delta: 2 });
    expect(taroGetCurrentPages().length).toBe(2);
    expect(taroGetCurrentPages()[1].route).toBe('pages/page_1/index');

    // Pop with delta 100 (excessive) -> leaves 1 root page
    await taroNavigateBack({ delta: 100 });
    expect(taroGetCurrentPages().length).toBe(1);
    expect(taroGetCurrentPages()[0].route).toBe('pages/index/index');

    taroResetPageStack();
  });

  it('Taro Navigation: redirectTo, switchTab, and reLaunch stack operations', async () => {
    taroResetPageStack('pages/index/index');
    await taroNavigateTo({ url: 'pages/page_1/index' });
    expect(taroGetCurrentPages().length).toBe(2);

    // redirectTo replaces top page
    await taroRedirectTo({ url: 'pages/page_replaced/index' });
    expect(taroGetCurrentPages().length).toBe(2);
    expect(taroGetCurrentPages()[1].route).toBe('pages/page_replaced/index');

    // switchTab clears stack and sets target tab
    await taroSwitchTab({ url: 'pages/tab_user/index' });
    expect(taroGetCurrentPages().length).toBe(1);
    expect(taroGetCurrentPages()[0].route).toBe('pages/tab_user/index');

    // reLaunch resets stack
    await taroReLaunch({ url: 'pages/relaunch_target/index' });
    expect(taroGetCurrentPages().length).toBe(1);
    expect(taroGetCurrentPages()[0].route).toBe('pages/relaunch_target/index');

    taroResetPageStack();
  });

  it('UniApp Navigation: rejects navigateTo targeting a registered tabBar page', async () => {
    uniResetPageStack('pages/index/index');
    uniRegisterTabPages(['pages/index/index', 'pages/user/index']);

    let rejected = false;
    try {
      await uniNavigateTo({ url: 'pages/user/index' });
    } catch (err: any) {
      rejected = true;
      expect(err.errMsg).toContain('can not navigate to a tab bar page');
    }
    expect(rejected).toBe(true);

    // Normal non-tab navigation works
    const res = await uniNavigateTo({ url: 'pages/detail/index' });
    expect(res.errMsg).toBe('navigateTo:ok');
    expect(uniGetPageStack().length).toBe(2);

    uniResetPageStack();
  });
});

describe('Adversarial Test 5: UI Modal Cooldown & Input Validation Boundaries', () => {
  it('Taro UI: enforces 500ms modal cooldown window against spamming', async () => {
    // 1st modal invocation succeeds
    const firstModal = await taroShowModal({ title: 'First', content: 'Prompt 1' });
    expect(firstModal.confirm).toBe(true);

    // Immediate 2nd modal invocation (0ms elapsed) -> must reject with DIALOG_COOLDOWN_ACTIVE
    let cooldownRejected = false;
    try {
      await taroShowModal({ title: 'Second', content: 'Prompt 2' });
    } catch (err: any) {
      cooldownRejected = true;
      expect(err.code).toBe('DIALOG_COOLDOWN_ACTIVE');
      expect(err.errMsg).toContain('dialog cooldown active (wait 500ms)');
    }
    expect(cooldownRejected).toBe(true);

    // Wait 550ms -> 3rd modal invocation must succeed
    await new Promise((resolve) => setTimeout(resolve, 550));
    const thirdModal = await taroShowModal({ title: 'Third', content: 'Prompt 3' });
    expect(thirdModal.confirm).toBe(true);
  });

  it('UniApp UI: rejects showModal with blank or missing content', async () => {
    let rejectedEmpty = false;
    try {
      await uniShowModal({ content: '' } as any);
    } catch (err: any) {
      rejectedEmpty = true;
      expect(err.errMsg).toContain('content must not be blank');
    }
    expect(rejectedEmpty).toBe(true);

    let rejectedWhitespace = false;
    try {
      await uniShowModal({ content: '   ' } as any);
    } catch (err: any) {
      rejectedWhitespace = true;
      expect(err.errMsg).toContain('content must not be blank');
    }
    expect(rejectedWhitespace).toBe(true);

    // Valid content succeeds
    const valid = await uniShowModal({ content: 'Are you sure?' });
    expect(valid.errMsg).toBe('showModal:ok');
    expect(valid.confirm).toBe(true);
  });

  it('Taro & UniApp UI: validates showToast and showActionSheet input arguments', async () => {
    // Taro Toast missing title
    let taroToastRejected = false;
    try {
      await taroShowToast({} as any);
    } catch (err: any) {
      taroToastRejected = true;
      expect(err.errMsg).toContain('title is required');
    }
    expect(taroToastRejected).toBe(true);

    // UniApp Toast missing title
    let uniToastRejected = false;
    try {
      await uniShowToast({} as any);
    } catch (err: any) {
      uniToastRejected = true;
      expect(err.errMsg).toContain('title is required');
    }
    expect(uniToastRejected).toBe(true);

    // Taro ActionSheet empty itemList
    let taroSheetRejected = false;
    try {
      await taroShowActionSheet({ itemList: [] });
    } catch (err: any) {
      taroSheetRejected = true;
      expect(err.errMsg).toContain('itemList must contain at least 1 item');
    }
    expect(taroSheetRejected).toBe(true);

    // UniApp ActionSheet empty itemList
    let uniSheetRejected = false;
    try {
      await uniShowActionSheet({ itemList: [] });
    } catch (err: any) {
      uniSheetRejected = true;
      expect(err.errMsg).toContain('itemList must be a non-empty array');
    }
    expect(uniSheetRejected).toBe(true);
  });
});

describe('Adversarial Test 6: Custom Bridge Caller & Error Propagation', () => {
  it('Taro Bridge: propagates custom bridge errors with callbacks and Promise rejections', async () => {
    // Inject mock bridge that fails with custom error
    taroBridge.setBridgeCaller(async (action, payload) => {
      if (action === 'API_REQUEST') {
        throw { code: 'NETWORK_TIMEOUT', message: 'Connection timed out after 5000ms' };
      }
      return { ok: true };
    });

    let failCallbackInvoked = false;
    let completeCallbackInvoked = false;
    let promiseRejected = false;

    try {
      await taroRequest({
        url: 'https://api.example.com/test',
        fail(err) {
          failCallbackInvoked = true;
          expect(err.code).toBe('NETWORK_TIMEOUT');
          expect(err.errMsg).toContain('Connection timed out');
        },
        complete(res) {
          completeCallbackInvoked = true;
        },
      });
    } catch (err: any) {
      promiseRejected = true;
      expect(err.code).toBe('NETWORK_TIMEOUT');
    }

    expect(failCallbackInvoked).toBe(true);
    expect(completeCallbackInvoked).toBe(true);
    expect(promiseRejected).toBe(true);

    // Reset caller to default
    taroBridge.setBridgeCaller(undefined);
  });

  it('UniApp Bridge: custom bridge transport interceptor and error wrapping', async () => {
    uniSetBridgeTransport(async (action, payload) => {
      if (action === 'API_REQUEST') {
        return Promise.reject({ code: 'SSRF_BLOCKED', message: 'Target IP blocked' });
      }
      return { ok: true };
    });

    let failInvoked = false;
    let promiseRejected = false;

    try {
      await uniRequest({
        url: 'http://169.254.169.254/latest/meta-data',
        fail(err) {
          failInvoked = true;
          expect(err.errMsg).toContain('Target IP blocked');
        },
      });
    } catch (err: any) {
      promiseRejected = true;
      expect(err.errMsg).toContain('Target IP blocked');
    }

    expect(failInvoked).toBe(true);
    expect(promiseRejected).toBe(true);

    uniSetBridgeTransport(null);
  });
});
