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
export declare function usePasskey(appId?: string): {
    support: PasskeySupport | null;
    checkSupport: () => Promise<PasskeySupport>;
    register: (options: {
        optionsJson: string;
        rpId?: string;
    }) => Promise<Record<string, unknown>>;
    authenticate: (options: {
        optionsJson: string;
        rpId?: string;
    }) => Promise<Record<string, unknown>>;
    vault: {
        encrypt: (vaultId: string, plaintext: string) => Promise<GoatVaultEnvelope>;
        decrypt: (vaultId: string, envelope: VaultEnvelope) => Promise<{
            plaintext: string;
            migratedEnvelope?: GoatVaultEnvelope;
        }>;
    };
};
