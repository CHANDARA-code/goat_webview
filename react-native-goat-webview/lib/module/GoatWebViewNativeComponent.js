import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
import codegenNativeCommands from "react-native/Libraries/Utilities/codegenNativeCommands";
export const Commands = codegenNativeCommands({
    supportedCommands: [
        "goBack",
        "goForward",
        "reload",
        "stopLoading",
        "injectJavaScript",
        "requestFocus",
        "postMessage",
        "clearFormData",
        "clearCache",
        "clearHistory",
    ],
});
export default codegenNativeComponent("GoatWebView");
