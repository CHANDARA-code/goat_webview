"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoatWebView = exports.NativeGoatWebViewModule = exports.GoatWebViewNativeComponent = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const GoatWebViewNativeComponent_1 = __importDefault(require("./GoatWebViewNativeComponent"));
__exportStar(require("./types"), exports);
__exportStar(require("./GoatBridge"), exports);
__exportStar(require("./useGoatBridge"), exports);
__exportStar(require("./GoatCapabilityPlugin"), exports);
var GoatWebViewNativeComponent_2 = require("./GoatWebViewNativeComponent");
Object.defineProperty(exports, "GoatWebViewNativeComponent", { enumerable: true, get: function () { return __importDefault(GoatWebViewNativeComponent_2).default; } });
var NativeGoatWebViewModule_1 = require("./NativeGoatWebViewModule");
Object.defineProperty(exports, "NativeGoatWebViewModule", { enumerable: true, get: function () { return __importDefault(NativeGoatWebViewModule_1).default; } });
const COMPONENT_NAME = 'GoatWebView';
const isFabric = typeof global !== 'undefined' && global.nativeFabricUIManager != null;
const FallbackGoatWebView = react_native_1.UIManager.getViewManagerConfig(COMPONENT_NAME) != null
    ? (0, react_native_1.requireNativeComponent)(COMPONENT_NAME)
    : () => {
        if (__DEV__) {
            console.warn(`Native component for '${COMPONENT_NAME}' does not seem to be linked or is running on an unsupported platform.`);
        }
        return null;
    };
const GoatWebView = (props) => {
    if (isFabric && GoatWebViewNativeComponent_1.default) {
        const Component = GoatWebViewNativeComponent_1.default;
        return react_1.default.createElement(Component, { ...props });
    }
    return react_1.default.createElement(FallbackGoatWebView, { ...props });
};
exports.GoatWebView = GoatWebView;
exports.default = exports.GoatWebView;
