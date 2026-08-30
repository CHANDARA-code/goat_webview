import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  GoatHoverProvider,
  ManifestCompletionProvider,
  GoatDiagnosticProvider,
  SimulatorWebviewPanel,
  BridgeControlPanel,
  GoatCommands,
  activate,
  deactivate,
} from "../dist/extension.js";
import { GOAT_COMMAND_IDS } from "../dist/commands/register.js";

interface FakeRegisteredCommand {
  id: string;
  handler: (...args: unknown[]) => unknown;
  disposed: boolean;
}

function makeFakeVscode() {
  const registered: FakeRegisteredCommand[] = [];
  const messages: string[] = [];
  const vscode = {
    commands: {
      registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
        const entry: FakeRegisteredCommand = { id, handler, disposed: false };
        registered.push(entry);
        return {
          dispose() {
            entry.disposed = true;
          },
        };
      },
    },
    window: {
      showInputBox: async () => "demo-app",
      showInformationMessage: async (message: string) => {
        messages.push(message);
      },
      showErrorMessage: async (message: string) => {
        messages.push(message);
      },
    },
  };
  return { vscode, registered, messages };
}

describe("@goat/vscode-extension — Extension Suite", () => {
  it("activates and registers all contributed commands", async () => {
    const { vscode, registered } = makeFakeVscode();
    const context = { subscriptions: [] as Array<{ dispose(): void }> };
    const res = await activate(context, vscode as never);
    assert.strictEqual(res.activated, true);
    assert.strictEqual(res.version, "1.0.0");
    assert.deepStrictEqual(
      registered.map((r) => r.id).sort(),
      [...GOAT_COMMAND_IDS].sort(),
    );
    assert.strictEqual(context.subscriptions.length, GOAT_COMMAND_IDS.length);
    assert.deepStrictEqual(
      res.commands.sort(),
      [...GOAT_COMMAND_IDS].sort(),
    );
  });

  it("stays inert in headless environments without the vscode module", async () => {
    const res = await activate({ subscriptions: [] });
    assert.strictEqual(res.activated, false);
    assert.deepStrictEqual(res.commands, []);
  });

  it("wires command handlers to real command implementations", async () => {
    const { vscode, registered, messages } = makeFakeVscode();
    await activate({ subscriptions: [] }, vscode as never);

    const initCommand = registered.find((r) => r.id === "goat.init");
    assert.ok(initCommand);
    await initCommand.handler();
    assert.ok(
      messages.some((m) => m.includes("demo-app")),
      "goat.init should scaffold via GoatCommands and report back",
    );

    const simulatorCommand = registered.find(
      (r) => r.id === "goat.openSimulator",
    );
    assert.ok(simulatorCommand);
    await simulatorCommand.handler();
    assert.ok(
      messages.some((m) => m.includes("simulator")),
      "goat.openSimulator should launch the simulator panel",
    );
  });

  it("disposes nothing on deactivate and stays idempotent", async () => {
    deactivate();
    const { vscode } = makeFakeVscode();
    const res = await activate({ subscriptions: [] }, vscode as never);
    assert.strictEqual(res.activated, true);
  });

  describe("GoatHoverProvider", () => {
    const hoverProvider = new GoatHoverProvider();

    it("provides rich hover docs for getDeviceInfo", () => {
      const hover = hoverProvider.provideHover(
        "const info = await bridge.getDeviceInfo();",
        0,
      );
      assert.ok(hover !== null);
      assert.ok(hover.contents.some((c) => c.includes("getDeviceInfo")));
      assert.ok(hover.contents.some((c) => c.includes("DeviceInfo")));
    });

    it("provides required permission notice for scanCode", () => {
      const hover = hoverProvider.provideHover("await bridge.scanCode()", 0);
      assert.ok(hover !== null);
      assert.ok(hover.contents.some((c) => c.includes("CAMERA")));
    });

    it("provides required permission notice for authenticateBiometrics", () => {
      const hover = hoverProvider.provideHover(
        'await bridge.authenticateBiometrics({ promptMessage: "test" })',
        0,
      );
      assert.ok(hover !== null);
      assert.ok(hover.contents.some((c) => c.includes("BIOMETRIC")));
    });

    it("returns null for unknown API symbols", () => {
      const hover = hoverProvider.provideHover("const x = 12345;", 0);
      assert.strictEqual(hover, null);
    });
  });

  describe("ManifestCompletionProvider", () => {
    const completionProvider = new ManifestCompletionProvider();

    it("provides completion items for native permissions", () => {
      const items = completionProvider.provideCompletionItems("permissions");
      assert.ok(items.length >= 10);
      assert.ok(items.some((i) => i.label === '"CAMERA"'));
      assert.ok(items.some((i) => i.label === '"BIOMETRIC"'));
      assert.ok(items.some((i) => i.label === '"PAYMENT"'));
      assert.ok(items.some((i) => i.label === '"SYSTEM"'));
      assert.ok(items.some((i) => i.label === '"FILE_SYSTEM"'));
      assert.ok(items.some((i) => i.label === '"NETWORK"'));
      assert.ok(items.some((i) => i.label === '"MEDIA"'));
      assert.ok(items.some((i) => i.label === '"PUSH_NOTIFICATION"'));
      assert.ok(items.some((i) => i.label === '"WEB3"'));
      assert.ok(items.some((i) => i.label === '"BINARY_IPC"'));
    });

    it("provides completion items for screen orientation", () => {
      const items = completionProvider.provideCompletionItems("orientation");
      assert.ok(items.some((i) => i.label === '"portrait"'));
      assert.ok(items.some((i) => i.label === '"landscape"'));
    });

    it("provides top-level manifest property completions by default", () => {
      const items = completionProvider.provideCompletionItems("");
      assert.ok(items.some((i) => i.label === '"appId"'));
      assert.ok(items.some((i) => i.label === '"appName"'));
      assert.ok(items.some((i) => i.label === '"entryPage"'));
    });
  });

  describe("GoatDiagnosticProvider", () => {
    const diagnosticProvider = new GoatDiagnosticProvider();

    it("passes for a perfectly valid manifest", () => {
      const validManifest = JSON.stringify({
        appId: "com.example.wallet",
        appName: "My Wallet Mini-App",
        version: "1.0.0",
        versionCode: 1,
        entryPage: "index.html",
        permissions: ["CAMERA", "BIOMETRIC"],
        window: { backgroundColor: "#FFFFFF" },
      });
      const errors = diagnosticProvider.validateManifestJson(validManifest);
      assert.strictEqual(errors.length, 0);
    });

    it("flags missing required fields", () => {
      const invalidManifest = JSON.stringify({
        appName: "Incomplete App",
      });
      const errors = diagnosticProvider.validateManifestJson(invalidManifest);
      assert.ok(errors.some((e) => e.field === "appId"));
      assert.ok(errors.some((e) => e.field === "version"));
      assert.ok(errors.some((e) => e.field === "entryPage"));
    });

    it("flags invalid reverse domain appId syntax", () => {
      const invalidManifest = JSON.stringify({
        appId: "bad_app_id_without_dots",
        appName: "App",
        version: "1.0.0",
        versionCode: 1,
        entryPage: "index.html",
      });
      const errors = diagnosticProvider.validateManifestJson(invalidManifest);
      assert.ok(
        errors.some(
          (e) => e.field === "appId" && e.message.includes("reverse-domain"),
        ),
      );
    });

    it("flags duplicate permissions", () => {
      const duplicatePermManifest = JSON.stringify({
        appId: "com.example.dups",
        appName: "Dups",
        version: "1.0.0",
        versionCode: 1,
        entryPage: "index.html",
        permissions: ["CAMERA", "CAMERA"],
      });
      const errors = diagnosticProvider.validateManifestJson(
        duplicatePermManifest,
      );
      assert.ok(errors.some((e) => e.message.includes("Duplicate permission")));
    });

    it("flags invalid hex colors in window config", () => {
      const badColorManifest = JSON.stringify({
        appId: "com.example.color",
        appName: "Color",
        version: "1.0.0",
        versionCode: 1,
        entryPage: "index.html",
        window: { backgroundColor: "red" },
      });
      const errors = diagnosticProvider.validateManifestJson(badColorManifest);
      assert.ok(errors.some((e) => e.field === "window.backgroundColor"));
    });
  });

  describe("SimulatorWebviewPanel", () => {
    it("generates HTML with iPhone 16 Pro Dynamic Island", () => {
      const html = SimulatorWebviewPanel.generateHtml({
        devServerUrl: "http://localhost:3000",
        device: "iphone-16-pro",
        orientation: "portrait",
        theme: "light",
      });
      assert.ok(html.includes("Goat Phone Simulator"));
      assert.ok(html.includes("iphone-16-pro"));
      assert.ok(html.includes("http://localhost:3000"));
      assert.ok(html.includes("island-or-punchhole"));
    });

    it("generates HTML with Pixel 9 Pro punch hole in landscape", () => {
      const html = SimulatorWebviewPanel.generateHtml({
        devServerUrl: "http://localhost:3000",
        device: "pixel-9-pro",
        orientation: "landscape",
        theme: "dark",
      });
      assert.ok(html.includes("pixel-9-pro"));
      assert.ok(html.includes("landscape"));
      assert.ok(html.includes("#111827")); // dark theme bg
    });
  });

  describe("BridgeControlPanel", () => {
    it("generates HTML with mock hardware controls", () => {
      const html = BridgeControlPanel.generateHtml({
        biometrics: "success",
        gps: { lat: 37.7749, lng: -122.4194 },
        battery: 85,
        network: "wifi",
        theme: "light",
      });
      assert.ok(html.includes("Mock Hardware Controls"));
      assert.ok(html.includes("sel-biometrics"));
      assert.ok(html.includes("sel-network"));
      assert.ok(html.includes("85%"));
    });
  });

  describe("GoatCommands", () => {
    it("scaffolds project successfully", async () => {
      const res = await GoatCommands.scaffoldProject("demo-app", "react");
      assert.strictEqual(res.status, "success");
      assert.ok(res.message.includes("demo-app"));
    });

    it("handles missing project name error", async () => {
      const res = await GoatCommands.scaffoldProject("");
      assert.strictEqual(res.status, "error");
    });

    it("launches simulator", async () => {
      const res = await GoatCommands.runSimulator("pixel-9-pro");
      assert.strictEqual(res.status, "success");
    });

    it("deploys to android and ios targets", async () => {
      const resAndroid = await GoatCommands.runDevice("android");
      assert.strictEqual(resAndroid.status, "success");
      const resIos = await GoatCommands.runDevice("ios");
      assert.strictEqual(resIos.status, "success");
    });

    it("runs environment doctor", async () => {
      const res = await GoatCommands.triggerDevDoctor();
      assert.strictEqual(res.status, "success");
    });
  });

  describe("Schemas Validation", () => {
    it("loads and parses manifest.schema.json", async () => {
      const schemaPath = join(
        import.meta.dirname,
        "../schemas/manifest.schema.json",
      );
      const content = await readFile(schemaPath, "utf-8");
      const json = JSON.parse(content);
      assert.strictEqual(json.title, "GoatMiniAppManifest");
      assert.ok(json.properties.appId);
      assert.ok(json.properties.permissions);
      const enumValues = json.properties.permissions.items.enum;
      for (const perm of [
        "SYSTEM",
        "FILE_SYSTEM",
        "NETWORK",
        "MEDIA",
        "PUSH_NOTIFICATION",
        "WEB3",
        "BINARY_IPC",
      ]) {
        assert.ok(enumValues.includes(perm), `schema must allow permission ${perm}`);
      }
    });

    it("loads and parses goat.config.schema.json", async () => {
      const schemaPath = join(
        import.meta.dirname,
        "../schemas/goat.config.schema.json",
      );
      const content = await readFile(schemaPath, "utf-8");
      const json = JSON.parse(content);
      assert.strictEqual(json.title, "GoatConfigFile");
      assert.ok(json.properties.name);
    });
  });
});
