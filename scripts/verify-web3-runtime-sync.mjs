#!/usr/bin/env node
/**
 * The injected Web3 provider runtime is authored once in TypeScript
 * (`miniapp-web/src/injected/`) and embedded into two generated native constants. This gate fails
 * if either embedded copy no longer matches a fresh build of that source.
 *
 * Why: this repo has a documented defect pattern where logic maintained in parallel across
 * languages silently diverged (8 files / 6 languages, one of which broke a whole test suite
 * without anything noticing). A generated file that nobody re-generates is the same trap, so the
 * check runs in CI rather than relying on discipline.
 *
 * It also asserts the runtime is actually injected somewhere on each platform — a generated
 * constant with no call site is the "built but not wired" failure this repo keeps hitting.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let failures = 0;

console.log("Goat WebView — injected Web3 runtime sync");
console.log("=".repeat(60));

try {
  execFileSync("node", [join(ROOT, "scripts/generate-web3-runtime.mjs"), "--check"], {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch {
  failures++;
}

const CALL_SITES = [
  ["Android", "android/core/src/main/java/com/goat/webview/view/GoatView.kt", "GoatWeb3Bootstrap.buildScript()"],
  ["iOS", "ios/Sources/GoatWebView/GoatView.swift", "GoatWeb3Bootstrap.buildScript()"],
];

console.log("");
for (const [platform, relPath, needle] of CALL_SITES) {
  const path = join(ROOT, relPath);
  const found = existsSync(path) && readFileSync(path, "utf8").includes(needle);
  if (found) {
    console.log(`  wired       ${platform.padEnd(8)} ${relPath}`);
  } else {
    failures++;
    console.log(`✗ NOT WIRED  ${platform.padEnd(8)} ${relPath} never calls ${needle}`);
  }
}

const REQUIRED_GLOBALS = ["eip6963:announceProvider", "tonconnect", "navigator"];
const bundlePath = join(ROOT, "miniapp-web/dist/goat-web3-runtime.min.js");
if (existsSync(bundlePath)) {
  const bundle = readFileSync(bundlePath, "utf8");
  console.log("");
  for (const token of REQUIRED_GLOBALS) {
    if (bundle.includes(token)) {
      console.log(`  present     ${token}`);
    } else {
      failures++;
      console.log(`✗ MISSING    ${token} is absent from the built runtime`);
    }
  }
}

console.log("");
if (failures) {
  console.log(`FAILED — ${failures} problem(s).`);
  process.exit(1);
}
console.log("PASSED — generated native runtimes match miniapp-web/src/injected/ and are wired on both platforms.");
