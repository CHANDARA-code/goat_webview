import React from "react";
import { requireNativeComponent, UIManager } from "react-native";
import GoatWebViewNativeComponent from "./GoatWebViewNativeComponent";
import { GoatWebViewProps } from "./types";

export * from "./types";
export * from "./GoatBridge";
export * from "./useGoatBridge";
export * from "./GoatCapabilityPlugin";
export {
  default as GoatWebViewNativeComponent,
  Commands,
} from "./GoatWebViewNativeComponent";
export { default as NativeGoatWebViewModule } from "./NativeGoatWebViewModule";

const COMPONENT_NAME = "GoatWebView";

const isFabric =
  typeof global !== "undefined" &&
  (global as any).nativeFabricUIManager != null;

const FallbackGoatWebView =
  UIManager.getViewManagerConfig(COMPONENT_NAME) != null
    ? requireNativeComponent<GoatWebViewProps>(COMPONENT_NAME)
    : () => {
        if (__DEV__) {
          console.warn(
            `Native component for '${COMPONENT_NAME}' does not seem to be linked or is running on an unsupported platform.`,
          );
        }
        return null;
      };

export const GoatWebView: React.FC<GoatWebViewProps> = (props) => {
  if (isFabric && GoatWebViewNativeComponent) {
    const Component =
      GoatWebViewNativeComponent as unknown as React.ComponentType<GoatWebViewProps>;
    return <Component {...props} />;
  }
  return <FallbackGoatWebView {...props} />;
};

export default GoatWebView;

export { useGoatWallet } from './hooks/useGoatWallet';
export type { GoatWalletAccount, UseGoatWalletState } from './hooks/useGoatWallet';
export { usePasskey } from './hooks/usePasskey';
export type { PasskeySupport, VaultEnvelope } from './hooks/usePasskey';
