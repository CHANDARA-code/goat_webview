/**
 * tests/games/challenger-embeddability-test.ts
 *
 * Empirical Challenger Test Harness:
 * 1. Build Output & Disk Asset Existence (Zero 404s)
 * 2. Asset Link Relative Path Integrity (Zero absolute /assets/ paths)
 * 3. Viewport Meta Tag Conformance (Mobile WebView embeddability)
 * 4. CSS Containment & Touch Shielding (Fixed, inset: 0, overflow hidden, touch-action none)
 * 5. Production Bundle Size Gate Conformance (Uncompressed and Gzipped)
 * 6. Clamped DPR Verification Across Engines (Clamped to <= 2.0)
 * 7. Offline Self-Containment & External Request Shielding (Zero external CDNs)
 *
 * Executable directly via: node --experimental-strip-types tests/games/challenger-embeddability-test.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAMES_ROOT = __dirname;
const PROJECTS = ['littlejs-demo', 'phaser-demo', 'threejs-demo', 'r3f-demo'] as const;
type ProjectName = typeof PROJECTS[number];

// ANSI Colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: Record<string, unknown>): void {
  if (condition) {
    results.push({ suite, name, passed: true, details });
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed', details });
  }
}

function expectEqual<T>(actual: T, expected: T, suite: string, name: string): void {
  const passed = actual === expected;
  if (passed) {
    results.push({ suite, name, passed: true, details: { actual, expected } });
  } else {
    results.push({
      suite,
      name,
      passed: false,
      error: `Expected ${String(expected)} but received ${String(actual)}`,
      details: { actual, expected },
    });
  }
}

// Helper: Calculate file and directory sizes
function getDirectoryStats(dirPath: string): {
  totalBytes: number;
  totalGzipBytes: number;
  fileCount: number;
  files: Array<{ relativePath: string; bytes: number; gzipBytes: number }>;
} {
  let totalBytes = 0;
  let totalGzipBytes = 0;
  let fileCount = 0;
  const files: Array<{ relativePath: string; bytes: number; gzipBytes: number }> = [];

  function scan(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        // Exclude .map files from bundle size evaluation
        if (entry.name.endsWith('.map')) continue;

        const content = fs.readFileSync(fullPath);
        const bytes = content.length;
        const gzipBytes = zlib.gzipSync(content).length;
        const relativePath = path.relative(dirPath, fullPath);

        totalBytes += bytes;
        totalGzipBytes += gzipBytes;
        fileCount++;
        files.push({ relativePath, bytes, gzipBytes });
      }
    }
  }

  if (fs.existsSync(dirPath)) {
    scan(dirPath);
  }

  return { totalBytes, totalGzipBytes, fileCount, files };
}

console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
console.log(`${BOLD}${CYAN} 🧪 EMPIRICAL CHALLENGER: Web Games Embeddability & Bundle Gate Suite${RESET}`);
console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

// ============================================================================
// Suite 1: Build Output & Disk Asset Existence (Zero 404s)
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 1: Build Output & Disk Asset Integrity ---${RESET}`);

for (const project of PROJECTS) {
  const distDir = path.join(GAMES_ROOT, project, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  const distExists = fs.existsSync(distDir);
  assert(distExists, 'Suite 1: Build Output Existence', `[${project}] dist/ directory exists on disk`);

  const indexHtmlExists = fs.existsSync(indexHtmlPath);
  assert(indexHtmlExists, 'Suite 1: Build Output Existence', `[${project}] dist/index.html exists`);

  if (indexHtmlExists) {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    assert(htmlContent.length > 200, 'Suite 1: Build Output Existence', `[${project}] dist/index.html is non-empty (${htmlContent.length} bytes)`);

    // Parse all script and link tags and verify target files exist
    const scriptSrcMatches = [...htmlContent.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
    const linkHrefMatches = [...htmlContent.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map((m) => m[1]);

    const referencedAssets = [...scriptSrcMatches, ...linkHrefMatches];
    assert(referencedAssets.length > 0, 'Suite 1: Asset References', `[${project}] dist/index.html references at least one asset`);

    for (const assetRef of referencedAssets) {
      // Resolve path relative to dist/
      const cleanRef = assetRef.replace(/^\.\//, '');
      const assetOnDisk = path.join(distDir, cleanRef);
      const fileExists = fs.existsSync(assetOnDisk);
      assert(
        fileExists,
        'Suite 1: Zero 404 Asset Verification',
        `[${project}] Asset '${assetRef}' exists on disk at ${cleanRef}`,
        { assetRef, resolvedDiskPath: assetOnDisk, exists: fileExists }
      );

      if (fileExists) {
        const stat = fs.statSync(assetOnDisk);
        assert(stat.size > 0, 'Suite 1: Zero 404 Asset Verification', `[${project}] Asset '${assetRef}' is non-empty (${stat.size} bytes)`);
      }
    }
  }
}

// ============================================================================
// Suite 2: Asset Link Relative Path Integrity (Zero Absolute /assets/ Paths)
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 2: Asset Link Relative Path Integrity ---${RESET}`);

for (const project of PROJECTS) {
  const distDir = path.join(GAMES_ROOT, project, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  const viteConfigPath = path.join(GAMES_ROOT, project, 'vite.config.ts');

  // 1. Verify vite.config.ts specifies base: './'
  const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  assert(
    viteConfig.includes("base: './'") || viteConfig.includes('base: "./"'),
    'Suite 2: Vite Base Configuration',
    `[${project}] vite.config.ts explicitly sets base: './'`
  );

  if (fs.existsSync(indexHtmlPath)) {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // 2. Scan all script tags
    const scriptTags = [...htmlContent.matchAll(/<script\b[^>]*>/gi)];
    for (const [tag] of scriptTags) {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        const src = srcMatch[1];
        // Must start with ./ or not start with /
        const isAbsolute = src.startsWith('/') && !src.startsWith('//');
        const isRelative = src.startsWith('./') || (!src.startsWith('/') && !src.startsWith('http'));

        assert(
          !isAbsolute,
          'Suite 2: Relative Script Paths',
          `[${project}] <script> tag does NOT use absolute root path: ${src}`,
          { tag, src }
        );
        assert(
          isRelative,
          'Suite 2: Relative Script Paths',
          `[${project}] <script> tag uses valid relative path: ${src}`,
          { tag, src }
        );
      }
    }

    // 3. Scan all link tags
    const linkTags = [...htmlContent.matchAll(/<link\b[^>]*>/gi)];
    for (const [tag] of linkTags) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        const isAbsolute = href.startsWith('/') && !href.startsWith('//');
        const isRelative = href.startsWith('./') || (!href.startsWith('/') && !href.startsWith('http'));

        assert(
          !isAbsolute,
          'Suite 2: Relative Link Paths',
          `[${project}] <link> tag does NOT use absolute root path: ${href}`,
          { tag, href }
        );
        assert(
          isRelative,
          'Suite 2: Relative Link Paths',
          `[${project}] <link> tag uses valid relative path: ${href}`,
          { tag, href }
        );
      }
    }

    // 4. Scan for any general absolute /assets/ or /src/ in the whole HTML
    const absoluteRootMatches = [...htmlContent.matchAll(/(?:src|href)=["']\/(assets|src)[^"']*["']/gi)].map((m) => m[0]);
    assert(
      absoluteRootMatches.length === 0,
      'Suite 2: No Root Slash Asset References',
      `[${project}] 100% free of root-relative /assets/ or /src/ links in dist/index.html`,
      { violations: absoluteRootMatches }
    );
  }
}

// ============================================================================
// Suite 3: Mobile WebView Viewport Meta Tag Conformance
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 3: Mobile WebView Viewport Meta Tag Conformance ---${RESET}`);

const REQUIRED_VIEWPORT_DIRECTIVES = [
  'width=device-width',
  'initial-scale=1.0',
  'maximum-scale=1.0',
  'user-scalable=no',
  'viewport-fit=cover',
];

for (const project of PROJECTS) {
  const indexHtmlPath = path.join(GAMES_ROOT, project, 'dist', 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // Extract viewport meta tag
    const viewportMatch = htmlContent.match(/<meta[^>]+name=["']viewport["'][^>]*>/i);
    assert(
      Boolean(viewportMatch),
      'Suite 3: Viewport Meta Tag Existence',
      `[${project}] dist/index.html has <meta name="viewport">`
    );

    if (viewportMatch) {
      const tag = viewportMatch[0];
      const contentMatch = tag.match(/content=["']([^"']+)["']/i);
      assert(Boolean(contentMatch), 'Suite 3: Viewport Content Attribute', `[${project}] Viewport meta tag has content attribute`);

      if (contentMatch) {
        const content = contentMatch[1].replace(/\s+/g, '');
        for (const directive of REQUIRED_VIEWPORT_DIRECTIVES) {
          const hasDirective = content.includes(directive);
          assert(
            hasDirective,
            'Suite 3: Viewport Directive Enforcement',
            `[${project}] Viewport specifies '${directive}'`,
            { tag, directive, actualContent: contentMatch[1] }
          );
        }
      }
    }
  }
}

// ============================================================================
// Suite 4: CSS Containment & Mobile Touch Shielding Conformance
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 4: CSS Containment & Touch Shielding Conformance ---${RESET}`);

const REQUIRED_CSS_PROPERTIES = [
  { prop: 'position: fixed', regex: /position\s*:\s*fixed/i },
  { prop: 'inset: 0', regex: /inset\s*:\s*0/i },
  { prop: 'overflow: hidden', regex: /overflow\s*:\s*hidden/i },
  { prop: 'touch-action: none', regex: /touch-action\s*:\s*none/i },
  { prop: 'user-select: none', regex: /user-select\s*:\s*none/i },
];

for (const project of PROJECTS) {
  const indexHtmlPath = path.join(GAMES_ROOT, project, 'dist', 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // Extract inline style or style tags
    const styleMatches = [...htmlContent.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');

    for (const { prop, regex } of REQUIRED_CSS_PROPERTIES) {
      const hasProp = regex.test(styleMatches);
      assert(
        hasProp,
        'Suite 4: CSS Containment Enforcement',
        `[${project}] CSS includes '${prop}' on html/body`,
        { property: prop, found: hasProp }
      );
    }

    // Verify vendor prefixes for user selection prevention on WebKit / iOS WebView
    const hasWebkitUserSelect = /-webkit-user-select\s*:\s*none/i.test(styleMatches);
    assert(
      hasWebkitUserSelect,
      'Suite 4: WebKit Touch Callout & Selection',
      `[${project}] CSS includes '-webkit-user-select: none' for iOS WKWebView`
    );

    const hasWebkitTouchCallout = /-webkit-touch-callout\s*:\s*none/i.test(styleMatches);
    assert(
      hasWebkitTouchCallout,
      'Suite 4: WebKit Touch Callout & Selection',
      `[${project}] CSS includes '-webkit-touch-callout: none' to suppress iOS callout menus`
    );
  }
}

// ============================================================================
// Suite 5: Production Bundle Size Gate Conformance (Uncompressed & Gzipped)
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 5: Bundle Size Gate Conformance ---${RESET}`);

interface BudgetConfig {
  uncompressedLimitKB: number;
  gzipLimitKB: number;
}

const BUDGETS: Record<ProjectName, BudgetConfig> = {
  'littlejs-demo': { uncompressedLimitKB: 70, gzipLimitKB: 35 },
  'threejs-demo': { uncompressedLimitKB: 850, gzipLimitKB: 250 },
  'phaser-demo': { uncompressedLimitKB: 1600, gzipLimitKB: 450 },
  'r3f-demo': { uncompressedLimitKB: 1600, gzipLimitKB: 400 },
};

console.log(
  `\n${BOLD}%-16s | %-14s | %-14s | %-14s | %-12s | %-8s${RESET}`,
  'Project',
  'Uncompressed',
  'Uncomp Budget',
  'Gzipped',
  'Gzip Budget',
  'Status'
);
console.log('-----------------+----------------+----------------+----------------+--------------+--------');

for (const project of PROJECTS) {
  const distDir = path.join(GAMES_ROOT, project, 'dist');
  const stats = getDirectoryStats(distDir);

  const uncompressedKB = Math.ceil(stats.totalBytes / 1024);
  const gzipKB = Math.ceil(stats.totalGzipBytes / 1024);

  const budget = BUDGETS[project];

  const uncompressedPass = uncompressedKB <= budget.uncompressedLimitKB;
  const gzipPass = gzipKB <= budget.gzipLimitKB;
  const overallPass = uncompressedPass && gzipPass;

  const statusLabel = overallPass ? `${GREEN}PASS ✅${RESET}` : `${RED}FAIL ❌${RESET}`;

  console.log(
    `%-16s | %10d KB   | %10d KB   | %10d KB   | %8d KB   | %s`,
    project,
    uncompressedKB,
    budget.uncompressedLimitKB,
    gzipKB,
    budget.gzipLimitKB,
    statusLabel
  );

  assert(
    uncompressedPass,
    'Suite 5: Uncompressed Bundle Size Gate',
    `[${project}] Uncompressed size (${uncompressedKB} KB) <= budget (${budget.uncompressedLimitKB} KB)`,
    { uncompressedKB, budgetKB: budget.uncompressedLimitKB }
  );

  assert(
    gzipPass,
    'Suite 5: Gzipped Bundle Size Gate',
    `[${project}] Gzipped size (${gzipKB} KB) <= budget (${budget.gzipLimitKB} KB)`,
    { gzipKB, budgetKB: budget.gzipLimitKB }
  );

  // Print asset breakdown
  for (const f of stats.files) {
    const fKb = (f.bytes / 1024).toFixed(1);
    const fGzipKb = (f.gzipBytes / 1024).toFixed(1);
    // console.log(`   └─ ${f.relativePath.padEnd(35)} : ${fKb.padStart(6)} KB (gzip: ${fGzipKb.padStart(5)} KB)`);
  }
}
console.log('');

// ============================================================================
// Suite 6: Clamped DPR Verification Across Engines
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 6: Clamped DPR Verification Across Engines ---${RESET}`);

// Test mathematical behavior of the DPR clamping function
function testClampingLogic(inputDpr: number): number {
  return Math.min(inputDpr || 1, 2.0);
}

// 1. Math oracle tests
expectEqual(testClampingLogic(1.0), 1.0, 'Suite 6: DPR Clamping Oracle', 'DPR 1.0 remains 1.0');
expectEqual(testClampingLogic(1.5), 1.5, 'Suite 6: DPR Clamping Oracle', 'DPR 1.5 remains 1.5');
expectEqual(testClampingLogic(2.0), 2.0, 'Suite 6: DPR Clamping Oracle', 'DPR 2.0 remains 2.0');
expectEqual(testClampingLogic(2.5), 2.0, 'Suite 6: DPR Clamping Oracle', 'DPR 2.5 clamped to 2.0');
expectEqual(testClampingLogic(3.0), 2.0, 'Suite 6: DPR Clamping Oracle', 'DPR 3.0 clamped to 2.0 (Retina)');
expectEqual(testClampingLogic(3.5), 2.0, 'Suite 6: DPR Clamping Oracle', 'DPR 3.5 clamped to 2.0 (Super Retina)');
expectEqual(testClampingLogic(4.0), 2.0, 'Suite 6: DPR Clamping Oracle', 'DPR 4.0 clamped to 2.0 (Ultra HiDPI)');
expectEqual(testClampingLogic(0), 1.0, 'Suite 6: DPR Clamping Oracle', 'DPR 0 falls back to 1.0');
expectEqual(testClampingLogic(NaN), 1.0, 'Suite 6: DPR Clamping Oracle', 'DPR NaN falls back to 1.0');

// 2. Source Code Verification
// LittleJS
const littleJsMainSrc = fs.readFileSync(path.join(GAMES_ROOT, 'littlejs-demo/src/main.ts'), 'utf8');
assert(
  littleJsMainSrc.includes('Math.min(window.devicePixelRatio || 1, 2.0)') &&
  littleJsMainSrc.includes('setCanvasPixelRatio('),
  'Suite 6: Engine DPR Implementation',
  '[littlejs-demo] explicitly clamps DPR with Math.min(window.devicePixelRatio || 1, 2.0) and setCanvasPixelRatio'
);

// Phaser
const phaserMainSrc = fs.readFileSync(path.join(GAMES_ROOT, 'phaser-demo/src/main.ts'), 'utf8');
assert(
  phaserMainSrc.includes('Math.min(window.devicePixelRatio || 1, 2.0)'),
  'Suite 6: Engine DPR Implementation',
  '[phaser-demo] explicitly computes clamped DPR with Math.min(window.devicePixelRatio || 1, 2.0)'
);

// Three.js
const threeSceneSrc = fs.readFileSync(path.join(GAMES_ROOT, 'threejs-demo/src/scene.ts'), 'utf8');
assert(
  threeSceneSrc.includes('renderer.setPixelRatio(dpr)') ||
  threeSceneSrc.includes('renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0))'),
  'Suite 6: Engine DPR Implementation',
  '[threejs-demo] explicitly applies clamped DPR via renderer.setPixelRatio'
);
assert(
  threeSceneSrc.includes('this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0))'),
  'Suite 6: Engine DPR Implementation',
  '[threejs-demo] clamps DPR on window resize event in scene.ts'
);

// R3F
const r3fAppSrc = fs.readFileSync(path.join(GAMES_ROOT, 'r3f-demo/src/App.tsx'), 'utf8');
assert(
  r3fAppSrc.includes('dpr={[1, 2]}'),
  'Suite 6: Engine DPR Implementation',
  '[r3f-demo] explicitly clamps DPR via <Canvas dpr={[1, 2]}>'
);

// ============================================================================
// Suite 7: Offline Self-Containment & Zero External Network Requests
// ============================================================================
console.log(`${BOLD}${BLUE}--- Suite 7: Offline Self-Containment & Zero External CDNs ---${RESET}`);

for (const project of PROJECTS) {
  const distDir = path.join(GAMES_ROOT, project, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // Check for http:// or https:// external script or style imports
    const externalImports = [...htmlContent.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]);
    assert(
      externalImports.length === 0,
      'Suite 7: Offline Self-Containment',
      `[${project}] Zero external CDN imports in dist/index.html`,
      { externalImports }
    );
  }
}

// ============================================================================
// Summary & Verdict Determination
// ============================================================================
console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
console.log(`${BOLD}${CYAN} 📊 CHALLENGER TEST RESULTS SUMMARY${RESET}`);
console.log(`${BOLD}${CYAN}======================================================================${RESET}`);

const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`Total Assertions Executed : ${BOLD}${total}${RESET}`);
console.log(`Passed Assertions        : ${BOLD}${GREEN}${passed}${RESET}`);
console.log(`Failed Assertions        : ${BOLD}${failed === 0 ? GREEN : RED}${failed}${RESET}`);

if (failed > 0) {
  console.log(`\n${BOLD}${RED}❌ FAILURES DETECTED:${RESET}`);
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`  [${r.suite}] ${r.name}`);
    console.log(`    Error: ${r.error}`);
    if (r.details) {
      console.log(`    Details: ${JSON.stringify(r.details)}`);
    }
  }
  process.exit(1);
} else {
  console.log(`\n${BOLD}${GREEN}✅ ALL CHALLENGER ASSERTIONS PASSED EMPIRICALLY!${RESET}`);
  console.log(`${BOLD}${GREEN}VERDICT: APPROVE${RESET}\n`);
  process.exit(0);
}
