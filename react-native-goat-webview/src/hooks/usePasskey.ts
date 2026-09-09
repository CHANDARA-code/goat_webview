import { useCallback, useMemo, useState } from 'react';
import { goatBridge } from '../GoatBridge';
import type { GoatVaultEnvelope } from '../GoatBridge';

export interface PasskeySupport {
  supported: boolean;
  platformAuthenticator: boolean;
  conditionalMediation: boolean;
  prfSupported: boolean;
  biometryType: string;
  hasEnrolledBiometrics: boolean;
  vaultMode: string;
}

export type VaultEnvelope = GoatVaultEnvelope;

/**
 * Passkey and hardware-vault actions for a React Native host.
 *
 * There is no `deriveKey` and no way to read the CTAP2 PRF output: encryption and decryption run
 * natively so the vault master key never enters the JS realm. [checkSupport] reports `supported:
 * false` rather than throwing, because capability probing is not a failure; every other call
 * rejects with the native error so a caller cannot mistake failure for a completed ceremony.
 */
export function usePasskey(appId?: string) {
  const [support, setSupport] = useState<PasskeySupport | null>(null);

  const checkSupport = useCallback(async (): Promise<PasskeySupport> => {
    try {
      const res = (await goatBridge.passkeyCheckSupport(appId)) as unknown as PasskeySupport;
      setSupport(res);
      return res;
    } catch {
      const unavailable: PasskeySupport = {
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

  const register = useCallback(
    (options: { optionsJson: string; rpId?: string }) => goatBridge.passkeyRegister(options, appId),
    [appId]
  );

  const authenticate = useCallback(
    (options: { optionsJson: string; rpId?: string }) => goatBridge.passkeyAssert(options, appId),
    [appId]
  );

  const encrypt = useCallback(
    (vaultId: string, plaintext: string) => goatBridge.vaultEncrypt({ vaultId, plaintext }, appId),
    [appId]
  );

  const decrypt = useCallback(
    (vaultId: string, envelope: VaultEnvelope) => goatBridge.vaultDecrypt({ vaultId, envelope }, appId),
    [appId]
  );

  return useMemo(
    () => ({ support, checkSupport, register, authenticate, vault: { encrypt, decrypt } }),
    [support, checkSupport, register, authenticate, encrypt, decrypt]
  );
}
