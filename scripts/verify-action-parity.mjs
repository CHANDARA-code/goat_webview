#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const KNOWN_GAPS = new Map([]);

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (["test", "Tests", "build", "androidTest", "node_modules"].includes(entry.name)) continue;
      walk(join(dir, entry.name), ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function collect(dir, ext, pattern) {
  const found = new Set();
  for (const file of walk(dir, ext)) {
    for (const m of readFileSync(file, "utf8").matchAll(pattern)) {
      for (const q of m[1].match(/"[A-Z0-9_]+"/g) ?? []) found.add(q.slice(1, -1));
    }
  }
  return found;
}

const KOTLIN_WHEN_BRANCH = /^[ \t]*((?:"[A-Z][A-Z0-9_]{3,}"[ \t]*,[ \t]*)*"[A-Z][A-Z0-9_]{3,}")[ \t]*->/gm;
const SWIFT_SWITCH_CASE = /^[ \t]*case[ \t]+((?:"[A-Z][A-Z0-9_]{3,}"[ \t]*,[ \t]*)*"[A-Z][A-Z0-9_]{3,}")[ \t]*:/gm;

const android = collect(join(ROOT, "android"), ".kt", KOTLIN_WHEN_BRANCH);
const ios = collect(join(ROOT, "ios/Sources"), ".swift", SWIFT_SWITCH_CASE);

const mockActions = new Set();
const mockHandlers = join(ROOT, "packages/bridge-mock/src/handlers/index.ts");
if (existsSync(mockHandlers)) {
  const src = readFileSync(mockHandlers, "utf8");
  const start = src.indexOf("export const SUPPORTED_ACTIONS: Set<string> = new Set([");
  if (start !== -1) {
    const body = src.slice(start, src.indexOf("])", start));
    for (const m of body.matchAll(/['"]([A-Z][A-Z0-9_]{3,})['"]/g)) mockActions.add(m[1]);
  }
}

const declared = new Set();
const domainsDir = join(ROOT, "docs-site/src/data/domains");
for (const file of walk(domainsDir, ".ts")) {
  for (const m of readFileSync(file, "utf8").matchAll(/^\s*action:\s*['"]([A-Z0-9_]+)['"]/gm)) {
    declared.add(m[1]);
  }
}

if (declared.size === 0) throw new Error(`No declared actions parsed from ${domainsDir}`);
for (const [name, set] of [["Android", android], ["iOS", ios]]) {
  if (set.size < 150) throw new Error(`Only ${set.size} dispatched ${name} actions parsed — parser is broken`);
}

const androidOnly = [];
const iosOnly = [];
const nowhere = [];
for (const action of [...declared].sort()) {
  const a = android.has(action);
  const i = ios.has(action);
  if (a && i) continue;
  if (a) androidOnly.push(action);
  else if (i) iosOnly.push(action);
  else nowhere.push(action);
}

const undeclared = [...android].filter((a) => ios.has(a) && !declared.has(a)).sort();

console.log("Goat WebView — bridge action parity");
console.log("=".repeat(60));
console.log(`declared in api-matrix : ${declared.size}`);
console.log(`dispatched on Android  : ${android.size}`);
console.log(`dispatched on iOS      : ${ios.size}`);
console.log(`declared AND on both   : ${declared.size - androidOnly.length - iosOnly.length - nowhere.length}`);
console.log(`mocked in @goat/bridge-mock: ${mockActions.size}`);
console.log("");

let failures = 0;
for (const [label, list] of [
  ["declared but dispatches on ANDROID ONLY", androidOnly],
  ["declared but dispatches on iOS ONLY", iosOnly],
  ["declared but dispatches NOWHERE", nowhere],
]) {
  const unexpected = list.filter((a) => !KNOWN_GAPS.has(a));
  const known = list.filter((a) => KNOWN_GAPS.has(a));
  for (const a of known) console.log(`  known gap  ${a} — ${KNOWN_GAPS.get(a)}`);
  if (unexpected.length) {
    failures += unexpected.length;
    console.log(`\n✗ ${unexpected.length} ${label}:`);
    for (const a of unexpected) console.log(`    ${a}`);
  }
}

if (undeclared.length) {
  console.log(`\n! ${undeclared.length} action(s) dispatch on both platforms but are not in the api-matrix:`);
  for (const a of undeclared) console.log(`    ${a}`);
  console.log("  (not fatal — the matrix is the documented surface, not every internal action)");
}

if (mockActions.size > 0) {
  const dispatchesOnBoth = [...declared].filter((a) => android.has(a) && ios.has(a));
  const notMocked = dispatchesOnBoth.filter((a) => !mockActions.has(a)).sort();
  const mockedButDead = [...mockActions].filter((a) => !android.has(a) && !ios.has(a)).sort();
  if (notMocked.length) {
    failures += notMocked.length;
    console.log(`\n✗ ${notMocked.length} action(s) dispatch on both platforms but @goat/bridge-mock does not mock them:`);
    for (const a of notMocked) console.log(`    ${a}`);
    console.log("  A mini-app testing against the mock would pass in dev and fail on device.");
  }
  if (mockedButDead.length) {
    failures += mockedButDead.length;
    console.log(`\n✗ ${mockedButDead.length} action(s) are mocked but dispatch on neither platform:`);
    for (const a of mockedButDead) console.log(`    ${a}`);
    console.log("  The mock would make these look implemented.");
  }
}

for (const stale of [...KNOWN_GAPS.keys()].filter((a) => android.has(a) && ios.has(a))) {
  failures++;
  console.log(`\n✗ ${stale} is listed as a known gap but now dispatches on both platforms — remove it from KNOWN_GAPS.`);
}

console.log("");
if (failures) {
  console.log(`FAILED — ${failures} parity problem(s).`);
  process.exit(1);
}
console.log(`PASSED — every declared action dispatches on both platforms (${KNOWN_GAPS.size} documented gap(s)).`);
