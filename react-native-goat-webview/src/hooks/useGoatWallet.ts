import { useCallback, useMemo, useState } from 'react';
import { goatBridge } from '../GoatBridge';

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
export function useGoatWallet(appId?: string) {
  const [state, setState] = useState<UseGoatWalletState>({
    account: null,
    connecting: false,
    error: null,
  });

  const connect = useCallback(
    async (options: { network?: string; chainFamily?: string; chains?: string[]; manifestUrl?: string } = {}) => {
      setState((s) => ({ ...s, connecting: true, error: null }));
      try {
        const account = (await goatBridge.web3ConnectWallet(options, appId)) as unknown as GoatWalletAccount;
        setState({ account, connecting: false, error: null });
        return account;
      } catch (e: any) {
        const error = e instanceof Error ? e : new Error(String(e));
        setState({ account: null, connecting: false, error });
        throw error;
      }
    },
    [appId]
  );

  const disconnect = useCallback(async () => {
    try {
      const res = await goatBridge.web3Disconnect(appId);
      setState({ account: null, connecting: false, error: null });
      return res;
    } catch (e: any) {
      const error = e instanceof Error ? e : new Error(String(e));
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, [appId]);

  const refresh = useCallback(async () => {
    const res: any = await goatBridge.web3GetAccount(appId);
    const account = res?.connected ? (res as GoatWalletAccount) : null;
    setState((s) => ({ ...s, account, error: null }));
    return account;
  }, [appId]);

  const signTransaction = useCallback(
    (options: Record<string, unknown>) => goatBridge.web3SignTransaction(options, appId),
    [appId]
  );

  const signMessage = useCallback(
    (options: { message: string; messageType?: string; chainFamily?: string; network?: string }) =>
      goatBridge.web3SignMessage(options, appId),
    [appId]
  );

  const switchChain = useCallback(
    (options: { chainId: string; chainFamily?: string; addChainParams?: Record<string, unknown> }) =>
      goatBridge.web3SwitchChain(options, appId),
    [appId]
  );

  return useMemo(
    () => ({ ...state, connect, disconnect, refresh, signTransaction, signMessage, switchChain }),
    [state, connect, disconnect, refresh, signTransaction, signMessage, switchChain]
  );
}
