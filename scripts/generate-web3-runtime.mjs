#!/usr/bin/env node
/**
 * Builds miniapp-web/src/injected/* into one IIFE and embeds it verbatim in the Android and iOS
 * document-start bootstraps.
 *
 * Why generate instead of hand-writing the string twice: this repo has a documented defect pattern
 * where the same logic maintained in parallel across languages silently diverged (see
 * `duplicate-line-defect-pattern`). One TypeScript source, two generated constants, and
 * `scripts/verify-web3-runtime-sync.mjs` to fail the build the moment they disagree.
 *
 * Usage: node scripts/generate-web3-runtime.mjs [--check]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECK_ONLY = process.argv.includes("--check");

const BUNDLE = join(ROOT, "miniapp-web/dist/goat-web3-runtime.min.js");
const KOTLIN_OUT = join(
  ROOT,
  "android/core/src/main/java/com/goat/webview/web3/GoatWeb3Bootstrap.kt"
);
const SWIFT_OUT = join(ROOT, "ios/Sources/GoatWebView/Web3/GoatWeb3Bootstrap.swift");

function buildBundle() {
  const esbuild = [
    join(ROOT, "miniapp-web/node_modules/.bin/esbuild"),
    join(ROOT, "node_modules/.bin/esbuild")
  ].find(existsSync);
  if (!esbuild) {
    throw new Error("esbuild not found — run `npm install` first.");
  }
  mkdirSync(dirname(BUNDLE), { recursive: true });
  execFileSync(
    esbuild,
    [
      join(ROOT, "miniapp-web/src/injected/index.ts"),
      "--minify",
      "--bundle",
      "--format=iife",
      "--target=es2019",
      `--outfile=${BUNDLE}`,
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
  );
  return readFileSync(BUNDLE, "utf8").trim();
}

/**
 * Kotlin escaped string literal. JSON escaping covers quotes, backslashes and control characters;
 * `$` additionally has to be escaped because Kotlin would read `${...}` in the minified JS as a
 * string template.
 */
function kotlinLiteral(source) {
  return JSON.stringify(source).replace(/\$/g, "\\$");
}

/**
 * Swift escaped string literal. JSON escaping already turns a backslash into `\\`, so the JS
 * sequence `\(` cannot be read as Swift interpolation.
 */
function swiftLiteral(source) {
  return JSON.stringify(source);
}

function renderKotlin(source, hash) {
  return `package com.goat.webview.web3

/**
 * Document-start Web3 provider runtime (EIP-6963 / Solana Wallet Standard / TonConnect v2).
 *
 * GENERATED FILE — do not edit. Source of truth is \`miniapp-web/src/injected/\`; regenerate with
 * \`node scripts/generate-web3-runtime.mjs\`. \`scripts/verify-web3-runtime-sync.mjs\` fails the
 * build if this drifts from the TypeScript source.
 *
 * bundle sha256: ${hash}
 */
object GoatWeb3Bootstrap {

    const val SOURCE_SHA256: String = "${hash}"

    private const val RUNTIME: String = ${kotlinLiteral(source)}

    /**
     * Returns the script to evaluate at document-start. Injecting it is opt-in
     * (\`GoatView.web3ProvidersEnabled\`) so a host with no wallet features ships no provider
     * surface into its mini-apps.
     */
    fun buildScript(): String = RUNTIME
}
`;
}

function renderSwift(source, hash) {
  return `import Foundation

/**
 * Document-start Web3 provider runtime (EIP-6963 / Solana Wallet Standard / TonConnect v2).
 *
 * GENERATED FILE — do not edit. Source of truth is \`miniapp-web/src/injected/\`; regenerate with
 * \`node scripts/generate-web3-runtime.mjs\`. \`scripts/verify-web3-runtime-sync.mjs\` fails the
 * build if this drifts from the TypeScript source.
 *
 * bundle sha256: ${hash}
 */
public enum GoatWeb3Bootstrap {

    public static let sourceSha256 = "${hash}"

    private static let runtime: String = ${swiftLiteral(source)}

    /// Returns the script to evaluate at document-start. Injecting it is opt-in
    /// (\`GoatView.web3ProvidersEnabled\`) so a host with no wallet features ships no provider
    /// surface into its mini-apps.
    public static func buildScript() -> String { runtime }
}
`;
}

const source = buildBundle();
const hash = createHash("sha256").update(source).digest("hex");
const kotlin = renderKotlin(source, hash);
const swift = renderSwift(source, hash);

const targets = [
  ["Kotlin", KOTLIN_OUT, kotlin],
  ["Swift", SWIFT_OUT, swift],
];

let stale = 0;
for (const [label, path, contents] of targets) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === contents) {
    console.log(`  up to date  ${label.padEnd(6)} ${path.replace(ROOT + "/", "")}`);
    continue;
  }
  if (CHECK_ONLY) {
    stale++;
    console.log(`✗ STALE      ${label.padEnd(6)} ${path.replace(ROOT + "/", "")}`);
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  console.log(`  wrote       ${label.padEnd(6)} ${path.replace(ROOT + "/", "")}`);
}

console.log(`\nbundle: ${(source.length / 1024).toFixed(1)} KB  sha256 ${hash.slice(0, 16)}…`);

if (CHECK_ONLY && stale) {
  console.log(
    `\nFAILED — ${stale} generated file(s) do not match miniapp-web/src/injected/.\n` +
      `Run: node scripts/generate-web3-runtime.mjs`
  );
  process.exit(1);
}
