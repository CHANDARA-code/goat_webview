"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePasskey = usePasskey;
const react_1 = require("react");
const GoatBridge_1 = require("../GoatBridge");
/**
 * Passkey and hardware-vault actions for a React Native host.
 *
 * There is no `deriveKey` and no way to read the CTAP2 PRF output: encryption and decryption run
 * natively so the vault master key never enters the JS realm. [checkSupport] reports `supported:
 * false` rather than throwing, because capability probing is not a failure; every other call
 * rejects with the native error so a caller cannot mistake failure for a completed ceremony.
 */
function usePasskey(appId) {
    const [support, setSupport] = (0, react_1.useState)(null);
    const checkSupport = (0, react_1.useCallback)(async () => {
        try {
            const res = (await GoatBridge_1.goatBridge.passkeyCheckSupport(appId));
            setSupport(res);
            return res;
        }
        catch {
            const unavailable = {
                supported: false,
                platformAuthenticator: false,
                conditionalMediation: false,
                prfSupported: false,
                biometryType: 'none',
                hasEnrolledBiometrics: false,
                vaultMode: 'none',
            };
            setSupport(unavailable);
            return unavailable;
        }
    }, [appId]);
    const register = (0, react_1.useCallback)((options) => GoatBridge_1.goatBridge.passkeyRegister(options, appId), [appId]);
    const authenticate = (0, react_1.useCallback)((options) => GoatBridge_1.goatBridge.passkeyAssert(options, appId), [appId]);
    const encrypt = (0, react_1.useCallback)((vaultId, plaintext) => GoatBridge_1.goatBridge.vaultEncrypt({ vaultId, plaintext }, appId), [appId]);
    const decrypt = (0, react_1.useCallback)((vaultId, envelope) => GoatBridge_1.goatBridge.vaultDecrypt({ vaultId, envelope }, appId), [appId]);
    return (0, react_1.useMemo)(() => ({ support, checkSupport, register, authenticate, vault: { encrypt, decrypt } }), [support, checkSupport, register, authenticate, encrypt, decrypt]);
}
