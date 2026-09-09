import { useCallback, useMemo, useState } from 'react';
import { goatBridge } from '../GoatBridge';
/**
 * Passkey and hardware-vault actions for a React Native host.
 *
 * There is no `deriveKey` and no way to read the CTAP2 PRF output: encryption and decryption run
 * natively so the vault master key never enters the JS realm. [checkSupport] reports `supported:
 * false` rather than throwing, because capability probing is not a failure; every other call
 * rejects with the native error so a caller cannot mistake failure for a completed ceremony.
 */
export function usePasskey(appId) {
    const [support, setSupport] = useState(null);
    const checkSupport = useCallback(async () => {
        try {
            const res = (await goatBridge.passkeyCheckSupport(appId));
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
    const register = useCallback((options) => goatBridge.passkeyRegister(options, appId), [appId]);
    const authenticate = useCallback((options) => goatBridge.passkeyAssert(options, appId), [appId]);
    const encrypt = useCallback((vaultId, plaintext) => goatBridge.vaultEncrypt({ vaultId, plaintext }, appId), [appId]);
    const decrypt = useCallback((vaultId, envelope) => goatBridge.vaultDecrypt({ vaultId, envelope }, appId), [appId]);
    return useMemo(() => ({ support, checkSupport, register, authenticate, vault: { encrypt, decrypt } }), [support, checkSupport, register, authenticate, encrypt, decrypt]);
}
