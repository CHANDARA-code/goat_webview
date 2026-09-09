export interface GoatWalletAccount {
    address: string;
    publicKey: string;
    wallet: string;
    network: string;
    chainId: string;
}
export interface UseGoatWalletState {
    account: GoatWalletAccount | null;
    connecting: boolean;
    error: Error | null;
}
/**
 * Wallet state and actions for a React Native host.
 *
 * Errors are surfaced both by rejecting the returned promise and in [error]; the hook never
 * resolves with a synthesised account or signature. A caller that renders "connected" must have
 * observed a real native response.
 */
export declare function useGoatWallet(appId?: string): {
    connect: (options?: {
        network?: string;
        chainFamily?: string;
        chains?: string[];
        manifestUrl?: string;
    }) => Promise<GoatWalletAccount>;
    disconnect: () => Promise<{
        disconnected: boolean;
    }>;
    refresh: () => Promise<GoatWalletAccount | null>;
    signTransaction: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
    signMessage: (options: {
        message: string;
        messageType?: string;
        chainFamily?: string;
        network?: string;
    }) => Promise<Record<string, unknown>>;
    switchChain: (options: {
        chainId: string;
        chainFamily?: string;
        addChainParams?: Record<string, unknown>;
    }) => Promise<{
        switched: boolean;
        chainId: string;
    }>;
    account: GoatWalletAccount | null;
    connecting: boolean;
    error: Error | null;
};
