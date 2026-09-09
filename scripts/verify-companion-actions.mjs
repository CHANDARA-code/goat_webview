#!/usr/bin/env node
/**
 * Every action a companion package declares — Flutter (packages/flutter) or React Native
 * (packages/react-native) — must either resolve to an action the engine actually dispatches, or be
 * declared unbacked with a reason. RN companions must also actually CALL the engine.
 *
 * Why this exists: on 2026-09-06, 30 of the 43 actions declared across packages/flutter/* matched
 * no Kotlin `when` branch and no Swift `case` on either platform — names like CHOOSE_IMAGE,
 * PLAY_VOICE and CREATE_BLE_CONNECTION that the engine has never had. A Flutter host calling them
 * got an opaque native failure. Nothing caught it because the packages were only ever checked for
 * compiling, and a Dart string that names a non-existent action compiles fine.
 *
 * The RN half was worse than a wrong name: all seven packages under packages/react-native returned
 * hardcoded data and never called the bridge at all, with a `default:` branch answering
 * `{ success: true }` for ANY action. `BIOMETRIC_AUTH` returned `{ authenticated: true }`
 * unconditionally (an auth bypass) and `REQUEST_PAYMENT` reported success while the native L1-L5
 * gate was never reached. So this gate also asserts each RN companion calls `executeAction` and
 * contains no fabricated-success fallback.
 *
 * Same lesson as scripts/verify-action-parity.mjs: string presence is not backing. This matches on
 * dispatch position (`"X" ->` / `case "X":`), never a bare quoted string.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "build" || entry === "node_modules" || entry === ".dart_tool") continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const KOTLIN_WHEN = /^[ \t]*((?:"[A-Z][A-Z0-9_]{3,}"[ \t]*,[ \t]*)*"[A-Z][A-Z0-9_]{3,}")[ \t]*->/gm;
const SWIFT_CASE = /^[ \t]*case[ \t]+((?:"[A-Z][A-Z0-9_]{3,}"[ \t]*,[ \t]*)*"[A-Z][A-Z0-9_]{3,}")[ \t]*:/gm;

function dispatched(dir, ext, re) {
  const set = new Set();
  for (const f of walk(join(ROOT, dir), ext)) {
    const text = readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(text))) {
      for (const q of m[1].match(/"[A-Z0-9_]+"/g) || []) set.add(q.slice(1, -1));
    }
    re.lastIndex = 0;
  }
  return set;
}

const android = dispatched("android", ".kt", KOTLIN_WHEN);
const ios = dispatched("ios/Sources", ".swift", SWIFT_CASE);

// Refuse to pass vacuously if the parsers stopped finding anything.
if (android.size < 150 || ios.size < 150) {
  console.error(
    `✗ Parsed too few dispatched actions (android=${android.size}, ios=${ios.size}). ` +
      `The source layout probably moved — fix this script rather than trusting a pass.`,
  );
  process.exit(1);
}

const setFrom = (text, re, keyRe) => {
  const m = text.match(re);
  const out = new Set();
  if (m) for (const kv of m[1].matchAll(keyRe)) out.add(kv[1]);
  return out;
};

let declared = 0;
let aliased = 0;
let unbackedCount = 0;
const problems = [];

const sources = [
  ...walk(join(ROOT, "packages/flutter"), ".dart").map((f) => ({ f, kind: "flutter" })),
  ...walk(join(ROOT, "packages/react-native"), ".ts").map((f) => ({ f, kind: "rn" })),
];

for (const { f: file, kind } of sources) {
  const text = readFileSync(file, "utf8");
  const actionsMatch =
    kind === "flutter"
      ? text.match(/supportedActions\s*=>\s*\{([^}]*)\}/s)
      : text.match(/supportedActions:\s*\[([^\]]*)\]/s);
  if (!actionsMatch) continue;
  const pkg =
    kind === "flutter"
      ? file.split("/packages/flutter/")[1].split("/")[0]
      : "rn:" + file.split("/packages/react-native/")[1].split("/")[0];

  if (kind === "rn") {
    // Comment-stripped: an earlier version of this check matched `executeAction` inside the file's
    // own doc comment, so deleting the real call still passed — the exact string-presence-is-not-
    // backing trap this gate exists to catch.
    const code = text
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    if (!/\bexecuteAction\s*\(/.test(code)) {
      problems.push(`${pkg}: declares actions but never calls GoatWebViewNativeModule.executeAction — it cannot be reaching the engine.`);
    }
    const fabricated = code
      .split("\n")
      .some((l) => /default:\s*$/.test(l) || /return\s*\{\s*success:\s*true/.test(l));
    if (fabricated) {
      problems.push(`${pkg}: contains a fabricated-success fallback (a 'default:' branch or 'return { success: true }'). Companions must not synthesise results.`);
    }
  }

  const alias = new Map();
  const aliasBlock =
    kind === "flutter"
      ? text.match(/_engineAction = <String, String>\{([^}]*)\}/s)
      : text.match(/ENGINE_ACTION: Record<string, string> = \{([^}]*)\}/s);
  if (aliasBlock) {
    for (const kv of aliasBlock[1].matchAll(/'([A-Z0-9_]+)':\s*'([A-Z0-9_]+)'/g)) alias.set(kv[1], kv[2]);
  }
  const unbacked =
    kind === "flutter"
      ? setFrom(text, /_unbacked = <String, String>\{([^}]*)\}/s, /'([A-Z0-9_]+)':/g)
      : setFrom(text, /UNBACKED: Record<string, string> = \{([^}]*)\}/s, /'([A-Z0-9_]+)':/g);

  for (const raw of (actionsMatch[1].match(/'[A-Z0-9_]+'/g) || []).map((s) => s.slice(1, -1))) {
    declared++;
    if (unbacked.has(raw)) {
      unbackedCount++;
      // An "unbacked" action that the engine DOES dispatch is a stale declaration.
      const eff = alias.get(raw) ?? raw;
      if (android.has(eff) || ios.has(eff)) {
        problems.push(`${pkg}: '${raw}' is declared unbacked but '${eff}' now dispatches — remove it from _unbacked.`);
      }
      continue;
    }
    const eff = alias.get(raw) ?? raw;
    if (alias.has(raw)) aliased++;
    if (!android.has(eff) && !ios.has(eff)) {
      problems.push(
        `${pkg}: '${raw}'${alias.has(raw) ? ` -> '${eff}'` : ""} dispatches on NEITHER platform. ` +
          `Map it to a real action or declare it in _unbacked with a reason.`,
      );
    }
  }
}

// --- Web SDK: every action passed to callNative() must dispatch somewhere ---
// miniapp-web keeps an in-memory fallback that answers actions the engine may not have, so a
// wrong action name works in dev and fails on device. That is how fsDeleteFile shipped sending
// FS_DELETE_FILE (dispatched by neither platform) instead of FS_UNLINK.
let webActions = 0;
for (const file of walk(join(ROOT, "miniapp-web/src"), ".ts").concat(
  walk(join(ROOT, "miniapp-web/src"), ".tsx"),
)) {
  if (file.includes("__tests__")) continue;
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/callNative(?:<[^>]*>)?\(\s*'([A-Z][A-Z0-9_]+)'/g)) {
    webActions++;
    const name = m[1];
    if (!android.has(name) && !ios.has(name)) {
      problems.push(
        `miniapp-web: callNative('${name}') dispatches on NEITHER platform — it will fail on device ` +
          `even if the in-memory fallback answers it in dev.`,
      );
    }
  }
}

console.log("Goat WebView — binding-layer action backing (Flutter + React Native + Web)");
console.log(`miniapp-web callNative  : ${webActions}`);
console.log(`declared by companions : ${declared}`);
console.log(`aliased to real actions: ${aliased}`);
console.log(`declared unbacked      : ${unbackedCount}`);

if (problems.length) {
  console.log(`\n✗ ${problems.length} problem(s):`);
  for (const p of problems) console.log(`   ${p}`);
  process.exit(1);
}
console.log("\nPASSED — every companion action resolves to a dispatched engine action or is declared unbacked.");
