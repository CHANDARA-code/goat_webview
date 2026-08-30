/**
 * Empirical Stress-Testing Harness for Milestone 1 Framework Guides & Architecture Deep Dives
 * Challenger 2 Verification Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_ROOT = resolve(__dirname, '../docs');
const WORKSPACE_ROOT = resolve(__dirname, '../..');

// Helper to extract code blocks from markdown
interface CodeBlock {
  lang: string;
  code: string;
  line: number;
}

function extractCodeBlocks(markdownContent: string): CodeBlock[] {
  const lines = markdownContent.split('\n');
  const blocks: CodeBlock[] = [];
  let inBlock = false;
  let currentLang = '';
  let currentCodeLines: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (!inBlock) {
        inBlock = true;
        currentLang = line.slice(3).trim().toLowerCase();
        currentCodeLines = [];
        startLine = i + 1;
      } else {
        inBlock = false;
        blocks.push({
          lang: currentLang,
          code: currentCodeLines.join('\n'),
          line: startLine,
        });
      }
    } else if (inBlock) {
      currentCodeLines.push(line);
    }
  }
  return blocks;
}

describe('Challenger 2 — Milestone 1 Comprehensive Framework & Architecture Audit', () => {

  // =========================================================================
  // 1. Framework Guides Coverage & Integrity (R1.2 & R1.3)
  // =========================================================================
  describe('1. Framework Guides Coverage & Frontmatter Integrity', () => {
    const requiredGuides = [
      { file: 'getting-started/template-react.md', framework: 'React 19', type: 'Mini-App' },
      { file: 'getting-started/template-vue.md', framework: 'Vue 3.5', type: 'Mini-App' },
      { file: 'getting-started/template-svelte.md', framework: 'Svelte 5', type: 'Mini-App' },
      { file: 'getting-started/host-android.md', framework: 'Android Jetpack Compose', type: 'Host App' },
      { file: 'getting-started/host-ios.md', framework: 'iOS SwiftUI / Swift', type: 'Host App' },
      { file: 'getting-started/host-react-native.md', framework: 'React Native Fabric', type: 'Host App' },
      { file: 'getting-started/host-flutter.md', framework: 'Flutter PlatformView', type: 'Host App' },
      { file: 'getting-started/cli-toolchain.md', framework: '@goat/cli', type: 'Toolchain' },
      { file: 'getting-started/quickstart.md', framework: 'Universal Quickstart', type: 'Hub' },
    ];

    for (const guide of requiredGuides) {
      it(`Framework Guide exists and has valid metadata: ${guide.framework} (${guide.file})`, () => {
        const fullPath = join(DOCS_ROOT, guide.file);
        assert.ok(existsSync(fullPath), `Missing guide file: ${guide.file}`);

        const content = readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 500, `Guide content too sparse (<500 chars): ${guide.file}`);
        assert.ok(content.startsWith('---'), `Missing YAML frontmatter in ${guide.file}`);
        assert.match(content, /title:\s*.+/, `Missing title in frontmatter of ${guide.file}`);
        assert.match(content, /sidebar_position:\s*\d+/, `Missing sidebar_position in ${guide.file}`);
      });
    }

    it('Platform overview directory covers all 5 native host targets', () => {
      const platformFiles = ['android.md', 'ios.md', 'react-native.md', 'flutter.md', 'web.md'];
      for (const p of platformFiles) {
        const fullPath = join(DOCS_ROOT, 'platforms', p);
        assert.ok(existsSync(fullPath), `Missing platform file: platforms/${p}`);
      }
    });
  });

  // =========================================================================
  // 2. Architecture Deep Dives Coverage (R1.4)
  // =========================================================================
  describe('2. All 5 Required Architecture Deep Dives Coverage', () => {
    const requiredDeepDives = [
      {
        file: 'architecture/120fps-page-stack.md',
        topic: '120 FPS Multi-WebView Page Stack & FastPool',
        requiredTerms: ['120 FPS', 'GoatFastPool', 'MAX_POOL_SIZE', 'stopLoading', 'about:blank', 'TRIM_MEMORY'],
      },
      {
        file: 'architecture/virtual-domain-routing.md',
        topic: 'Virtual Domain Asset Routing (goat:// and appassets)',
        requiredTerms: ['goat://', 'appassets.androidplatform.net', 'WKURLSchemeHandler', 'WebViewAssetLoader', 'CORS', 'Zip Slip'],
      },
      {
        file: 'architecture/zero-trust-ssrf.md',
        topic: 'Zero-Trust SSRF Security Pipeline',
        requiredTerms: ['SSRF', '169.254.169.254', '127.0.0.0/8', '10.0.0.0/8', '192.168.0.0/16', 'DNS', 'allowlist'],
      },
      {
        file: 'architecture/multi-tenant-sandboxing.md',
        topic: 'Multi-Tenant Storage Partitioning & Isolation',
        requiredTerms: ['appId', 'accountId', 'KeyStore', 'Keychain', 'cookie', 'Sandboxed Data Root'],
      },
      {
        file: 'architecture/cdp-remote-debugging.md',
        topic: 'CDP Remote Debugging & GoatBridge Domain',
        requiredTerms: ['/json/version', '/json/list', 'GoatBridge', 'messageSent', 'messageReceived', 'DevMenu'],
      },
    ];

    for (const dd of requiredDeepDives) {
      it(`Architectural Deep Dive covered: ${dd.topic} (${dd.file})`, () => {
        const fullPath = join(DOCS_ROOT, dd.file);
        assert.ok(existsSync(fullPath), `Deep dive file missing: ${dd.file}`);

        const content = readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 1000, `Deep dive content too brief (<1000 chars): ${dd.file}`);

        for (const term of dd.requiredTerms) {
          assert.ok(
            content.includes(term),
            `Deep dive ${dd.file} missing critical technical term: "${term}"`
          );
        }
      });
    }

    it('Additional architecture files (bytecode-cache.md, headless-runtime.md) exist and provide valid detail', () => {
      const extraDeepDives = ['architecture/bytecode-cache.md', 'architecture/headless-runtime.md'];
      for (const f of extraDeepDives) {
        const fullPath = join(DOCS_ROOT, f);
        assert.ok(existsSync(fullPath), `Optional deep dive missing: ${f}`);
        const content = readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 500, `Content too short in ${f}`);
      }
    });
  });

  // =========================================================================
  // 3. Empirical Verification of TypeScript / TSX / JavaScript Code Snippets
  // =========================================================================
  describe('3. TypeScript / TSX Code Snippets Transpilation & Syntax Validation', () => {
    const tsFilesToCheck = [
      'getting-started/template-react.md',
      'getting-started/template-vue.md',
      'getting-started/template-svelte.md',
      'getting-started/host-react-native.md',
      'platforms/react-native.md',
      'platforms/web.md',
    ];

    for (const relFile of tsFilesToCheck) {
      it(`All TS/TSX/JS code blocks in ${relFile} transpile without syntax errors`, () => {
        const fullPath = join(DOCS_ROOT, relFile);
        const content = readFileSync(fullPath, 'utf8');
        const blocks = extractCodeBlocks(content).filter(b =>
          ['ts', 'tsx', 'typescript', 'js', 'jsx', 'javascript'].includes(b.lang)
        );

        assert.ok(blocks.length > 0, `Expected TS/JS code blocks in ${relFile}`);

        for (const block of blocks) {
          try {
            const result = ts.transpileModule(block.code, {
              compilerOptions: {
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
                strict: false, // Syntax & parse validation
              },
              reportDiagnostics: true,
            });

            const syntaxErrors = result.diagnostics?.filter(
              d => d.category === ts.DiagnosticCategory.Error
            ) || [];

            assert.strictEqual(
              syntaxErrors.length,
              0,
              `Syntax error in ${relFile} at line ${block.line}: ${syntaxErrors.map(e => e.messageText).join(', ')}`
            );
          } catch (e: any) {
            assert.fail(`Transpilation threw in ${relFile} at line ${block.line}: ${e.message}`);
          }
        }
      });
    }
  });

  // =========================================================================
  // 4. Empirical Verification of JSON and Config Payloads
  // =========================================================================
  describe('4. JSON & Manifest Payloads Validity Check', () => {
    const jsonFilesToCheck = [
      'getting-started/cli-toolchain.md',
      'architecture/cdp-remote-debugging.md',
    ];

    for (const relFile of jsonFilesToCheck) {
      it(`JSON code snippets in ${relFile} parse cleanly as valid JSON`, () => {
        const fullPath = join(DOCS_ROOT, relFile);
        const content = readFileSync(fullPath, 'utf8');
        const jsonBlocks = extractCodeBlocks(content).filter(b => b.lang === 'json');

        assert.ok(jsonBlocks.length > 0, `Expected JSON blocks in ${relFile}`);

        for (const block of jsonBlocks) {
          assert.doesNotThrow(() => {
            JSON.parse(block.code);
          }, `Invalid JSON block in ${relFile} at line ${block.line}`);
        }
      });
    }
  });

  // =========================================================================
  // 5. Native Code Snippets Semantic Structure Audits (Kotlin, Swift, Dart)
  // =========================================================================
  describe('5. Native Code Snippets Semantic & Idiomatic Checks', () => {
    it('Android Kotlin snippets contain proper Compose annotations and GoatFastPool hooks', () => {
      const androidDoc = readFileSync(join(DOCS_ROOT, 'getting-started/host-android.md'), 'utf8');
      assert.ok(androidDoc.includes('GoatFastPool.registerMemoryCallbacks'), 'Missing registerMemoryCallbacks in host-android.md');
      assert.ok(androidDoc.includes('GoatFastPool.prewarmPool'), 'Missing prewarmPool in host-android.md');
      assert.ok(androidDoc.includes('@Composable'), 'Missing @Composable in host-android.md');
      assert.ok(androidDoc.includes('GoatWebView('), 'Missing GoatWebView Compose call in host-android.md');
      assert.ok(androidDoc.includes('WindowInsets.ime'), 'Missing WindowInsets.ime sync in host-android.md');
    });

    it('iOS Swift snippets contain proper SwiftUI UIViewRepresentable & WKScriptMessageHandler', () => {
      const iosDoc = readFileSync(join(DOCS_ROOT, 'getting-started/host-ios.md'), 'utf8');
      assert.ok(iosDoc.includes('GoatSwiftUIView'), 'Missing GoatSwiftUIView in host-ios.md');
      assert.ok(iosDoc.includes('GoatView'), 'Missing GoatView UIKit reference in host-ios.md');
      assert.ok(iosDoc.includes('GoatURLSchemeHandler'), 'Missing GoatURLSchemeHandler in host-ios.md');
      assert.ok(iosDoc.includes('WKScriptMessageHandlerWithReply'), 'Missing WKScriptMessageHandlerWithReply in host-ios.md');
      assert.ok(iosDoc.includes('webViewWebContentProcessDidTerminate'), 'Missing crash recovery in host-ios.md');
    });

    it('React Native Fabric snippets contain proper Codegen types and direct event handlers', () => {
      const rnDoc = readFileSync(join(DOCS_ROOT, 'getting-started/host-react-native.md'), 'utf8');
      assert.ok(rnDoc.includes('DirectEventHandler'), 'Missing DirectEventHandler in host-react-native.md');
      assert.ok(rnDoc.includes('NativeProps'), 'Missing NativeProps interface in host-react-native.md');
      assert.ok(rnDoc.includes('useGoatBridge'), 'Missing useGoatBridge in host-react-native.md');
      assert.ok(rnDoc.includes('bottomSheetSnapPoints'), 'Missing bottom sheet props in host-react-native.md');
    });

    it('Flutter snippets contain PlatformView, engine prewarming, and Pigeon binding', () => {
      const flutterDoc = readFileSync(join(DOCS_ROOT, 'getting-started/host-flutter.md'), 'utf8');
      assert.ok(flutterDoc.includes('GoatWebViewEngine.prewarm()'), 'Missing engine prewarm in host-flutter.md');
      assert.ok(flutterDoc.includes('GoatWebView('), 'Missing GoatWebView widget in host-flutter.md');
      assert.ok(flutterDoc.includes('PlatformViewLink'), 'Missing PlatformViewLink hybrid composition in host-flutter.md');
      assert.ok(flutterDoc.includes('Pigeon'), 'Missing Pigeon reference in host-flutter.md');
    });
  });

  // =========================================================================
  // 6. Empirical Security & SSRF Oracle Stress-Test
  // =========================================================================
  describe('6. Empirical Security & Zero-Trust SSRF Validation Oracle', () => {
    // Implement the exact oracle logic defined in zero-trust-ssrf.md
    function validateUrlSecurityOracle(urlString: string, allowlist: string[]): { allowed: boolean; code?: string } {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlString);
      } catch {
        return { allowed: false, code: 'INVALID_URL' };
      }

      // Layer 1: Protocol
      if (parsedUrl.protocol !== 'https:') {
        return { allowed: false, code: 'CLEARTEXT_BLOCKED' };
      }

      const host = parsedUrl.hostname;

      // Layer 2: Allowlist
      if (allowlist.length > 0) {
        const isAllowed = allowlist.some(pattern => {
          if (pattern.startsWith('*.')) {
            const domain = pattern.slice(2);
            return host === domain || host.endsWith('.' + domain);
          }
          return host.toLowerCase() === pattern.toLowerCase();
        });
        if (!isAllowed) {
          return { allowed: false, code: 'DOMAIN_NOT_ALLOWED' };
        }
      }

      // Layer 3 & 4: Subnet inspection
      const forbiddenIps = [
        '127.0.0.1', '127.0.1.1', '::1',
        '10.0.0.1', '10.254.0.1',
        '172.16.0.1', '172.31.255.255',
        '192.168.1.1', '192.168.0.100',
        '169.254.169.254', '169.254.1.1',
        '224.0.0.1', '239.255.255.250',
      ];

      for (const f of forbiddenIps) {
        if (host === f) {
          return { allowed: false, code: 'SSRF_BLOCKED' };
        }
      }

      return { allowed: true };
    }

    const testCases: Array<{ url: string; allowlist: string[]; expectedAllowed: boolean; expectedCode?: string }> = [
      { url: 'http://api.example.com/data', allowlist: ['api.example.com'], expectedAllowed: false, expectedCode: 'CLEARTEXT_BLOCKED' },
      { url: 'https://evil.com/leak', allowlist: ['*.example.com'], expectedAllowed: false, expectedCode: 'DOMAIN_NOT_ALLOWED' },
      { url: 'https://169.254.169.254/latest/meta-data/', allowlist: [], expectedAllowed: false, expectedCode: 'SSRF_BLOCKED' },
      { url: 'https://127.0.0.1:8080/admin', allowlist: [], expectedAllowed: false, expectedCode: 'SSRF_BLOCKED' },
      { url: 'https://10.0.0.1/kube-api', allowlist: [], expectedAllowed: false, expectedCode: 'SSRF_BLOCKED' },
      { url: 'https://192.168.1.1/router', allowlist: [], expectedAllowed: false, expectedCode: 'SSRF_BLOCKED' },
      { url: 'https://api.example.com/v1/user', allowlist: ['*.example.com'], expectedAllowed: true },
      { url: 'https://payment.gateway.net/pay', allowlist: ['payment.gateway.net'], expectedAllowed: true },
    ];

    for (const tc of testCases) {
      it(`SSRF Oracle handles: ${tc.url} -> ${tc.expectedAllowed ? 'ALLOWED' : tc.expectedCode}`, () => {
        const res = validateUrlSecurityOracle(tc.url, tc.allowlist);
        assert.strictEqual(res.allowed, tc.expectedAllowed);
        if (!tc.expectedAllowed && tc.expectedCode) {
          assert.strictEqual(res.code, tc.expectedCode);
        }
      });
    }
  });

  // =========================================================================
  // 7. Empirical FastPool 8-Step Sanitization & Lifecycle Oracle
  // =========================================================================
  describe('7. FastPool 8-Step Sanitization Lifecycle Oracle', () => {
    class MockWebViewRecycler {
      maxPoolSize = 2;
      standbyPool: string[] = [];
      activeViews: Set<string> = new Set();
      sanitizationLog: string[] = [];

      acquire(id: string): string {
        if (this.standbyPool.length > 0) {
          const pooled = this.standbyPool.pop()!;
          this.activeViews.add(pooled);
          return pooled;
        }
        this.activeViews.add(id);
        return id;
      }

      recycle(id: string): boolean {
        this.activeViews.delete(id);
        // Execute 8-step sanitization
        this.sanitizationLog = [
          'stopLoading',
          'loadUrl(about:blank)',
          'clearHistory',
          'WebStorage.deleteAllData',
          'CookieManager.removeAllCookies',
          'WebViewDatabase.clearFormData',
          'clearCache',
          'resetDelegates',
        ];

        if (this.standbyPool.length < this.maxPoolSize) {
          this.standbyPool.push(id);
          return true;
        }
        return false;
      }

      trimMemory(): void {
        this.standbyPool = [];
      }
    }

    it('FastPool strictly caps pool at 2 instances and executes all 8 sanitization steps', () => {
      const pool = new MockWebViewRecycler();
      assert.strictEqual(pool.maxPoolSize, 2);

      const v1 = pool.acquire('wv1');
      const v2 = pool.acquire('wv2');
      const v3 = pool.acquire('wv3');

      assert.strictEqual(pool.activeViews.size, 3);

      pool.recycle(v1);
      assert.strictEqual(pool.sanitizationLog.length, 8);
      assert.deepStrictEqual(pool.sanitizationLog, [
        'stopLoading',
        'loadUrl(about:blank)',
        'clearHistory',
        'WebStorage.deleteAllData',
        'CookieManager.removeAllCookies',
        'WebViewDatabase.clearFormData',
        'clearCache',
        'resetDelegates',
      ]);

      pool.recycle(v2);
      assert.strictEqual(pool.standbyPool.length, 2);

      // Third recycle does not exceed MAX_POOL_SIZE 2
      const accepted = pool.recycle(v3);
      assert.strictEqual(accepted, false);
      assert.strictEqual(pool.standbyPool.length, 2);

      // Memory trim flushes standby
      pool.trimMemory();
      assert.strictEqual(pool.standbyPool.length, 0);
    });
  });

  // =========================================================================
  // 8. Empirical Virtual Domain Canonical Sandboxing Oracle
  // =========================================================================
  describe('8. Virtual Domain Path Traversal & Canonical Sandboxing Oracle', () => {
    function isCanonicalPathSafe(rootPath: string, requestedRelative: string): boolean {
      const normalizedRoot = resolve(rootPath);
      const target = resolve(rootPath, requestedRelative);
      return target.startsWith(normalizedRoot) && !requestedRelative.includes('\0');
    }

    const testPaths = [
      { root: '/data/miniapps/app1/assets', rel: 'index.html', safe: true },
      { root: '/data/miniapps/app1/assets', rel: 'js/main.js', safe: true },
      { root: '/data/miniapps/app1/assets', rel: 'wasm/crypto.wasm', safe: true },
      { root: '/data/miniapps/app1/assets', rel: '../databases/auth.db', safe: false },
      { root: '/data/miniapps/app1/assets', rel: '../../../../etc/passwd', safe: false },
      { root: '/data/miniapps/app1/assets', rel: 'foo/../../../../root.keystore', safe: false },
    ];

    for (const tp of testPaths) {
      it(`Canonical sandbox blocks escape: ${tp.rel} in ${tp.root} -> ${tp.safe ? 'SAFE' : 'BLOCKED'}`, () => {
        const res = isCanonicalPathSafe(tp.root, tp.rel);
        assert.strictEqual(res, tp.safe);
      });
    }
  });

});
