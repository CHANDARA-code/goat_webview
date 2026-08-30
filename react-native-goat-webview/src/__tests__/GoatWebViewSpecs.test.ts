import React from "react";
import GoatWebViewNativeComponent from "../GoatWebViewNativeComponent";
import NativeGoatWebViewModule from "../NativeGoatWebViewModule";
import { GoatWebView } from "../index";
import { goatBridge, GoatWebViewNativeModule } from "../GoatBridge";
import packageJson from "../../package.json";

describe("GoatWebView New Architecture Codegen Specs Suite", () => {
  test("package.json contains valid codegenConfig, builder-bob config, and build scripts", () => {
    expect(packageJson.codegenConfig).toBeDefined();
    expect(packageJson.codegenConfig.name).toBe("GoatWebViewSpecs");
    expect(packageJson.codegenConfig.type).toBe("all");
    expect(packageJson.codegenConfig.jsRootDir).toBe("src");
    expect(packageJson.codegenConfig.android.package).toBe(
      "com.goat.webview.rn",
    );
    expect(packageJson.scripts.build).toBeDefined();
    expect(packageJson.scripts.prepare).toBeDefined();
    expect(packageJson["react-native-builder-bob"]).toBeDefined();
    expect(packageJson["react-native-builder-bob"].output).toBe("lib");
  });

  test("GoatWebViewNativeComponent Fabric spec is exported", () => {
    expect(GoatWebViewNativeComponent).toBeDefined();
    expect(typeof GoatWebViewNativeComponent).toBe("string"); // Mocked by requireNativeComponent
  });

  test("NativeGoatWebViewModule TurboModule spec resolves methods", async () => {
    expect(NativeGoatWebViewModule).toBeDefined();
    expect(typeof NativeGoatWebViewModule.prewarm).toBe("function");
    expect(typeof NativeGoatWebViewModule.clearCache).toBe("function");
    expect(typeof NativeGoatWebViewModule.getBundleVersion).toBe("function");
    expect(typeof NativeGoatWebViewModule.runHeadlessScript).toBe("function");
    expect(typeof NativeGoatWebViewModule.executeAction).toBe("function");
    expect(typeof NativeGoatWebViewModule.triggerHaptic).toBe("function");
    expect(typeof NativeGoatWebViewModule.setNavBarState).toBe("function");
    expect(typeof NativeGoatWebViewModule.setBottomSheetState).toBe("function");
    expect(typeof NativeGoatWebViewModule.notifyAppServiceReady).toBe("function");
    expect(typeof NativeGoatWebViewModule.notifyAppServiceCrash).toBe("function");
    expect(typeof NativeGoatWebViewModule.notifyAppServiceTerminate).toBe("function");

    const prewarmRes = await NativeGoatWebViewModule.prewarm("test-app");
    expect(prewarmRes).toBe(true);

    const clearRes = await NativeGoatWebViewModule.clearCache("test-app");
    expect(clearRes).toBe(true);

    const version = await NativeGoatWebViewModule.getBundleVersion("test-app");
    expect(version).toBe("1.0.0-goat");

    const headlessRes = await NativeGoatWebViewModule.runHeadlessScript(
      "return 42;",
      "test-app",
    );
    expect(headlessRes).toBe('{"status":"ok"}');

    const actionRes = await NativeGoatWebViewModule.executeAction(
      "GET_DEVICE_INFO",
      {},
      "test-app",
    );
    expect(actionRes).toEqual({ success: true });

    const hapticRes = await NativeGoatWebViewModule.triggerHaptic(
      "impact",
      "medium",
    );
    expect(hapticRes).toEqual({ triggered: true });

    const navBarRes = await NativeGoatWebViewModule.setNavBarState(
      { title: "Hello" },
      "test-app",
    );
    expect(navBarRes).toBe(true);

    const sheetRes = await NativeGoatWebViewModule.setBottomSheetState(
      { snapPoints: [0.5, 1.0] },
      "test-app",
    );
    expect(sheetRes).toBe(true);

    const readyRes = await NativeGoatWebViewModule.notifyAppServiceReady("test-app", { worker: "lane1" });
    expect(readyRes).toBe(true);

    const crashRes = await NativeGoatWebViewModule.notifyAppServiceCrash("test-app", "OOM");
    expect(crashRes).toBe(true);

    const termRes = await NativeGoatWebViewModule.notifyAppServiceTerminate("test-app");
    expect(termRes).toBe(true);
  });

  test("GoatWebView component renders properly under dual architecture", () => {
    const element = React.createElement(GoatWebView, {
      assetBundleName: "custom.zip",
      appId: "custom-app",
      popupRoutingPolicy: "systemBrowser",
      onBridgeMessage: jest.fn(),
      onPageLoaded: jest.fn(),
      onError: jest.fn(),
      onPopupRequest: jest.fn(),
    });

    expect(element).toBeDefined();
    expect(element.props.assetBundleName).toBe("custom.zip");
    expect(element.props.appId).toBe("custom-app");
    expect(element.props.popupRoutingPolicy).toBe("systemBrowser");
  });

  test("GoatBridge integrates with TurboModule and fallbacks", async () => {
    expect(GoatWebViewNativeModule).toBeDefined();
    const version = await goatBridge.getBundleVersion("app-1");
    expect(version).toBe("1.0.0-goat");

    const prewarmOk = await goatBridge.prewarm("app-1");
    expect(prewarmOk).toBe(true);

    const clearOk = await goatBridge.clearCache("app-1");
    expect(clearOk).toBe(true);

    const readyOk = await goatBridge.notifyAppServiceReady("app-1", { status: "ready" });
    expect(readyOk).toBe(true);

    const crashOk = await goatBridge.notifyAppServiceCrash("app-1", "Fatal error");
    expect(crashOk).toBe(true);

    const termOk = await goatBridge.notifyAppServiceTerminate("app-1");
    expect(termOk).toBe(true);
  });
});
