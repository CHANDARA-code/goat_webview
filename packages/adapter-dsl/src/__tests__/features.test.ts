import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { storageFeature } from "../features/storage";
import { sensorsFeature } from "../features/sensors";
import { scannerFeature } from "../features/scanner";
import { locationFeature } from "../features/location";
import { bluetoothFeature } from "../features/bluetooth";
import { mediaFeature } from "../features/media";
import { paymentsFeature } from "../features/payments";
import { biometricsFeature } from "../features/biometrics";
import { navigationFeature } from "../features/navigation";
import { binaryFeature } from "../features/binary";
import { DSL_ACTION_MAP } from "../actionMap";
import type { Platform } from "../features/types";

const FEATURES = [
  storageFeature,
  sensorsFeature,
  scannerFeature,
  locationFeature,
  bluetoothFeature,
  mediaFeature,
  paymentsFeature,
  biometricsFeature,
  navigationFeature,
  binaryFeature,
];

function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(
        join(dir, "android/core/src/main/java/com/goat/webview/GoatBridgeActionHandler.kt"),
      )
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Could not locate the repo root from " + import.meta.url);
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test" || entry.name === "Tests" || entry.name === "build") continue;
      walk(full, ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Only actions in DISPATCH position count as backed. Mere string presence is not enough: five
 * bluetooth actions appear in Android's permission table while no branch anywhere handles them,
 * so a mini-app calling them gets a silent no-op on both platforms.
 */
function dispatchedActionsIn(dir: string, ext: string, caseHead: RegExp): Set<string> {
  const found = new Set<string>();
  for (const file of walk(dir, ext)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(caseHead)) {
      for (const q of m[1]!.match(/"[A-Z0-9_]+"/g) ?? []) found.add(q.slice(1, -1));
    }
  }
  return found;
}

const KOTLIN_WHEN_BRANCH = /^[ \t]*((?:"[A-Z][A-Z0-9_]{3,}"[ \t]*,[ \t]*)*"[A-Z][A-Z0-9_]{3,}")[ \t]*->/gm;
const SWIFT_SWITCH_CASE = /^[ \t]*case[ \t]+((?:"[A-Z][A-Z0-9_]{3,}"[ \t]*,[ \t]*)*"[A-Z][A-Z0-9_]{3,}")[ \t]*:/gm;

const ROOT = findRepoRoot();
const ENGINE: Record<Platform, Set<string>> = {
  android: dispatchedActionsIn(join(ROOT, "android"), ".kt", KOTLIN_WHEN_BRANCH),
  ios: dispatchedActionsIn(join(ROOT, "ios/Sources"), ".swift", SWIFT_SWITCH_CASE),
};
const PLATFORMS: Platform[] = ["android", "ios"];

