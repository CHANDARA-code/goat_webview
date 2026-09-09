#!/usr/bin/env node
/**
 * Fails if a package that HAS a test suite is not run by any gate.
 *
 * Why this exists: twice in one week a suite existed, looked maintained, and was executed by
 * nothing.
 *   - `miniapp-web` — 82 tests. Not in verify-all.sh at all; CI installed its dependencies but
 *     never ran `npm test`. Two stale-duplicate syntax errors had been sitting in it long enough
 *     that the suite could not even build, and nobody saw it.
 *   - `packages/adapter-dsl` — 67 tests, the core of the DSL compatibility work and the suite that
 *     parses the real Kotlin/Swift sources to prove every DSL method maps to an action both
 *     platforms dispatch. Absent from verify-packages.sh's list of 10.
 *
 * Writing a test is not the same as running it. This checks the second thing.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SKIP_DIRS = new Set([
  "node_modules",
  "build",
  ".dart_tool",
  "dist",
  "dist-test",
  ".git",
  "learn_use_case",
  ".derivedData",
  ".gradle",
  "Pods",
  "coverage",
  ".swiftpm",
  ".antigravity",
  "example",
]);

/**
 * Deliberately not gated. Each entry needs a reason — an empty reason is not accepted, so
 * silencing this check costs at least as much thought as fixing it.
 */
const ALLOWED = new Map([
  [
    "docs-site",
    "Docusaurus site: built and deployed by deploy-docs.yml; its 'test' script is the Docusaurus scaffold default, not a real suite.",
  ],
  [
    "bench/goat_vs_fiw/app_fiw",
    "Benchmark fixture app (the flutter_inappwebview comparison arm). Its test/ holds only the default Flutter scaffold widget_test.dart; the app exists to be measured, not unit tested.",
  ],
  [
    "tools/goat_compat_lint",
    "custom_lint plugin. Has no standalone suite -- test/ holds only fixtures -- but the rule IS executed against real code by verify-flutter.sh ('dart run custom_lint' in goat_webview_compat). Note the asymmetry: the RN twin (no-retained-compat-config) has 9 RuleTester cases; this one has none, so the rule's own logic is unverified.",
  ],
  [
    "tests/games",
    "2D/3D game demos and performance test harness; verified by running tests/games/run-all.sh verify.",
  ],
  [
    "tests/games/phaser-demo",
    "Workspace package under tests/games; tested through tests/games/run-all.sh verify and verify-phaser.mjs.",
  ],
]);

function walk(dir, depth, out = []) {
  if (depth < 0 || !existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(p);
      walk(p, depth - 1, out);
    }
  }
  return out;
}

// Everything a gate could plausibly live in.
//
// SELF-EXCLUDED. This file starts with "verify-" and its own comments name the packages it has
// caught, so including it made every one of them look referenced — the gate read itself as
// evidence and passed. Found by the teeth check, not by reading the code.
const SELF = "verify-suites-are-gated.mjs";
const gateText = [
  ...readdirSync(join(ROOT, "scripts"))
    .filter((f) => f.startsWith("verify-") && f !== SELF)
    .map((f) => join(ROOT, "scripts", f)),
  ...(existsSync(join(ROOT, ".github/workflows"))
    ? readdirSync(join(ROOT, ".github/workflows")).map((f) =>
        join(ROOT, ".github/workflows", f),
      )
    : []),
]
  .map((f) => {
    try {
      return readFileSync(f, "utf8");
    } catch {
      return "";
    }
  })
  .join("\n");

/**
 * A plain `includes()` is not enough: "packages/adapter-dsl" is a substring of
 * "packages/adapter-dsl-DISABLED", so renaming a gate entry to disable it would still look
 * referenced. The path has to be followed by something that cannot continue a path segment.
 * (Third time loose substring matching produced a false pass in this repo's tooling — match
 * position and boundaries, never bare containment.)
 */
function isReferenced(rel) {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?![A-Za-z0-9_\\-])`).test(gateText);
}

const candidates = [ROOT, ...walk(ROOT, 3)];
const ungated = [];
let checked = 0;

for (const dir of candidates) {
  const rel = relative(ROOT, dir) || ".";
  let hasSuite = false;

  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const test =
        JSON.parse(readFileSync(pkgPath, "utf8"))?.scripts?.test ?? "";
      if (test && !test.includes("no test specified")) hasSuite = true;
    } catch {
      /* unparseable package.json is not this gate's problem */
    }
  }
  // Dart/Flutter packages
  if (
    !hasSuite &&
    existsSync(join(dir, "pubspec.yaml")) &&
    existsSync(join(dir, "test"))
  )
    hasSuite = true;

  if (!hasSuite || rel === ".") continue;
  checked++;
  if (ALLOWED.has(rel)) continue;
  if (!isReferenced(rel)) ungated.push(rel);
}

console.log("Goat WebView — every test suite is run by some gate");
console.log(`suites found   : ${checked}`);
console.log(`allowlisted    : ${[...ALLOWED.keys()].length}`);

if (ungated.length) {
  console.log(
    `\n✗ ${ungated.length} suite(s) exist but no verify-*.sh or workflow runs them:`,
  );
  for (const u of ungated) console.log(`   ${u}`);
  console.log(
    "\nAdd them to the right scripts/verify-*.sh, or to ALLOWED in this file with a reason.",
  );
  process.exit(1);
}
console.log("\nPASSED — no suite is left unrun.");
