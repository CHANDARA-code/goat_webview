export const NativeModules = {
  GoatWebViewModule: {
    prewarm: jest.fn().mockResolvedValue(true),
    clearCache: jest.fn().mockResolvedValue(true),
    getBundleVersion: jest.fn().mockResolvedValue("1.0.0-goat"),
    runHeadlessScript: jest.fn().mockResolvedValue('{"status":"ok"}'),
    executeAction: jest.fn().mockResolvedValue({ success: true }),
    triggerHaptic: jest.fn().mockResolvedValue({ triggered: true }),
    setNavBarState: jest.fn().mockResolvedValue(true),
    setBottomSheetState: jest.fn().mockResolvedValue(true),
    notifyAppServiceReady: jest.fn().mockResolvedValue(true),
    notifyAppServiceCrash: jest.fn().mockResolvedValue(true),
    notifyAppServiceTerminate: jest.fn().mockResolvedValue(true),
  },
};

export const Platform = {
  OS: "android",
  select: (obj: Record<string, any>) => obj.android || obj.default,
};

export const UIManager = {
  getViewManagerConfig: jest.fn().mockReturnValue({}),
};

export const TurboModuleRegistry = {
  get: jest.fn((name: string) => (NativeModules as any)[name] || null),
  getEnforcing: jest.fn((name: string) => {
    if ((NativeModules as any)[name]) return (NativeModules as any)[name];
    throw new Error(`TurboModule ${name} not found`);
  }),
};

export const requireNativeComponent = jest.fn().mockReturnValue("GoatWebView");
