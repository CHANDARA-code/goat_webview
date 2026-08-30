/**
 * r1-workspace-monaco.spec.ts — Tier 1 Feature Coverage for Requirement R1
 * Scope: Workspace layout, theme switching, Monaco 203 GoatBridge autocompletion,
 * JSON schema validation, File Tree CRUD, and Template Switcher.
 */

import { describe, it, expect } from "../harness/test-runner.ts";
import { DevToolsTestHarness } from "../harness/devtools-test-harness.ts";
import { GOAT_BRIDGE_ACTIONS_CATALOG } from "../../services/monacoBridgeTypings.ts";
import {
  validateManifestJson,
  validateGoatConfigJson,
} from "../../services/schemaValidator.ts";

export function registerR1Tests() {
  describe("Tier 1: R1 — Modern Multi-Panel IDE Workspace & Monaco Editor", () => {
    it("T1.R1.01: Dockable workspace shell manages multi-panel layout and collapsible panes", () => {
      const harness = new DevToolsTestHarness();
      const state = harness.getState();

      expect(state.isLeftSidebarOpen).toBe(true);
      expect(state.isRightSimulatorOpen).toBe(true);
      expect(state.isBottomDebuggerOpen).toBe(true);

      // Toggle panels
      harness.store.getState().toggleLeftSidebar();
      expect(harness.getState().isLeftSidebarOpen).toBe(false);

      harness.store.getState().toggleBottomDebugger();
      expect(harness.getState().isBottomDebuggerOpen).toBe(false);

      harness.store.getState().toggleLeftSidebar();
      expect(harness.getState().isLeftSidebarOpen).toBe(true);
    });

    it("T1.R1.02: Theme mode switching updates workspace tokens between dark and light modes", () => {
      const harness = new DevToolsTestHarness();
      expect(harness.getState().theme).toBe("dark");

      harness.toggleTheme();
      expect(harness.getState().theme).toBe("light");

      harness.toggleTheme();
      expect(harness.getState().theme).toBe("dark");
    });

    it("T1.R1.03: Editor tab manager opens files, switches active tab, tracks dirty state, and closes tabs", () => {
      const harness = new DevToolsTestHarness();

      // Open a file
      harness.openFile("src/pages/index.tsx");
      expect(harness.getState().openTabs.length).toBeGreaterThan(0);
      expect(harness.getState().activeFilePath).toBe("src/pages/index.tsx");

      // Open second file
      harness.openFile("manifest.json");
      expect(harness.getState().activeFilePath).toBe("manifest.json");

      // Dirty flag
      const activeTabId = harness.getState().activeTabId;
      if (activeTabId) {
        harness.store.getState().markTabDirty(activeTabId, true);
        const tab = harness
          .getState()
          .openTabs.find((t: any) => t.id === activeTabId);
        expect(tab?.isDirty).toBe(true);
      }

      // Close tab
      if (activeTabId) {
        harness.store.getState().closeTab(activeTabId);
        expect(
          harness.getState().openTabs.some((t: any) => t.id === activeTabId),
        ).toBe(false);
      }
    });

    it("T1.R1.04: Monaco bridge typings index all 203 GoatBridge actions across 18 functional domains", () => {
      const harness = new DevToolsTestHarness();
      const dts = harness.getMonacoTypings();

      expect(GOAT_BRIDGE_ACTIONS_CATALOG.length).toBe(203);
      expect(dts).toContain("interface GoatBridgeInterface");
      expect(dts).toContain("GET_DEVICE_INFO");
      expect(dts).toContain("STORAGE_SET");
      expect(dts).toContain("START_ACCELEROMETER");
      expect(dts).toContain("GET_LOCATION");
      expect(dts).toContain("BIOMETRIC_AUTH");
      expect(dts).toContain("BLE_START_SCAN");
      expect(dts).toContain("NFC_READ_TAG");
      expect(dts).toContain("WEB3_CONNECT_WALLET");
      expect(dts).toContain("LOAD_SUBPACKAGE");

      // Verify domain distribution
      const domains = new Set(GOAT_BRIDGE_ACTIONS_CATALOG.map((a) => a.domain));
      expect(domains.size).toBe(18);
    });

    it("T1.R1.05: JSON schema validator validates manifest.json conforming to required fields and types", () => {
      const validManifest = JSON.stringify({
        appId: "com.goat.demo",
        appName: "Goat Demo MiniApp",
        version: "1.0.0",
        versionCode: 1,
        entryPage: "src/pages/index.html",
        permissions: ["LOCATION", "STORAGE", "BIOMETRIC"],
        window: {
          title: "Demo App",
          backgroundColor: "#ffffff",
          orientation: "portrait",
        },
      });

      const res = validateManifestJson(validManifest);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);

      // Invalid manifest (missing required appId & invalid permission)
      const invalidManifest = JSON.stringify({
        appName: "Bad App",
        version: "invalid-semver",
        permissions: ["UNKNOWN_PERMISSION"],
      });

      const invalidRes = validateManifestJson(invalidManifest);
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors.length).toBeGreaterThan(0);
    });

    it("T1.R1.06: JSON schema validator validates goat.config.json project workspace configuration", () => {
      const validConfig = JSON.stringify({
        name: "my-goat-app",
        appId: "com.example.myapp",
        dev: {
          port: 4000,
          mock: true,
        },
      });

      const res = validateGoatConfigJson(validConfig);
      expect(res.valid).toBe(true);

      const invalidConfig = JSON.stringify({
        dev: {
          port: 999999, // Out of range port
        },
      });

      const invalidRes = validateGoatConfigJson(invalidConfig);
      expect(invalidRes.valid).toBe(false);
    });

    it("T1.R1.07: File tree browser supports virtual file creation, modification, renaming, and deletion", () => {
      const harness = new DevToolsTestHarness();

      harness.createFile(
        "src/components/Button.tsx",
        "export const Button = () => <button>Click</button>;",
      );
      expect(harness.getState().files["src/components/Button.tsx"]).toContain(
        "Button",
      );

      harness.updateFile(
        "src/components/Button.tsx",
        "export const Button = () => <button>Updated</button>;",
      );
      expect(harness.getState().files["src/components/Button.tsx"]).toContain(
        "Updated",
      );

      harness.store
        .getState()
        .renameFile(
          "src/components/Button.tsx",
          "src/components/CustomButton.tsx",
        );
      expect(
        harness.getState().files["src/components/CustomButton.tsx"],
      ).toBeDefined();
      expect(
        harness.getState().files["src/components/Button.tsx"],
      ).toBeUndefined();

      harness.deleteFile("src/components/CustomButton.tsx");
      expect(
        harness.getState().files["src/components/CustomButton.tsx"],
      ).toBeUndefined();
    });

    it("T1.R1.08: Template switcher loads React, Vue, and Vanilla dual-thread mini-app scaffolds", () => {
      const harness = new DevToolsTestHarness();

      harness.switchTemplate("react");
      expect(harness.getState().activeTemplate).toBe("react");
      expect(harness.getState().files["src/App.tsx"]).toBeDefined();

      harness.switchTemplate("vue");
      expect(harness.getState().activeTemplate).toBe("vue");
      expect(harness.getState().files["src/App.vue"]).toBeDefined();

      harness.switchTemplate("vanilla");
      expect(harness.getState().activeTemplate).toBe("vanilla");
      expect(harness.getState().files["src/app.js"]).toBeDefined();
    });
  });
}
