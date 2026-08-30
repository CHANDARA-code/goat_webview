"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGoatBridge = useGoatBridge;
const react_1 = require("react");
const GoatBridge_1 = require("./GoatBridge");
function useGoatBridge() {
    const [isPrewarmed, setIsPrewarmed] = (0, react_1.useState)(false);
    const [bundleVersion, setBundleVersion] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let mounted = true;
        (async () => {
            const prewarmOk = await GoatBridge_1.goatBridge.prewarm();
            const version = await GoatBridge_1.goatBridge.getBundleVersion();
            if (mounted) {
                setIsPrewarmed(prewarmOk);
                setBundleVersion(version);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);
    const clearCache = (0, react_1.useCallback)(async () => {
        return await GoatBridge_1.goatBridge.clearCache();
    }, []);
    return {
        isPrewarmed,
        bundleVersion,
        clearCache,
    };
}