describe("T4-T13 — feature modules map to real engine actions", () => {
  test("both engine sources parsed sanely", () => {
    for (const platform of PLATFORMS) {
      assert.ok(
        ENGINE[platform].size > 150,
        `expected >150 dispatched ${platform} actions, got ${ENGINE[platform].size}`,
      );
      assert.ok(ENGINE[platform].has("STORAGE_SET"), `${platform} is missing STORAGE_SET`);
    }
  });

  for (const feature of FEATURES) {
    test(`${feature.name}: every portable mapped action exists on BOTH platforms`, () => {
      for (const [method, action] of Object.entries(feature.actions)) {
        if (method in feature.platformOnly) continue;
        for (const platform of PLATFORMS) {
          assert.ok(
            ENGINE[platform].has(action),
            `${feature.name}.${method} maps to "${action}", absent on ${platform} — ` +
              `either map to a name both platforms dispatch, or declare it platformOnly`,
          );
        }
      }
    });

    test(`${feature.name}: platform-scoped methods really are scoped to that platform`, () => {
      for (const [method, platform] of Object.entries(feature.platformOnly)) {
        const action = feature.actions[method];
        assert.ok(action, `${feature.name}.${method} is platformOnly but maps to nothing`);
        assert.ok(
          ENGINE[platform].has(action),
          `${feature.name}.${method} is declared ${platform}-only but "${action}" is absent there`,
        );
        const other: Platform = platform === "android" ? "ios" : "android";
        assert.ok(
          !ENGINE[other].has(action),
          `${feature.name}.${method} is declared ${platform}-only but "${action}" now exists on ` +
            `${other} too — promote it to a portable mapping`,
        );
      }
    });

    test(`${feature.name}: declared-unbacked methods really are absent from both engines`, () => {
      for (const [method, action] of Object.entries(feature.unbacked)) {
        for (const platform of PLATFORMS) {
          assert.ok(
            !ENGINE[platform].has(action),
            `${feature.name}.${method} is declared unbacked but "${action}" DOES exist on ${platform} — map it`,
          );
        }
      }
    });

    test(`${feature.name}: is frozen so a consumer cannot mutate the table`, () => {
      assert.throws(() => {
        (feature.actions as Record<string, string>)["injected"] = "EVIL";
      });
    });
  }

  test("sensors maps the compass start/stop pair, neither of them unbacked", () => {
    assert.equal(sensorsFeature.actions["startCompass"], "START_COMPASS");
    assert.equal(sensorsFeature.actions["stopCompass"], "STOP_COMPASS");
    assert.equal(sensorsFeature.unbacked["stopCompass"], undefined);
  });

  test("media declares CREATE_INNER_AUDIO_CONTEXT and GET_BACKGROUND_AUDIO_MANAGER unbacked", () => {
    assert.equal(mediaFeature.actions["playAudio"], "AUDIO_PLAY");
    assert.equal(
      mediaFeature.unbacked["createInnerAudioContext"],
      "CREATE_INNER_AUDIO_CONTEXT",
    );
    assert.equal(
      mediaFeature.unbacked["getBackgroundAudioManager"],
      "GET_BACKGROUND_AUDIO_MANAGER",
    );
  });

  test("payments declares VERIFY_RECEIPT unbacked", () => {
    assert.equal(paymentsFeature.actions["requestPayment"], "REQUEST_PAYMENT");
    assert.equal(paymentsFeature.unbacked["verifyReceipt"], "VERIFY_RECEIPT");
  });

  test("biometrics declares PREPARE_SOTER_KEY and VERIFY_SOTER_SIGNATURE unbacked", () => {
    assert.equal(
      biometricsFeature.actions["startSoterAuthentication"],
      "BIOMETRIC_AUTH",
    );
    assert.equal(
      biometricsFeature.unbacked["prepareSoterKey"],
      "PREPARE_SOTER_KEY",
    );
    assert.equal(
      biometricsFeature.unbacked["verifySoterSignature"],
      "VERIFY_SOTER_SIGNATURE",
    );
  });

  test("navigation declares PRELOAD_PAGE unbacked", () => {
    assert.equal(navigationFeature.actions["navigateTo"], "PUSH_HISTORY_STATE");
    assert.equal(navigationFeature.unbacked["preloadPage"], "PRELOAD_PAGE");
  });

  test("binary declares all binary actions backed", () => {
    assert.equal(
      binaryFeature.actions["createBinaryPort"],
      "CREATE_BINARY_PORT",
    );
    assert.equal(
      binaryFeature.actions["postBinaryMessage"],
      "POST_BINARY_MESSAGE",
    );
    assert.equal(
      binaryFeature.actions["readBinaryMessage"],
      "READ_BINARY_MESSAGE",
    );
    assert.equal(
      binaryFeature.actions["closeBinaryPort"],
      "CLOSE_BINARY_PORT",
    );
  });

  test("no feature silently overrides a generic action-map entry with a different action", () => {
    for (const feature of FEATURES) {
      for (const [method, action] of Object.entries(feature.actions)) {
        const generic = DSL_ACTION_MAP[method];
        if (generic !== undefined) {
          assert.equal(
            action,
            generic,
            `${feature.name}.${method} disagrees with the generic map (${action} vs ${generic})`,
          );
        }
      }
    }
  });

  test("feature modules are disjoint except where the DSLs genuinely alias", () => {
    const seen = new Map<string, string>();
    for (const feature of FEATURES) {
      for (const method of Object.keys(feature.actions)) {
        const prev = seen.get(method);
        assert.equal(
          prev,
          undefined,
          `${method} appears in both ${prev} and ${feature.name}`,
        );
        seen.set(method, feature.name);
      }
    }
  });
});
