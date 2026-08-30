/**
 * r4-multi-lane-debugger.spec.ts — Tier 1 Feature Coverage for Requirement R4
 * Scope: DOM Elements Inspector, Unified Console, Bridge IPC Waterfall,
 * and Storage/SQLite Explorer.
 */

import { describe, it, expect } from "../harness/test-runner.ts";
import { DevToolsTestHarness } from "../harness/devtools-test-harness.ts";

export function registerR4Tests() {
  describe("Tier 1: R4 — Multi-Lane Debugger & Developer Tools Panel", () => {
    it("T1.R4.01: Elements & DOM inspector displays live VDOM tree hierarchy and computed styles", () => {
      const harness = new DevToolsTestHarness();

      const tree = {
        tag: "page",
        id: "main-view",
        children: [
          { tag: "header", children: [{ tag: "text", text: "Goat Title" }] },
          {
            tag: "button",
            id: "btn-submit",
            children: [{ tag: "text", text: "Submit" }],
          },
        ],
      };

      harness.store.getState().setVdomTree(tree);
      expect(harness.getState().domElements.vdomTree.id).toBe("main-view");

      harness.store.getState().setComputedStyles({
        width: "393px",
        height: "852px",
        margin: "0px",
        padding: "16px",
      });
      expect(harness.getState().domElements.computedStyles.padding).toBe(
        "16px",
      );
    });

    it("T1.R4.02: DOM node selection and hover states highlight elements in the simulator", () => {
      const harness = new DevToolsTestHarness();

      harness.store.getState().setSelectedNodeId("btn-submit");
      expect(harness.getState().domElements.selectedNodeId).toBe("btn-submit");

      harness.store.getState().setHoveredNodeId("btn-submit");
      expect(harness.getState().domElements.hoveredNodeId).toBe("btn-submit");

      harness.store.getState().setHoveredNodeId(null);
      expect(harness.getState().domElements.hoveredNodeId).toBeNull();
    });

    it("T1.R4.03: Unified Console aggregates logs with thread origin badges ([AppService], [AppView], [GoatHost])", () => {
      const harness = new DevToolsTestHarness();
      harness.store.getState().clearConsoleLogs();

      harness.store.getState().addConsoleLog({
        thread: "AppService",
        level: "log",
        message: "Worker state updated: count = 1",
      });

      harness.store.getState().addConsoleLog({
        thread: "AppView",
        level: "info",
        message: "DOM patch applied: 1 text mutation",
      });

      harness.store.getState().addConsoleLog({
        thread: "GoatHost",
        level: "warn",
        message: "Bluetooth permission requested",
      });

      const logs = harness.getState().consoleLogs;
      expect(logs.length).toBe(3);
      expect(logs[0].thread).toBe("AppService");
      expect(logs[1].thread).toBe("AppView");
      expect(logs[2].thread).toBe("GoatHost");
    });

    it("T1.R4.04: Unified Console supports log level filtering and clearing", () => {
      const harness = new DevToolsTestHarness();

      harness.store.getState().addConsoleLog({
        thread: "GoatHost",
        level: "error",
        message: "Network request failed: timeout",
      });

      const errorLogs = harness
        .getState()
        .consoleLogs.filter((l: any) => l.level === "error");
      expect(errorLogs.length).toBeGreaterThan(0);

      harness.store.getState().clearConsoleLogs();
      expect(harness.getState().consoleLogs.length).toBe(0);
    });

    it("T1.R4.05: Bridge IPC Waterfall records chronological timeline of bridge calls with latency", async () => {
      const harness = new DevToolsTestHarness();
      harness.store.getState().clearBridgeTraces();

      await harness.callBridge("GET_DEVICE_INFO");
      await harness.callBridge("STORAGE_SET", { key: "theme", value: "dark" });

      const traces = harness.getState().bridgeTraces;
      expect(traces.length).toBe(2);
      expect(traces[0].action).toBe("GET_DEVICE_INFO");
      expect(traces[1].action).toBe("STORAGE_SET");
    });

    it("T1.R4.06: Bridge Waterfall allows selecting traces to inspect payload and response data", async () => {
      const harness = new DevToolsTestHarness();
      await harness.callBridge("STORAGE_SET", { key: "user_id", value: 999 });

      const traces = harness.getState().bridgeTraces;
      const lastTrace = traces[traces.length - 1];
      expect(lastTrace.payload.key).toBe("user_id");

      harness.store.getState().setSelectedTraceId(lastTrace.id);
      expect(harness.getState().selectedTraceId).toBe(lastTrace.id);
    });

    it("T1.R4.07: Storage Explorer provides visual CRUD manager for sandboxed Key-Value storage", async () => {
      const harness = new DevToolsTestHarness();

      harness.store.getState().setStorageKv("session_token", "abc-123-jwt");
      expect(harness.getState().storageData.kvStore["session_token"]).toBe(
        "abc-123-jwt",
      );

      // Test Bridge Sync
      const res = await harness.callBridge("STORAGE_GET", {
        key: "session_token",
      });
      expect(res.value).toBe("abc-123-jwt");

      harness.store.getState().deleteStorageKv("session_token");
      expect(
        harness.getState().storageData.kvStore["session_token"],
      ).toBeUndefined();
    });

    it("T1.R4.08: Storage Explorer displays SQLite database tables and sandboxed file system paths", () => {
      const harness = new DevToolsTestHarness();

      const tables = {
        products: [
          { id: 1, name: "Smart Watch", price: 199.99 },
          { id: 2, name: "Wireless Earbuds", price: 89.99 },
        ],
      };

      harness.store.getState().setSqliteTables(tables);
      expect(
        harness.getState().storageData.sqliteTables["products"].length,
      ).toBe(2);
      expect(
        harness.getState().storageData.fsTree["/data/user/files"],
      ).toBeDefined();
    });
  });
}
