/**
 * `goat doctor` — Automated dev environment health check.
 * Inspects Node.js, Bun, Android SDK (ANDROID_HOME, adb), Xcode (xcrun, simctl), Java.
 */

import { parseArgs } from "node:util";
import { execSync } from "node:child_process";

export interface DoctorOptions {
  verbose: boolean;
  fix: boolean;
}

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
  fixHint?: string;
}

function run(cmd: string): string | null {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function checkNode(): CheckResult {
  const version = run("node --version");
  if (!version)
    return {
      name: "Node.js",
      ok: false,
      message: "Not found",
      fixHint: "Install Node.js ≥ 20 from https://nodejs.org",
    };
  const major = parseInt(version.replace("v", "").split(".")[0], 10);
  return {
    name: "Node.js",
    ok: major >= 20,
    message: `${version} ${major >= 20 ? "(≥ 20 ✅)" : "(< 20 — upgrade required)"}`,
    fixHint: major < 20 ? "Upgrade to Node.js ≥ 20" : undefined,
  };
}

function checkBun(): CheckResult {
  const version = run("bun --version");
  if (!version)
    return {
      name: "Bun",
      ok: false,
      message: "Not found (optional)",
      fixHint: "Install from https://bun.sh",
    };
  return { name: "Bun", ok: true, message: `v${version} ✅` };
}

function checkJava(): CheckResult {
  const out = run("java -version 2>&1") ?? run("java --version");
  if (!out)
    return {
      name: "Java",
      ok: false,
      message: "Not found",
      fixHint: "Install JDK 17+ from https://adoptium.net",
    };
  const match = out.match(/(\d+)/);
  const major = match ? parseInt(match[1], 10) : 0;
  return {
    name: "Java",
    ok: major >= 17,
    message: `${out.split("\n")[0]} ${major >= 17 ? "(≥ 17 ✅)" : "(< 17 — upgrade required)"}`,
    fixHint:
      major < 17 ? "Install JDK 17+ from https://adoptium.net" : undefined,
  };
}

function checkAndroidHome(): CheckResult {
  const home = process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
  if (!home)
    return {
      name: "ANDROID_HOME",
      ok: false,
      message: "Not set",
      fixHint:
        "Set ANDROID_HOME to your Android SDK path in ~/.zshrc or ~/.bashrc",
    };
  return { name: "ANDROID_HOME", ok: true, message: `${home} ✅` };
}

function checkAdb(): CheckResult {
  const version = run("adb version");
  if (!version)
    return {
      name: "ADB",
      ok: false,
      message: "Not found",
      fixHint: "Install Android Platform Tools and add to PATH",
    };
  const line = version.split("\n")[0];
  const devices =
    run("adb devices")
      ?.split("\n")
      .slice(1)
      .filter((l) => l.includes("\tdevice")) ?? [];
  return {
    name: "ADB",
    ok: true,
    message: `${line} — ${devices.length} device(s) connected ✅`,
  };
}

function checkXcode(): CheckResult {
  const version = run("xcodebuild -version");
  if (!version)
    return {
      name: "Xcode",
      ok: false,
      message: "Not found (macOS only)",
      fixHint: "Install Xcode from the App Store",
    };
  return { name: "Xcode", ok: true, message: `${version.split("\n")[0]} ✅` };
}

function checkSimctl(): CheckResult {
  const out = run("xcrun simctl list devices booted");
  if (out === null)
    return {
      name: "Simulators",
      ok: false,
      message: "xcrun not available",
      fixHint: "Install Xcode Command Line Tools: xcode-select --install",
    };
  const booted = (out.match(/Booted/g) ?? []).length;
  return {
    name: "Simulators",
    ok: true,
    message: `${booted} simulator(s) booted ✅`,
  };
}

function parseDoctorArgs(args: string[]): DoctorOptions {
  const { values } = parseArgs({
    args,
    options: {
      verbose: { type: "boolean", default: false },
      fix: { type: "boolean", default: false },
    },
    strict: false,
  });
  return { verbose: values.verbose as boolean, fix: values.fix as boolean };
}

export async function doctorCommand(args: string[]): Promise<void> {
  const opts = parseDoctorArgs(args);
  console.log("\n🐐 Goat Doctor — Environment Health Check\n");

  const checks: CheckResult[] = [
    checkNode(),
    checkBun(),
    checkJava(),
    checkAndroidHome(),
    checkAdb(),
    ...(process.platform === "darwin" ? [checkXcode(), checkSimctl()] : []),
  ];

  let failures = 0;
  for (const c of checks) {
    const icon = c.ok ? "✅" : "❌";
    console.log(`  ${icon} ${c.name.padEnd(16)} ${c.message}`);
    if (!c.ok) {
      failures++;
      if (c.fixHint && opts.verbose) {
        console.log(`     💡 ${c.fixHint}`);
      }
    }
  }

  console.log("");
  if (failures === 0) {
    console.log(
      "✅ All checks passed! Your environment is ready for Goat development.\n",
    );
  } else {
    console.log(
      `⚠️  ${failures} issue(s) found. Run with --verbose for fix hints.\n`,
    );
    if (!opts.verbose) console.log("Tip: goat doctor --verbose --fix\n");
    process.exitCode = 1;
  }
}
