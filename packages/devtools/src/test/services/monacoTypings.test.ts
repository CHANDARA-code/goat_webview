import { describe, it, expect, vi } from "vitest";
import {
  GOAT_BRIDGE_ACTIONS_CATALOG,
  generateMonacoBridgeDeclarations,
  setupMonacoTypings,
} from "../../services/monacoBridgeTypings.ts";
import {
  validateManifestJson,
  validateGoatConfigJson,
  setupMonacoJsonSchemas,
  MANIFEST_JSON_SCHEMA,
  GOAT_CONFIG_JSON_SCHEMA,
} from "../../services/schemaValidator.ts";

describe("Monaco Bridge Typings & Catalog", () => {
  it("should contain all 18 domains in the catalog and 203 actions", () => {
    const domains = new Set(
      GOAT_BRIDGE_ACTIONS_CATALOG.map((item) => item.domain),
    );
    expect(domains.size).toBe(18);
    expect(GOAT_BRIDGE_ACTIONS_CATALOG.length).toBe(203);
  });

  it("should have key bridge actions defined across domains", () => {
    const actionNames = new Set(
      GOAT_BRIDGE_ACTIONS_CATALOG.map((item) => item.action),
    );

    expect(actionNames.has("GET_DEVICE_INFO")).toBe(true);
    expect(actionNames.has("STORAGE_SET")).toBe(true);
    expect(actionNames.has("FS_WRITE_FILE")).toBe(true);
    expect(actionNames.has("API_REQUEST")).toBe(true);
    expect(actionNames.has("SHOW_TOAST")).toBe(true);
    expect(actionNames.has("START_ACCELEROMETER")).toBe(true);
    expect(actionNames.has("GET_LOCATION")).toBe(true);
    expect(actionNames.has("BIOMETRIC_AUTH")).toBe(true);
    expect(actionNames.has("SCAN_CODE")).toBe(true);
    expect(actionNames.has("SHARE_SHEET")).toBe(true);
    expect(actionNames.has("PUSH_GET_TOKEN")).toBe(true);
    expect(actionNames.has("BLE_START_SCAN")).toBe(true);
    expect(actionNames.has("WEB3_CONNECT_WALLET")).toBe(true);
    expect(actionNames.has("CREATE_BINARY_PORT")).toBe(true);
    expect(actionNames.has("NAV_PUSH")).toBe(true);
    expect(actionNames.has("LOAD_SUBPACKAGE")).toBe(true);
    expect(actionNames.has("EMBED_NATIVE_VIEW")).toBe(true);
  });

  it("should include full TypeScript ambient declarations", () => {
    const dts = generateMonacoBridgeDeclarations();
    expect(dts).toContain("interface GoatBridgeInterface");
    expect(dts).toContain("call");
    expect(dts).toContain("GET_DEVICE_INFO");
  });

  it("should register extraLib in setupMonacoTypings", () => {
    const addExtraLib = vi.fn();
    const setCompilerOptions = vi.fn();
    const registerCompletionItemProvider = vi.fn();

    const mockMonaco = {
      languages: {
        typescript: {
          ScriptTarget: { ES2022: 99 },
          typescriptDefaults: { addExtraLib, setCompilerOptions },
          javascriptDefaults: { addExtraLib, setCompilerOptions },
        },
        CompletionItemKind: { Function: 1, Snippet: 27 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        registerCompletionItemProvider,
      },
    };

    setupMonacoTypings(mockMonaco);

    expect(addExtraLib).toHaveBeenCalledWith(
      expect.any(String),
      "ts:goat-bridge.d.ts",
    );
    expect(registerCompletionItemProvider).toHaveBeenCalledWith(
      "javascript",
      expect.any(Object),
    );
    expect(registerCompletionItemProvider).toHaveBeenCalledWith(
      "typescript",
      expect.any(Object),
    );
  });
});

describe("JSON Schema Validator Service", () => {
  it("should validate a valid manifest.json", () => {
    const validManifest = {
      appId: "com.goat.test",
      pages: ["pages/index/index", "pages/logs/logs"],
      window: {
        navigationBarTitleText: "Test App",
        navigationBarBackgroundColor: "#007acc",
        navigationBarTextStyle: "white",
      },
      tabBar: {
        list: [
          { pagePath: "pages/index/index", text: "Home" },
          { pagePath: "pages/logs/logs", text: "Logs" },
        ],
      },
    };

    const result = validateManifestJson(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should detect invalid manifest.json missing pages", () => {
    const invalidManifest = {
      window: { navigationBarTitleText: "No Pages" },
    };

    const result = validateManifestJson(invalidManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "pages")).toBe(true);
  });

  it("should detect invalid tabBar item count in manifest.json", () => {
    const invalidTabBar = {
      pages: ["pages/index/index"],
      tabBar: {
        list: [{ pagePath: "pages/index/index", text: "Only One" }],
      },
    };

    const result = validateManifestJson(invalidTabBar);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "tabBar.list")).toBe(true);
  });

  it("should validate a valid goat.config.json", () => {
    const validConfig = {
      name: "goat_demo_app",
      appId: "com.goat.demo",
      framework: "react",
      compilerOptions: {
        target: "ES2022",
        minify: true,
      },
    };

    const result = validateGoatConfigJson(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should detect missing name/projectname in goat.config.json", () => {
    const invalidConfig = {
      compilerOptions: {},
    };

    const result = validateGoatConfigJson(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "name")).toBe(true);
  });

  it("should register JSON diagnostics in setupMonacoJsonSchemas", () => {
    const setDiagnosticsOptions = vi.fn();
    const mockMonaco = {
      languages: {
        json: {
          jsonDefaults: { setDiagnosticsOptions },
        },
      },
    };

    setupMonacoJsonSchemas(mockMonaco);
    expect(setDiagnosticsOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: true,
        schemas: expect.arrayContaining([
          expect.objectContaining({
            fileMatch: ["*manifest.json"],
            schema: MANIFEST_JSON_SCHEMA,
          }),
          expect.objectContaining({
            fileMatch: ["*goat.config.json"],
            schema: GOAT_CONFIG_JSON_SCHEMA,
          }),
        ]),
      }),
    );
  });
});
