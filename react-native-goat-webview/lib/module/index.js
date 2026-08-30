import React from 'react';
import { requireNativeComponent, UIManager, } from 'react-native';
import GoatWebViewNativeComponent from './GoatWebViewNativeComponent';
export * from './types';
export * from './GoatBridge';
export * from './useGoatBridge';
export * from './GoatCapabilityPlugin';
export { default as GoatWebViewNativeComponent } from './GoatWebViewNativeComponent';
export { default as NativeGoatWebViewModule } from './NativeGoatWebViewModule';
const COMPONENT_NAME = 'GoatWebView';
const isFabric = typeof global !== 'undefined' && global.nativeFabricUIManager != null;
const FallbackGoatWebView = UIManager.getViewManagerConfig(COMPONENT_NAME) != null
    ? requireNativeComponent(COMPONENT_NAME)
    : () => {
        if (__DEV__) {
            console.warn(`Native component for '${COMPONENT_NAME}' does not seem to be linked or is running on an unsupported platform.`);
        }
        return null;
    };
export const GoatWebView = (props) => {
    if (isFabric && GoatWebViewNativeComponent) {
        const Component = GoatWebViewNativeComponent;
        return React.createElement(Component, { ...props });
    }
    return React.createElement(FallbackGoatWebView, { ...props });
};
export default GoatWebView;
