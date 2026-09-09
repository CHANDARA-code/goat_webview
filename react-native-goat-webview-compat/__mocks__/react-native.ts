export const NativeModules = {
  GoatWebViewModule: {
    prewarm: jest.fn().mockResolvedValue(true),
    clearCache: jest.fn().mockResolvedValue(true),
    getBundleVersion: jest.fn().mockResolvedValue("1.0.0-goat"),
    executeAction: jest.fn().mockResolvedValue({ success: true }),
  },
};

export const Platform = {
  OS: "android",
  select: (obj: Record<string, any>) => obj.android || obj.default,
};

export const UIManager = {
  getViewManagerConfig: jest.fn().mockReturnValue({}),
  dispatchViewManagerCommand: jest.fn(),
};

export const TurboModuleRegistry = {
  get: jest.fn((name: string) => (NativeModules as any)[name] || null),
  getEnforcing: jest.fn((name: string) => {
    if ((NativeModules as any)[name]) return (NativeModules as any)[name];
    throw new Error(`TurboModule ${name} not found`);
  }),
};

export const requireNativeComponent = jest.fn().mockReturnValue("GoatWebView");

export const findNodeHandle = jest.fn().mockReturnValue(1);

export const View = "View";

export const Linking = {
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(true),
};
